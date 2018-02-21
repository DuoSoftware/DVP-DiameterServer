/**
 * Created by Kalana on 12/19/2016.
 */
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var libphonenumber = require('libphonenumber');
var config = require('config');
var request = require('request');
var format = require("stringformat");
var token = format("Bearer {0}",config.Services.accessToken);

var DBconn = require('./DbHandler');
var networkDictionary = require('./NetworkDictionary.json')

ratingTable = [];
function updateRatings(req, res, next){

    //console.log((req.body.ratings).length);
    //send table to
    if(req.body.ratings){

        var arr = req.body.ratings;

        for(var index in req.body.ratings){
            var keys = Object.keys(arr[index]);
            ratingTable.push( arr[index]);


            DBconn.CreateRatingRecord(keys[0], arr[index][keys[index]], function(err,obj){
                if(err){
                    console.log('ERROR');
                    console.log(err);
                    var jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", false, { "message" : "Data was not succesfully inserted/updated" });
                    res.end(jsonString);
                }
                else{
                    console.log('SUCCESS');
                    console.log(obj)
                }

            });
        }

    }
    else{
        //update from database
    }

    var jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, { "message" : "successfully updated" });
    res.end(jsonString);
}

function getRating(to, from, provider, callback){

    var numbererror = false;


    //console.log(ratingTable)

    try{
        var toNumberType = libphonenumber.phoneUtil.getNumberType(libphonenumber.phoneUtil.parseAndKeepRawInput(to, null));
        var fromNumberType = libphonenumber.phoneUtil.getNumberType(libphonenumber.phoneUtil.parseAndKeepRawInput(from, null));
        var toCountryCode = libphonenumber.phoneUtil.getRegionCodeForNumber(libphonenumber.phoneUtil.parseAndKeepRawInput(to, null));
        var fromCountryCode = libphonenumber.phoneUtil.getRegionCodeForNumber(libphonenumber.phoneUtil.parseAndKeepRawInput(from, null));
        var fromCountryDigit = libphonenumber.phoneUtil.getCountryCodeForRegion(fromCountryCode);
        var toCountryDigit = libphonenumber.phoneUtil.getCountryCodeForRegion(toCountryCode);
        var fromNationSigNum = libphonenumber.phoneUtil.getNationalSignificantNumber(libphonenumber.phoneUtil.parseAndKeepRawInput(from, null));
        var toNationSigNum = libphonenumber.phoneUtil.getNationalSignificantNumber(libphonenumber.phoneUtil.parseAndKeepRawInput(to, null));
        console.log('toCountryDigit '+toCountryDigit);
        console.log('toNationSigNum '+toNationSigNum);

    }
    catch (e){
        console.log("ERROR "+e);
        numbererror = true
    }


    var status = false;
    if(numbererror){

        callback(-2);
    }
    else if(ratingTable.length == 0){

        console.log('Rating table is empty, fetching data');
        DBconn.getRatingRecords(function(err,obj){
            //console.log(obj)
            //console.log((JSON.parse(obj).Result).length)
            var object = JSON.parse(obj).Result;

            for(var index in object){
                ratingTable.push(object[index]);
                if(index == object.length-1){
                    console.log('Data fetched');

                    //LOCAL CALL BILLING
                    if(toCountryCode == fromCountryCode){
                        console.log('This is a local call');

                        var sameNetwork = false;

                        try{

                            /*var carrierProvider = format("http://{0}/DVP/API/{1}/PaymentManager/Customer/Wallet/Credit", config.Services.carrierProviderHost, config.Services.carrierProviderVersion);

                            if (validator.isIP(config.Services.carrierProviderHost)) {
                                carrierProvider = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/Wallet/Credit", config.ServicescarrierProviderHost, config.Services.carrierProviderPort, config.Services.carrierProviderVersion);

                            }*/

                            //var carrierProvider = "http://104.236.197.119:8080/carrierProvider/";
                            var carrierProvider = config.Services.carrierProviderHost+"/carrierProvider/";

                            request({
                                method: "POST",
                                url: carrierProvider,
                                headers: {
                                    Authorization: token,
                                    companyinfo: "1:103",
                                    "Content-Type" : "application/x-www-form-urlencoded"
                                },
                                json: {
                                    "code": toCountryDigit,
                                    "number": toNationSigNum
                                }
                            }, function (_error, _response, datax) {




                                if(datax && datax.IsSuccess){
                                    if(datax.Carrier.toUpperCase() === provider.toUpperCase()){
                                        console.log(datax);
                                        sameNetwork = true;
                                    }

                                }
                                else if(datax && !datax.IsSuccess){
                                    console.log(datax);

                                }
                                else{
                                    //console.log(_error);
                                }

                                for(var i = 0; i<ratingTable.length; i++){


                                    for (var index in ratingTable[i].PaymentData){
                                        //console.log(ratingTable[i].PaymentData[index].Country)
                                        if(ratingTable[i].Provider == provider && ratingTable[i].PaymentData[index].Country === 'LOCAL' ){
                                            if(sameNetwork){
                                                console.log('Same Network Per Miniute rate is: ' +ratingTable[i].PaymentData[index].SameNetworkPerMin);
                                                callback(ratingTable[i].PaymentData[index].SameNetworkPerMin);
                                                status = true;
                                                break;
                                            }
                                            else if(toNumberType ==1){
                                                console.log('Mobile Per Miniute rate is: ' +ratingTable[i].PaymentData[index].MobilePerMin);
                                                callback(ratingTable[i].PaymentData[index].MobilePerMin);
                                                status = true;
                                                break;

                                            }
                                            else if(toNumberType ==0){

                                                console.log('Land Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                                                callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                                                status = true;
                                                break;
                                            }
                                            else{
                                                console.log('Other Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                                                callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                                                status = true;
                                                break;
                                            }

                                        }
                                    }

                                    if(i == ratingTable.length -1 && !status){
                                        callback(null)
                                    }

                                }


                            });

                        }
                        catch (e){
                            console.log(e)
                        }



                    }
                    else {
                        //TOLLFREE
                        if(toNumberType === 3) {

                            console.log('This is a Toll Free Call');

                            for(var i = 0; i<ratingTable.length; i++){
                                //console.log(to);
                                //console.log(ratingTable[i].AreaCode)

                                for(var index in ratingTable[i].PaymentData){
                                    //console.log(ratingTable[i].PaymentData[index].Country +' '+ toCountryCode);
                                    //console.log(ratingTable[i].Provider);

                                    if(ratingTable[i].Provider == provider && ratingTable[i].PaymentData[index].Country === toCountryCode ){

                                        if(fromNumberType ==1){
                                            console.log('Mobile Per Miniute rate is: ' +ratingTable[i].PaymentData[index].MobilePerMin);
                                            callback(ratingTable[i].PaymentData[index].MobilePerMin);
                                            status = true;
                                            break;

                                        }
                                        else if(fromNumberType ==0){

                                            console.log('Land Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                                            callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                                            status = true;
                                            break;
                                        }
                                        else{
                                            console.log('Other Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                                            callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                                            status = true;
                                            break;
                                        }

                                    }


                                }
                                if(i == ratingTable.length -1 && !status){
                                    callback(null)
                                }


                            }

                        }
                        else {

                            console.log('This is an Outbound IDD call');



                            for(var i = 0; i<ratingTable.length; i++){

                                for (var index in ratingTable[i].PaymentData){


                                    if(ratingTable[i].Provider == provider && ratingTable[i].PaymentData[index].Country === toCountryCode ){




                                        if(toNumberType ==1){
                                            console.log('Mobile Per Miniute rate is: ' +ratingTable[i].PaymentData[index].MobilePerMin);
                                            callback(ratingTable[i].PaymentData[index].MobilePerMin);
                                            status = true;
                                            break;

                                        }
                                        else if(toNumberType ==0){

                                            console.log('Land Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                                            callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                                            status = true;
                                            break;
                                        }
                                        else{
                                            console.log('Other Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                                            callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                                            status = true;
                                            break;
                                        }
                                    }
                                }
                                if(i == ratingTable.length -1 && !status){
                                    callback(null)
                                }

                            }

                        }
                        /*else if (fromNumberType === 0){

                         for(var i = 0; i<ratingTable.length; i++){

                         for (var index in ratingTable[i].PaymentData){
                         console.log(ratingTable[i].PaymentData[index].Country)
                         if(ratingTable[i].Provider == provider && ratingTable[i].PaymentData.Country === toCountryCode ){
                         if(toNumberType ==1){
                         console.log('Mobile Per Miniute rate is: ' +ratingTable[i].PaymentData[index].MobilePerMin);
                         callback(ratingTable[i].PaymentData[index].MobilePerMin);
                         break;

                         }
                         else if(toNumberType ==0){

                         console.log('Land Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                         callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                         break;
                         }
                         else{
                         console.log('Other Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                         callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                         break;
                         }
                         }
                         }

                         if(i == ratingTable.length -1){
                         ////callback(null)
                         }


                         }
                         }
                         else {
                         //callback(null)
                         }*/
                    }

                }

            }
        });
    }
    else if(ratingTable.length != 0){

        var toNumberType = libphonenumber.phoneUtil.getNumberType(libphonenumber.phoneUtil.parseAndKeepRawInput(to, null));
        console.log(toNumberType);

        if(toCountryCode == fromCountryCode){
            console.log('This is a local call');

            var sameNetwork = false;

            try{

                /*var carrierProvider = format("http://{0}/DVP/API/{1}/PaymentManager/Customer/Wallet/Credit", config.Services.carrierProviderHost, config.Services.carrierProviderVersion);

                 if (validator.isIP(config.Services.carrierProviderHost)) {
                 carrierProvider = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/Wallet/Credit", config.ServicescarrierProviderHost, config.Services.carrierProviderPort, config.Services.carrierProviderVersion);

                 }*/

                //var carrierProvider = "http://104.236.197.119:8080/carrierProvider/";
                var carrierProvider = config.Services.carrierProviderHost+"/carrierProvider/";

                request({
                    method: "POST",
                    url: carrierProvider,
                    headers: {
                        Authorization: token,
                        companyinfo: "1:103",
                        "Content-Type" : "application/x-www-form-urlencoded"
                    },
                    json: {
                        "code": toCountryDigit,
                        "number": toNationSigNum
                    }
                }, function (_error, _response, datax) {

                    if(datax && datax.IsSuccess){
                        if(datax.Carrier.toUpperCase() === provider.toUpperCase()){
                            console.log(datax);
                            sameNetwork = true;
                        }

                    }
                    else if(datax && !datax.IsSuccess){
                        console.log(datax);

                    }
                    else{
                        //console.log(_error);
                    }

                    for(var i = 0; i<ratingTable.length; i++){


                        for (var index in ratingTable[i].PaymentData){
                            //console.log(ratingTable[i].PaymentData[index].Country)
                            if(ratingTable[i].Provider == provider && ratingTable[i].PaymentData[index].Country === 'LOCAL' ){
                                if(sameNetwork){
                                    console.log('Same Network Per Miniute rate is: ' +ratingTable[i].PaymentData[index].SameNetworkPerMin);
                                    callback(ratingTable[i].PaymentData[index].SameNetworkPerMin);
                                    status = true;
                                    break;
                                }
                                else if(toNumberType ==1){
                                    console.log('Mobile Per Miniute rate is: ' +ratingTable[i].PaymentData[index].MobilePerMin);
                                    callback(ratingTable[i].PaymentData[index].MobilePerMin);
                                    status = true;
                                    break;

                                }
                                else if(toNumberType ==0){

                                    console.log('Land Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                                    callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                                    status = true;
                                    break;
                                }
                                else{
                                    console.log('Other Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                                    callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                                    status = true;
                                    break;
                                }

                            }
                        }

                        if(i == ratingTable.length -1 && !status){
                            callback(null)
                        }

                    }


                });

            }
            catch (e){
                console.log(e)
            }
        }
        else {
            //TOLLFREE
            if(toNumberType === 3) {

                for(var i = 0; i<ratingTable.length; i++){
                    //console.log(to);
                    //console.log(ratingTable[i].AreaCode)

                    for(var index in ratingTable[i].PaymentData){
                        //console.log(ratingTable[i].PaymentData[index].Country +' '+ toCountryCode);
                        //console.log(ratingTable[i].Provider);

                        if(ratingTable[i].Provider == provider && ratingTable[i].PaymentData[index].Country === toCountryCode ){

                            if(fromNumberType ==1){
                                console.log('Mobile Per Miniute rate is: ' +ratingTable[i].PaymentData[index].MobilePerMin);
                                callback(ratingTable[i].PaymentData[index].MobilePerMin);
                                status = true;
                                break;

                            }
                            else if(fromNumberType ==0){

                                console.log('Land Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                                callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                                status = true;
                                break;
                            }
                            else{
                                console.log('Other Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                                callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                                status = true;
                                break;
                            }

                        }
                    }
                    if(i == ratingTable.length -1 && !status){
                        callback(null)
                    }


                }

            }
            else {

                for(var i = 0; i<ratingTable.length; i++){

                    for (var index in ratingTable[i].PaymentData){
                        //console.log(ratingTable[i].PaymentData[index].Country)
                        if(ratingTable[i].Provider == provider && ratingTable[i].PaymentData[index].Country === toCountryCode ){
                            if(toNumberType ==1){
                                console.log('Mobile Per Miniute rate is: ' +ratingTable[i].PaymentData[index].MobilePerMin);
                                callback(ratingTable[i].PaymentData[index].MobilePerMin);
                                status = true;
                                break;

                            }
                            else if(toNumberType ==0){

                                console.log('Land Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                                callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                                status = true;
                                break;
                            }
                            else{
                                console.log('Other Per Miniute rate is: ' +ratingTable[i].PaymentData[index].LandlinePerMin);
                                callback(ratingTable[i].PaymentData[index].LandlinePerMin);
                                status = true;
                                break;
                            }
                        }
                    }
                    if(i == ratingTable.length -1 && !status){
                        callback(null)
                    }

                }

            }

        }
    }



}





exports.getRating = getRating;
exports.updateRatings = updateRatings;