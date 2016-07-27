const Docker = require('dockerode');
const icingaapi = require('./libs/icingaapi')
var store = require('json-fs-store')('storage');

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

var icingaServer = new icingaapi(monUrl, monAPIPort, monAPIUser, monAPIPass);
var docker = new Docker({ socketPath: dockersock });

var dockerCon = [];
var icingaCon = [];

var opts = {
    "all": true,
    "filters": '{"label": ["monitoring=true"]}'
};

docker.info(function (err, data) {
    icingaServer.getHostFiltered({
        "filter": "host.name == server",
        "filter_vars": {
            "server": servername
        }
    }, function (err, result) {
        if (result == 0) {
            icingaServer.createHostCustom(JSON.stringify({
                "templates": [templatehost],
                "attrs": {
                    "display_name": data.Name,
                    "vars.group": hostgroup,
                    "vars.Docker_version": data.ServerVersion,
                    "vars.DockerRootDir": data.DockerRootDir,
                    "vars.MemTotal": formatBytes(data.MemTotal,2),
                    "vars.CPU": data.NCPU,
                    "vars.OS": data.OperatingSystem,
                    "vars.Kernel": data.KernelVersion
                }
            }), servername, function (err, result) {
                if (err) console.error(err);
            })
        } else {
            icingaServer.setHostState(servername, 0, "OK - Everything is going to be fine", function (err, data) {
                if (err) {
                    console.error(err);
                } else {
                    console.log("Docker Host: ", "running");
                }
            });
        }
    })
})

docker.listContainers(opts, function (err, containers) {
    var contArr = [];
    
    for (var i = 0; i < containers.length; i++) {
        var container = docker.getContainer(containers[i].Id);
        container.inspect(function (err, conData) {
            dockerCon.push({
                "id": conData.Id.slice(0, 12),
                "name": conData.Name.slice(1, conData.Name.length),
                "state": conData.State.Status,
                "pid": conData.State.Pid,
                "started": conData.State.StartedAt,
                "processes": conData.Config.Labels.processes
            });
        })
    }
    var setHostState = function (con) {
        if (con.state == "running") {
            icingaServer.setHostState(con.id, 0, "OK - " + con.state + " ### PID:" + con.pid + " ### Started at:" + con.started + " ### on Host: " + servername, function (err, result) {
                if (err) {
                    console.error(err);
                } else {
                    console.log("Container:", con.id, ":", con.state);
                    createSetServiceState(con);
                    //createSetPortState(con);
                }
            });
        } else {
            icingaServer.setHostState(con.id, 1, "ERROR - " + con.state + " ### PID:" + con.pid + " ### Started at:" + con.started + " ### on Host: " + servername, function (err, result) {
                if (err) {
                    console.error(err);
                } else {
                    console.log("Container:", con.id, ":", con.state);
                    //createSetServiceState(con);
                }
            });
        }
    }

    icingaServer.getHostFiltered({
        "filter": "host.vars.server == server",
        "filter_vars": {
            "server": servername
        }
    }, function (err, iciObj) {
        if (err) {
            console.log(err);
        } else {
            for (var i = 0; i < iciObj.length; i++) {
                icingaCon.push(iciObj[i]);
            }

            deleteDiffToDocker(dockerCon, icingaCon);
            createDiffToDocker(dockerCon, icingaCon);

            for (var i = 0; i < dockerCon.length; i++) {
                setHostState(dockerCon[i]);
            }
        }
    })
})

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

function createDiffToDocker(dockerArr, monArr) {
    var ic = [];
    var dk = [];
    for (var i = 0; i < monArr.length; i++) {
        ic.push(monArr[i].name);
    }
    for (var y = 0; y < dockerArr.length; y++) {
        dk.push(dockerArr[y].id);
    }

    let diff = dk.filter(x => ic.indexOf(x) == -1);
    if (diff.length > 0) {
        for (var x = 0; x < diff.length; x++) {
            var se = searchDocker(diff[x], dockerArr);
            if (se) {
                icingaServer.createHost(templatehost, se.id, se.name, hostgroup, servername, function (err, result) {
                    if (err) {
                        console.error(err);
                    } 
                });
            }
        }
    }
}

function createSetServiceState(con) {

    if (con.processes != undefined) {
        var arrProc = JSON.parse(con.processes)

        var createService = function () {
            for (var i = 0; i < arrProc.length; i++) {
                icingaServer.createService(templateservice, con.id, arrProc[i], arrProc[i] + " (" + con.name + ")", servicegroup, servername, function (err, result) {
                    if (err) {
                        console.log(err);
                    }
                })
            }
        }

        var setState = function () {
            var container = docker.getContainer(con.id);
            container.top(con.id, function (err, condata) {
                if (con.processes != undefined) {
                    var container = docker.getContainer(con.id);
                    container.top(con.id, function (err, data) {
                        var conProc = data.Processes;
                        var monProc = JSON.parse(con.processes);
                        for (var i = 0; i < monProc.length; i++) {
                            var searchIN = "" + conProc, substring = monProc[i];
                            if (searchIN.indexOf(substring) > -1) {
                                icingaServer.setServiceState(monProc[i], con.id, 0, function (err, result) {
                                    if (err) {
                                        console.error(err);
                                    }
                                })
                            } else {
                                icingaServer.setServiceState(monProc[i], con.id, 2, function (err, result) {
                                    if (err) {
                                        console.error(err);
                                    }
                                })
                            }
                        }

                    });
                }
            })
        }
        icingaServer.getService(con.id, arrProc[0], function (err, result) {
            if (err) {
                console.error(err);
                if (err.Statuscode == "404") {
                    createService();
                }
            } else {
                setState();
            }
        })
    }
}

function deleteDiffToDocker(dockerArr, monArr) {
    var ic = [];
    var dk = [];
    for (var i = 0; i < monArr.length; i++) {
        ic.push(monArr[i].name);
    }
    for (var y = 0; y < dockerArr.length; y++) {
        dk.push(dockerArr[y].id);
    }

    let diff = ic.filter(x => dk.indexOf(x) == -1);
    //console.log("delte: +++", diff)

    if (diff.length > 0) {
        for (var x = 0; x < diff.length; x++) {
            icingaServer.deleteHost(diff[x], function (err, result) {
                if (err) {
                    console.error(err);
                }
            })
        }
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