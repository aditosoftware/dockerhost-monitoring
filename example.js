const Docker = require('dockerode');
const icingaapi = require('icinga2-api')

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

console.log({
    "monURL": monUrl,
    "monAPIPort": monAPIPort,
    "monAPIUser": monAPIUser,
    "monAPIPass": monAPIPass
})

var icingaServer = new icingaapi(monUrl, monAPIPort, monAPIUser, monAPIPass);
var docker = new Docker({ socketPath: dockersock });

icingaServer.getHostState("icinga2", function(err, result){
    if(err){
        console.error(err);
    } else {
        console.log(result);
    }
})

// icingaServer.getHostFiltered({
//     "filter": "host.vars.server == server",
//     "filter_vars": {
//         "server": servername
//     }
// }, "local", function(err, result){
//     if(err){
//         console.error(err);
//     } else{
//         console.log(result);
//     }
// })

// icingaServer.getServiceWithState(0, function (err, services) {
//     if (err) {
//         console.log(err);
//     } else {
//         for (var i = 0; i < services.length; i++) {
//             var serverServiceSplit = services[i].name.split("!");

//             if (serverServiceSplit[1].match(/^(?:[A-Za-z]+)(?:[A-Za-z0-9 _]*)$/)) {
//                 icingaServer.getService(serverServiceSplit[0], serverServiceSplit[1], function (err, service) {
//                     console.log(err);
//                     console.log(service);
//                 })
//             }
//         }
//     }
// })

// icingaServer.createHost("passive-host", "4demo", "4Demo Server", "adito", servername, function (err, result) {
//     if (err) {
//         console.error(err);
//     } else {
//         console.log(result);
//     }
// });

// icingaServer.createService("passive-service", "4demo", "topService","Top Service", "adito", "dockerdmz", function(err,result){
//     if(err){
//         console.error(err);
//     } else {
//         console.log(result);
//     }
// })

// var hostBody = JSON.stringify({
//     "templates": ["passive-host"],
//     "attrs": {
//         "display_name": "4Demo Server",
//         "vars.group": "adito",
//         "vars.server": "dockerdmz"
//     }
// })
// icingaServer.createHostCustom(hostBody, "4demo2", function (err, result) {
//     if (err) {
//         console.error(err);
//     } else {
//         console.log(result);
//     }
// })

// icingaServer.deleteHost("4demo", function(err, result){
//     if(err){
//         console.error(err);
//     } else {
//         console.log(result);
//     }
// })

// var serviceBody = JSON.stringify({
//     "templates": ["passive-service"],
//     "attrs": {
//         "display_name": "Service Top",
//         "vars.group": "adito",
//         "vars.server": "dockerdmz"
//     }
// })

// icingaServer.createServiceCustom(serviceBody, "4demo", "top", function (err, result) {
//     if (err) {
//         console.error(err);
//     } else {
//         console.log(result);
//     }
// })

// icingaServer.deleteHost("4demo", function(err, result){
//     if(err){
//         console.error(err);
//     } else {
//         console.log(result);
//     }
// })

// icingaServer.deleteService("topService", "4demo", function(err, result){
//     if(err){
//         console.error(err);
//     } else {
//         console.log(result);
//     }
// })

// icingaServer.setHostState("4demo", "0", function(err, result){
//     if(err){
//         console.error(err);
//     } else {
//         console.log(result);
//     }
// });

// icingaServer.setServiceState("topService","4demo", "0", function(err, result){
//     if(err){
//         console.error(err);
//     } else {
//         console.log(result);
//     }
// });