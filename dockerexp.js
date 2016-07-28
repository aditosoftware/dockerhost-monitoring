//var del = 1;
const Docker = require('dockerode');
const icingaapi = require('./libs/icingaapi')
var store = require('json-fs-store')('storage');
var winston = require('winston');

const dockersock = process.env.DOCKERSOCK;
const monUrl = process.env.MONITORING_API_URL;
const monAPIPort = process.env.MONITORING_API_PORT;
const monAPIUser = process.env.MONITORING_API_USER;
const monAPIPass = process.env.MONITORING_API_PASS;
const servername = process.env.DOCKERSERVERNAME;
const templatehost = process.env.TEMPLATEHOST;
const templateservice = process.env.TEMPLATESERVICE;
const hostgroup = process.env.HOSTGROUP;
const servicegroup = process.env.SERVICEGROUP
const debugnode = process.env.DEBUGNODE; //if you need debug

var icingaServer = new icingaapi(monUrl, monAPIPort, monAPIUser, monAPIPass); //create icingaapi object
var docker = new Docker({ socketPath: dockersock }); //create docker object

if (debugnode == "true") { //set logger to debug level
    var level = "debug";
} else {
    var level = "info";
}

var logger = new (winston.Logger)({ //define winston object
    "level": level,
    transports: [
        new (winston.transports.Console)()
    ]
})

logger.debug("D001:DEBUG on ++++++++++++++++++++++++++++++++++");

var dockerCon = []; //arr to write docker container
var icingaCon = []; //arr to write container, that already exist on icinga2 server

//if (del == 1) {
    var opts = { //options for docker object
        "all": true
        //  "all": true,
        // "filters": '{"label": ["monitoring=true"]}'
    };
// } else {
//     var opts = {
//         //"all": true
//         "all": true,
//         "filters": '{"label": ["monitoring=true"]}'
//     };
// }


docker.info(function (err, data) { //get docker info
    icingaServer.getHostFiltered({ //search docker host in icinga2 server (check if this already exist);
        "filter": "host.name == server",
        "filter_vars": {
            "server": servername
        }
    }, function (err, result) {
        if (result == 0) {
            icingaServer.createHostCustom(JSON.stringify({ //write a custom host definition for icinga2 server
                "templates": [templatehost],
                "attrs": {
                    "display_name": data.Name,
                    "vars.group": hostgroup,
                    "vars.Docker_version": data.ServerVersion,
                    "vars.DockerRootDir": data.DockerRootDir,
                    "vars.MemTotal": formatBytes(data.MemTotal, 2),
                    "vars.CPU": data.NCPU,
                    "vars.OS": data.OperatingSystem,
                    "vars.Kernel": data.KernelVersion
                }
            }), servername, function (err, result) {
                if (err) logger.error("ER01:" + err);
            })
        } else {
            icingaServer.setHostState(servername, 0, "OK - Everything is going to be fine", function (err, data) { //set state "OK" to docker hosting
                if (err) {
                    logger.error("ER10:" + JSON.stringify(err));
                    logger.debug("E001:setHostState(0)(err): ", err);
                } else {
                    logger.info("I001:Docker Host: ", "running")
                    logger.debug("D002:setHostState(0)(ok): ", data);
                }
            });
        }
    })
})

docker.listContainers(opts, function (err, containers) { //get a list of all container on the docker host
    var contArr = [];

    for (var i = 0; i < containers.length; i++) {
        var container = docker.getContainer(containers[i].Id);
        container.inspect(function (err, conData) { //write an array with all containers on docker host
            if (conData.Config.Labels.monitoring != "false") {
                dockerCon.push({
                    "id": conData.Id.slice(0, 12),
                    "name": conData.Name.slice(1, conData.Name.length),
                    "state": conData.State.Status,
                    "pid": conData.State.Pid,
                    "started": conData.State.StartedAt,
                    "processes": conData.Config.Labels.processes
                });
            }
        })
    }

    icingaServer.getHostFiltered({ //get all host objects of icinga server with filter "servername (system var)"
        "filter": "host.vars.server == server",
        "filter_vars": {
            "server": servername
        }
    }, function (err, iciObj) {
        if (err) {
            logger.error("ER02:" + err);
        } else {
            for (var i = 0; i < iciObj.length; i++) {
                icingaCon.push(iciObj[i]);
            }

            deleteDiffToDocker(dockerCon, icingaCon); //delete host objects in icinga2 if a container on docker host don't exist
            createDiffToDocker(dockerCon, icingaCon); //create host objects in icinga2 if found a docker container, that not already exist in icinga2 

            for (var i = 0; i < dockerCon.length; i++) {
                setHostState(dockerCon[i]); //set state of host object in icinga for all containers
            }
        }
    })
})

function setHostState(pCon) { //function to check state of a host object in icinga2
    let con = pCon;
    if (con.state == "running") {
        icingaServer.setHostState(con.id, 0, "OK - " + con.state + " ### PID:" + con.pid + " ### Started at:" + con.started + " ### on Host: " + servername, function (err, result) {
            if (err) {
                logger.error("ER11:" + JSON.stringify(err));
                logger.debug("E002:setHostState(0)(err): ", err);
            } else {
                logger.info("I002:Container:", con.id, ":", con.state);
                logger.debug("D003:setHostState(0)(ok): " + con.state, JSON.stringify(result));

                createSetServiceState(con); //check or crete a service object in icinga2
            }
        });
    } else {
        icingaServer.setHostState(con.id, 1, "ERROR - " + con.state + " ### PID:" + con.pid + " ### Started at:" + con.started + " ### on Host: " + servername, function (err, result) {
            if (err) {
                logger.error("ER12:" + JSON.stringify(err));
                logger.debug("E003:setHostState(1)(err): " + JSON.stringify(err));
            } else {
                logger.info("I003:Container:", con.id, ":", con.state);
                logger.debug("D004:Container:", con.id, ":", con.state)
            }
        });
    }
}

function search(nameKey, myArray) {
    for (var i = 0; i < myArray.length; i++) {
        if (myArray[i].name === nameKey) {
            return myArray[i];
        }
    }
}

function searchDocker(nameKey, myArray) {
    for (var i = 0; i < myArray.length; i++) {
        if (myArray[i].id === nameKey) {
            return myArray[i];
        }
    }
}

function createDiffToDocker(dockerArr, monArr, pCallback) { //function to check diff between icinga2 host objects and containers on docker host
    var ic = [];
    var dk = [];
    for (var i = 0; i < monArr.length; i++) {
        ic.push(monArr[i].name);
    }
    for (var y = 0; y < dockerArr.length; y++) {
        dk.push(dockerArr[y].id);
    }

    var diff = dk.filter(x => ic.indexOf(x) == -1);
    if (diff.length > 0) {
        for (var x = 0; x < diff.length; x++) {
            (function (contoSearch) {
                var se = searchDocker(contoSearch, dockerArr);
                if (se !== undefined && se != null) {
                    icingaServer.createHost(templatehost, se.id, se.name, hostgroup, servername, function (err, result) {
                        if (err) {
                            logger.error("ER03:" + err);
                            logger.debug("E004:createHost: ID:", se.id, " Name: ", se.name);
                        } else {
                            logger.debug("D009:createHost: OK ID: ", se.id, " Name: ", se.name);
                            setHostState(se); //set host state in icinga2
                        }
                    });
                }
            })(diff[x])
        }

    }
}

function deleteDiffToDocker(dockerArr, monArr) { //func to delete icinga2 host definitions if container doesn't exist (delete or move);
    var ic = [];
    var dk = [];
    for (var i = 0; i < monArr.length; i++) {
        ic.push(monArr[i].name);
    }
    for (var y = 0; y < dockerArr.length; y++) {
        dk.push(dockerArr[y].id);
    }

    var diff = ic.filter(x => dk.indexOf(x) == -1);

    if (diff.length > 0) {
        for (var x = 0; x < diff.length; x++) {
            icingaServer.deleteHost(diff[x], function (err, result) {
                if (err) {
                    logger.error("ER08" + err);
                    logger.debug("E009:deleteDiffToDocker: ", diff[x]);
                } else {
                    logger.debug("D008:deleteDiffToDocker:  success");
                }
            })
        }
    }
}

function createSetServiceState(con) { //func to check or create a icinga2 service (if you defined a service in labels)
    if (con.processes != undefined) {
        var arrProc = JSON.parse(con.processes)
        var setState = function () {
            var container = docker.getContainer(con.id);
            container.top(con.id, function (err, condata) {
                if (con.processes != undefined) {
                    var container = docker.getContainer(con.id);
                    container.top(con.id, function (err, data) {
                        var conProc = data.Processes;
                        var monProc = JSON.parse(con.processes);
                        for (var i = 0; i < monProc.length; i++) {
                            (function (procFromMon) {
                                var searchIN = "" + conProc, substring = procFromMon;
                                if (searchIN.indexOf(substring) > -1) {
                                    icingaServer.setServiceState(procFromMon, con.id, 0, function (err, result) {
                                        if (err) {
                                            logger.error("ER04:" + err.toString());
                                            logger.debug("E005:setServiceState: ", err, " Servicename: ", procFromMon, " Container: ", con.id);
                                        } else {
                                            logger.debug("D005:setServiceState: successfull created", " Servicename: ", procFromMon, " Container: ", con.id)
                                        }
                                    })
                                } else {
                                    icingaServer.setServiceState(procFromMon, con.id, 2, function (err, result) {
                                        if (err) {
                                            logger.error("ER05:" + err);
                                            logger.debug("E006:setServiceState: ", err, "\n", " Servicename: ", procFromMon, " Container: ", con.id);
                                        } else {
                                            logger.debug("D006:setServiceState: successfull created", "\n", " Servicename: ", procFromMon, " Container: ", con.id)
                                        }
                                    })
                                }
                            })(monProc[i])
                        }

                    });
                }
            })
        }

        var createService = function () {
            if (arrProc.length > 0) {
                for (var i = 0; i < arrProc.length; i++) {
                    (function (procFromArr) {
                        icingaServer.createService(templateservice, con.id, procFromArr, procFromArr + " (" + con.name + ")", servicegroup, servername, function (err, result) {
                            if (err) {
                                logger.error("ER06:" + err);
                                logger.debug("E007:createService: ", procFromArr, " Container: ", con.id);
                            } else {
                                logger.debug("D007:createService: ", procFromArr + "success", " Container: ", con.id);
                                createSetServiceState(con); //callback to check created service
                            }
                        })
                    })(arrProc[i])
                }
            }
        }

        icingaServer.getService(con.id, arrProc[0], function (err, result) {
            if (err) {
                logger.error("ER07:" + JSON.stringify(err));
            } else {
                if (result.Statuscode == "404") {
                    logger.debug("E008:getService :", arrProc[0]);
                    createService(); //if service was not found (in icinga2), the create one
                } else {
                    setState(); //if service was found, check state of them
                }
            }
        })
    }
}

function showArrDiff(arr1, arr2) {
    var ar1 = [];
    var ar2 = [];
    for (var i = 0; i < arr1.length; i++) {
        ar1.push(arr1[i].id);
    }
    for (var y = 0; y < arr2.length; y++) {
        ar2.push(arr2[y].name);
    }

    let diff = ar1.filter(x => ar2.indexOf(x) == -1);
    return diff;
}

function formatBytes(bytes, decimals) {
    if (bytes == 0) return '0 Byte';
    var k = 1000; // or 1024 for binary
    var dm = decimals + 1 || 3;
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}