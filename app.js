var restify = require('restify');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var config = require('config');
var jwt = require('restify-jwt');
var secret = require('dvp-common/Authentication/Secret.js');
var authorization = require('dvp-common/Authentication/Authorization.js');
var port = config.Host.port || 3000;
var host = config.Host.vdomain || 'localhost';

var ratings = require("./ratings");

var billing = require("./scheduler");
var diameter = require("./diameter");

/*var server = restify.createServer({
  name: "DVP Billing Service"
});



server.pre(restify.pre.userAgentConnection());
server.use(restify.bodyParser({ mapParams: false }));

restify.CORS.ALLOW_HEADERS.push('authorization');
server.use(restify.CORS());
server.use(restify.fullResponse());

server.use(jwt({secret: secret.Secret}));*/

//var msg = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');


//var token = format("Bearer {0}",config.Services.accessToken);
//////////////////////////////Cloud API/////////////////////////////////////////////////////

//server.post('/DVP/API/:version/Billing/updateRatings',authorization({resource:"billing", action:"write"}), ratings.updateRatings);

diameter.init();
logger.info("DVP-DiameterServer.main Server Started");




