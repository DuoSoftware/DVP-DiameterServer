/**
 * Created by Kalana on 12/5/2016.
 */
var diameter = require('diameter');
var ratings = require('./ratings');
var scheduler = require('./scheduler');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
const avp = require('diameter-avp-object');
var walletHandler = require('./WalletHandler');
var config = require('config');

var serverRealm = 'example.org';
var serverHost = config.Host.domain;
var serverPort = config.Host.port;


var relayRealm = 'example.com';
var relayHost = 'localhost';
var relayPort = 3868;
var relayIP = '127.0.0.1';


var LockedCredit = [];

var optionsAsTcpServer = {
    beforeAnyMessage: diameter.logMessage,
    afterAnyMessage: diameter.logMessage
};

var server = diameter.createServer(optionsAsTcpServer, function(socket) {

    socket.setNoDelay(true);
    socket.setKeepAlive(true,5000);

    console.log("Client connected through TCP : " +  socket.remoteAddress +':'+ socket.remotePort);


    socket.on('diameterMessage', processDiameterMessages);

    socket.on('end', function() {
        console.log('Client disconnected.');
    });
    socket.on('error', function(err) {
        console.log(err);
    });
});



function processDiameterMessages(event,response) {
    if (event.message.command === 'Capabilities-Exchange') {
        event.response.body = event.response.body.concat([
            ['Result-Code', 'DIAMETER_SUCCESS'],
            ['Origin-Host', relayHost],
            ['Origin-Realm', relayRealm],
            ['Host-IP-Address', relayIP],
            ['Acct-Application-Id', 'Relay'],
            ['Auth-Application-Id', 'Relay'],
            ['Product-Name', 'node-diameter-server-0.1']
        ]);
        event.callback(event.response);
    }
    if (event.message.command === 'Device-Watchdog') {
        event.response.body = event.response.body.concat([
            ['Result-Code', 'DIAMETER_SUCCESS'],
            ['Origin-Host', serverHost],
            ['Origin-Realm', serverPort]
        ]);
        event.callback(event.response);
    }


    if (event.message.command=='Credit-Control'){

        var avpObj = avp.toObject(event.message.body);

        console.log(avpObj.ccRequestType ==='EVENT_REQUEST');
        console.log(avpObj.requestedAction);

        if(avpObj.ccRequestType ==='EVENT_REQUEST'){
            switch (avpObj.requestedAction){

                case 'PRICE_ENQUIRY':
                    var data = avpObj.subscriptionId.subscriptionIdData;

                    var req = {
                        body :{},
                        user :{}
                    };

                    var datapasred = JSON.parse(data);

                    req.body.Amount = 0 ;
                    req.user.iss = datapasred.user;
                    req.body.Reason = 'Per minute Call billeng credit reservation'
                    req.user.tenant = datapasred.tenant;
                    req.user.company = datapasred.company;
                    req.body.SessionId = datapasred.csid;
                    ratings.getRating(datapasred.to,datapasred.from, datapasred.provider, function(rating){


                        console.log(rating);
                        if(rating == -2){
                            event.response.body = event.response.body.concat([
                                ['Result-Code', 'DIAMETER_UNABLE_TO_DELIVER'],
                                ['Origin-Host', serverHost],
                                ['Origin-Realm', serverRealm],
                                ['Auth-Application-Id', 'Diameter Credit Control'],
                                ['CC-Request-Number', 0]
                            ]);
                            event.callback(event.response);
                        }
                        else{
                            req.body.Amount = rating *100;
                            walletHandler.LockCreditFromCustomer(req, function(found){

                                if(JSON.parse(found).IsSuccess){

                                    var creditLock = {
                                        csid : datapasred.csid,
                                        amount : req.body.Amount
                                    };

                                    LockedCredit.push(creditLock);

                                    event.response.body = event.response.body.concat([
                                        ['Result-Code', 'DIAMETER_SUCCESS'],
                                        ['Origin-Host', serverHost],
                                        ['Origin-Realm', serverRealm],
                                        ['Auth-Application-Id', 'Diameter Credit Control'],
                                        ['CC-Request-Number', 0]
                                    ]);
                                    event.callback(event.response);
                                }
                                else {

                                    console.log(found);
                                    event.response.body = event.response.body.concat([
                                        ['Result-Code', 'DIAMETER_RESOURCES_EXCEEDED'],
                                        ['Origin-Host', serverHost],
                                        ['Origin-Realm', serverRealm],
                                        ['Auth-Application-Id', 'Diameter Credit Control'],
                                        ['CC-Request-Number', 0]
                                    ]);
                                    event.callback(event.response);

                                }

                            })
                        }


                    });
                    break;

                case 'CHECK_BALANCE':
                    var data = {dsid : avpObj.sessionId, csid : JSON.parse(avpObj.subscriptionId.subscriptionIdData).csid, userinfo : avpObj.subscriptionId.subscriptionIdData};
                    //console.log(avpObj)

                    var removeIndex = -1;
                    for ( var index in LockedCredit){
                        if(LockedCredit[index].csid ==  JSON.parse(avpObj.subscriptionId.subscriptionIdData).csid){
                            removeIndex = index;
                            break;
                        }

                    }
                    if (removeIndex != -1){
                        console.log('Locked Credit Removed');
                        LockedCredit.splice(removeIndex, 1);
                    }

                    scheduler.callBilling(data).initializeCall(data, function(found){
                        //console.log(found);

                        if(found && found.IsSuccess){
                            event.response.body = event.response.body.concat([
                                ['Result-Code', 'DIAMETER_SUCCESS'],
                                ['Origin-Host', serverHost],
                                ['Origin-Realm', serverRealm],
                                ['Auth-Application-Id', 'Diameter Credit Control'],
                                ['CC-Request-Number', 0]
                            ]);
                            event.callback(event.response);
                        }
                        else {

                            console.log(found);
                            event.response.body = event.response.body.concat([
                                ['Result-Code', 'DIAMETER_RESOURCES_EXCEEDED'],
                                ['Origin-Host', serverHost],
                                ['Origin-Realm', serverRealm],
                                ['Auth-Application-Id', 'Diameter Credit Control'],
                                ['CC-Request-Number', 0]
                            ]);
                            event.callback(event.response);

                        }
                    });
                    break;

                    break;
                case 'DIRECT_DEBITING':
                    event.response.body = event.response.body.concat([
                        ['Result-Code', 'DIAMETER_SUCCESS'],
                        ['Origin-Host', serverHost],
                        ['Origin-Realm', serverRealm],
                        ['Auth-Application-Id', 'Diameter Credit Control'],
                        ['CC-Request-Number', 0]
                    ]);

                    console.log(JSON.parse(avpObj.subscriptionId.subscriptionIdData).csid);
                    console.log(LockedCredit);

                    var removeIndex = -1;
                    for ( var index in LockedCredit){

                        var dataParsed =JSON.parse(avpObj.subscriptionId.subscriptionIdData);
                        if(LockedCredit[index].csid == dataParsed.csid){
                            var request = {
                                body :{},
                                user :{}
                            };


                            request.body.Amount = LockedCredit[index].amount ;
                            request.user.iss = dataParsed.user;
                            request.body.Reason = 'Unused Locked Credit Released';
                            request.user.tenant = dataParsed.tenant;
                            request.user.company = dataParsed.company;
                            request.body.SessionId = dataParsed.csid;
                            walletHandler.ReleaseCreditFromCustomer(request, function(res){
                                console.log('################################################################');
                                if(JSON.parse(res).IsSuccess){
                                    console.log('Unused Locked Credit Released');
                                }
                                console.log('################################################################');


                            });

                            removeIndex = index;
                            break;
                        }
                        else if (index == LockedCredit.length -1){

                            var request = {
                                body :{},
                                user :{}
                            };


                            request.body.Amount = LockedCredit[index].amount ;
                            request.user.iss = dataParsed.user;
                            request.body.Reason = 'Unused Locked Credit Released';
                            request.user.tenant = dataParsed.tenant;
                            request.user.company = dataParsed.company;
                            request.body.SessionId = dataParsed.csid;
                            walletHandler.ReleaseCreditFromCustomer(request, function(res){
                                console.log('################################################################');
                                if(JSON.parse(res).IsSuccess){
                                    console.log('Unused Locked Credit Released');
                                }
                                console.log('################################################################');


                            });

                        }

                    }
                    if (removeIndex != -1){
                        LockedCredit.splice(removeIndex, 1);
                    }

                    var data = {dsid : avpObj.sessionId, csid : JSON.parse(avpObj.subscriptionId.subscriptionIdData).csid};
                    scheduler.callBilling(data).terminateCall(data, function(found){
                        console.log(found)
                    });

                    event.callback(event.response);
                    break;


                default:
                    console.log('Invalid CCR recived');
                    event.callback(event.response);
                    break;




            }
        }
        else if (avpObj.ccRequestType === 'INITIAL_REQUEST'|| avpObj.ccRequestType === 'UPDATE_REQUEST' ||avpObj.ccRequestType === 'TERMINATION_REQUEST' || avpObj.ccRequestType[0] === 'INITIAL_REQUEST'){
            console.log(typeof avpObj.ccRequestType);
            var arr = [];
            if(typeof avpObj.ccRequestType === 'object'){

                for( var obj in avpObj.ccRequestType ) {
                    arr.push(avpObj.ccRequestType[obj]);
                }
                console.log (arr);
            }
            else {
                arr.push(avpObj.ccRequestType)
            }
            console.log(arr[arr.length-1]);

            switch (arr[arr.length-1]){

                //Session Request
                case 'INITIAL_REQUEST':

                    var data = avpObj.subscriptionId.subscriptionIdData;

                    var req = {
                        body :{},
                        user :{}
                    };

                    var datapasred = JSON.parse(data);

                    req.body.Amount = 0 ;
                    req.user.iss = datapasred.user;
                    req.body.Reason = 'Per minute Call billeng credit reservation'
                    req.user.tenant = datapasred.tenant;
                    req.user.company = datapasred.company;
                    req.body.SessionId = datapasred.csid;
                    ratings.getRating(datapasred.to,datapasred.from, datapasred.provider, function(rating){


                        console.log(rating);
                        if(rating == -2){
                            event.response.body = event.response.body.concat([
                                ['Result-Code', 'DIAMETER_UNABLE_TO_DELIVER'],
                                ['Origin-Host', serverHost],
                                ['Origin-Realm', serverRealm],
                                ['Auth-Application-Id', 'Diameter Credit Control'],
                                ['CC-Request-Number', 0]
                            ]);
                            event.callback(event.response);
                        }
                        else{
                            req.body.Amount = rating *100 ;
                            walletHandler.LockCreditFromCustomer(req, function(found){

                                if(JSON.parse(found).IsSuccess){
                                    event.response.body = event.response.body.concat([
                                        ['Result-Code', 'DIAMETER_SUCCESS'],
                                        ['Origin-Host', serverHost],
                                        ['Origin-Realm', serverRealm],
                                        ['Auth-Application-Id', 'Diameter Credit Control'],
                                        ['CC-Request-Number', 0]
                                    ]);
                                    event.callback(event.response);
                                }
                                else {

                                    console.log(found);
                                    event.response.body = event.response.body.concat([
                                        ['Result-Code', 'DIAMETER_RESOURCES_EXCEEDED'],
                                        ['Origin-Host', serverHost],
                                        ['Origin-Realm', serverRealm],
                                        ['Auth-Application-Id', 'Diameter Credit Control'],
                                        ['CC-Request-Number', 0]
                                    ]);
                                    event.callback(event.response);

                                }

                            })
                        }


                    });


                    break;

                case 'UPDATE_REQUEST':

                    /*event.response.body = event.response.body.concat([
                     ['Result-Code', 'DIAMETER_SUCCESS'],
                     ['Origin-Host', serverHost],
                     ['Origin-Realm', serverRealm],
                     ['Auth-Application-Id', 'Diameter Credit Control'],
                     ['CC-Request-Number', 0]
                     ]);*/
                    var data = {dsid : avpObj.sessionId, csid : '123', userinfo : avpObj.subscriptionId.subscriptionIdData};
                    //console.log(avpObj)
                    scheduler.callBilling(data).initializeCall(data, function(found){
                        //console.log(found);

                        if(found && found.IsSuccess){
                            event.response.body = event.response.body.concat([
                                ['Result-Code', 'DIAMETER_SUCCESS'],
                                ['Origin-Host', serverHost],
                                ['Origin-Realm', serverRealm],
                                ['Auth-Application-Id', 'Diameter Credit Control'],
                                ['CC-Request-Number', 0]
                            ]);
                            event.callback(event.response);
                        }
                        else {

                            console.log(found);
                            event.response.body = event.response.body.concat([
                                ['Result-Code', 'DIAMETER_RESOURCES_EXCEEDED'],
                                ['Origin-Host', serverHost],
                                ['Origin-Realm', serverRealm],
                                ['Auth-Application-Id', 'Diameter Credit Control'],
                                ['CC-Request-Number', 0]
                            ]);
                            event.callback(event.response);

                        }
                    });
                    break;
                case 'TERMINATION_REQUEST':
                    event.response.body = event.response.body.concat([
                        ['Result-Code', 'DIAMETER_SUCCESS'],
                        ['Origin-Host', serverHost],
                        ['Origin-Realm', serverRealm],
                        ['Auth-Application-Id', 'Diameter Credit Control'],
                        ['CC-Request-Number', 0]
                    ]);

                    var data = {dsid : avpObj.sessionId, csid : '123'};
                    scheduler.callBilling(data).terminateCall(data, function(found){
                        console.log(found)
                    });

                    event.callback(event.response);
                    break;


                default:
                    console.log('Invalid CCR recived');
                    event.callback(event.response);

            }
        }





    }


}

function init(){
    server.listen(serverPort, serverHost);
    logger.info('Started DIAMETER server on ' + serverHost + ':' + serverPort);
}

exports.init = init;