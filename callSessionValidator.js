/**
 * Created by dinusha on 12/22/2016.
 */
var redis = require("ioredis");
var Config = require('config');
var config = require('config')

var redisip = config.Redis.ip;
var redisport = config.Redis.port;
var redispass = config.Redis.password;
var redismode = config.Redis.mode;

var redisSetting =  {
    port:redisport,
    host:redisip,
    family: 4,
    db: 0,
    password: redispass,
    retryStrategy: function (times) {
        return Math.min(times * 50, 2000);
    },
    reconnectOnError: function (err) {

        return true;
    }
};

if(redismode == 'sentinel'){

    if(config.Redis.sentinels && config.Redis.sentinels.hosts && config.Redis.sentinels.port && config.Redis.sentinels.name){
        var sentinelHosts = config.Redis.sentinels.hosts.split(',');
        if(Array.isArray(sentinelHosts) && sentinelHosts.length > 2){
            var sentinelConnections = [];

            sentinelHosts.forEach(function(item){

                sentinelConnections.push({host: item, port:config.Redis.sentinels.port})

            });

            redisSetting = {
                sentinels:sentinelConnections,
                name: config.Redis.sentinels.name,
                password: redispass
            }

        }else{

            console.log("No enough sentinel servers found - DASHBOARD REDIS");
        }

    }
}

var client = undefined;

if(redismode != "cluster"){
    client = new redis(redisSetting);
}
else{

    var redisHosts = redisip.split(",");
    if(Array.isArray(redisHosts))
    {
        redisSetting = [];
        redisHosts.forEach(function(item){
            redisSetting.push({
                host: item,
                port: redisport,
                family: 4,
                password: redispass});
        });

        client = new redis.Cluster([redisSetting]);

    }
    else
    {
        client = new redis(redisSetting);
    }
}


client.on('error', function(msg){

});



var getCallSession = function(sessionId, callback)
{

    console.log(client.status)
    try
    {
        if(client.status==='ready')
        {
            client.hgetall(sessionId, function (err, hashObj)
            {
                callback(err, hashObj);
            });
        }
        else
        {
            callback(new Error('Redis Client Disconnected'), null);
        }
    }
    catch(ex)
    {
        callback(ex, null);
    }
};


client.on('error', function(msg)
{

});

module.exports.getCallSession = getCallSession;
