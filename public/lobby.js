// lobby.js ~ Copyright 2017 ~ Paul Beaudet MIT license
var MILLIS_OFFSET = 900000;       // 15 minute offset in between displayed times
var MILLIS_COVERAGE = 172800000;  // Coverage of future times that can be scheduled

var socket = {
    io: io(),
    init: function(){
        socket.io.on('lobbyInfo', lobby.app.render);
        socket.io.on('confirm', lobby.app.confirm);
        socket.io.emit('getLobbyInfo', {
            lobbyname: window.location.href.split('/')[4]
        });
    }
};

var fb = { // sigelton for firebase shit
    config: {
        apiKey: "AIzaSyDbhuiLqM7gfpy1VJNNzU3sKoupDnQwMBk",
        authDomain: "hangoutwithme-84b5a.firebaseapp.com",
        databaseURL: "https://hangoutwithme-84b5a.firebaseio.com",
        projectId: "hangoutwithme-84b5a",
        storageBucket: "hangoutwithme-84b5a.appspot.com",
        messagingSenderId: "413956929221"
    },
    pushSetup: function(setupAppointment){
        firebase.initializeApp(fb.config);
        fb.messaging = firebase.messaging();
        fb.messaging.requestPermission().then(function onPermission(){
            return fb.messaging.getToken();            // only try to get token when we get permission
        }).then(function gotTheToken(token){           // first step is to get a token, server is going to store it anyhow
            setupAppointment(null, token);
            fb.messaging.onMessage(function gotAMessage(payload){
                var notification = new Notification(payload.data.title, {body: payload.data.body});
                notification.onclick = function(){
                    notification.close();                   // close, because click action should open a window
                    window.open(payload.data.click_action); // open hangout link
                };
            });
        }).catch(setupAppointment);
    }
};

                  // actions should only ever be intiated server side via utc because you shouldn't trust a client clock
var time = {      // idea is everything on server is utc, on client time gets displayed in local convention
    COVERAGE: 2,  // days of coverage
    OFFSET: 15,   // mintute intervals that can be scheduled
    DAYMAP: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], // Array ordered as days of week are numbered
    compare: function(AMtoPM, hour, start, end){ // determine what type of comparison to make
        if(AMtoPM){
            if(hour >= start && hour < end){return false;} // Messed with this for 3 hours, still looks wrong, but it works
            return true;
        } else {return hour < start && hour >= end;} // returns true for times outside of do not disturb
    },
    getText: function(dayOfWeek, hour, minute){ // convert military UTC time to local civilian time to show user
        var dateObj = new Date();
        dateObj.setUTCHours(hour, minute, 0, 0);// get utc date object based on hour and minute
        minute = dateObj.getMinutes(minute);    // find local minute based on utc
        hour = dateObj.getHours(hour);          // find local hour based on utc
        var minRender = '00';
        if(minute > 9){minRender = minute;}
        else if(minute){minRender = '0' + minute;}
        if(hour){
            if(hour > 11){
                if(hour === 12){return time.DAYMAP[dayOfWeek]+' 12:'+minRender+'PM';}            // 12 is 12pm
                else           {return time.DAYMAP[dayOfWeek]+' '+(hour-12)+':'+minRender+'PM';} // other pm times have conversion
            } else             {return time.DAYMAP[dayOfWeek]+' '+hour+':'+minRender+'AM';}      // am times are the same
        } else                 {return time.DAYMAP[dayOfWeek]+' 12'+minRender+'AM';}             // 0 converts to 12am
    },
    busyTimes: function(appointments){ // Is it weird that this works?
        var availabilityObject = {};
        for(var appointment = 0; appointment < appointments.length; appointment++){
            availabilityObject[appointments[appointment].time] = true;
        }
        return availabilityObject;
    },
    getStartMinute: function(currentMinute){
        for(var minute = time.OFFSET; minute < 60; minute+=time.OFFSET){
            if(minute > currentMinute){return minute;}
        }
    },
    forTimes: function(renderTime){
        var dateObj = new Date();
        var currentMin = dateObj.getMinutes();
        var offsetInMin = MILLIS_OFFSET / 1000 / 60; // given offset is more than 59 seconds
        for(var validStartingPoint = 0; validStartingPoint < 60; validStartingPoint+= offsetInMin){ // for every offset in hour
            if(currentMin >= validStartingPoint && currentMin < validStartingPoint + offsetInMin){
                dateObj.setMinutes(validStartingPoint + offsetInMin, 0, 0); // loose change plus a solid offset
                break; // what important is your always seting time into future
            }
        }
        var lastAvailTime = dateObj.getTime(); // get millis from epoch of previous offset time // second part makes it hard
        for(var offset = MILLIS_OFFSET; offset < MILLIS_COVERAGE; offset+=MILLIS_OFFSET){ // iterate through coverage points
            var render = lastAvailTime + offset;
            renderTime(render);
        }
    }
};

var lobby = {      // admin controls
    app: new Vue({ // I can only imagine this framework is full of dank memes
        el: '#app',
        data: {
            lobbyname: window.location.href.split('/')[4],
            openTimes: [],
            selectedTime: 0,
            selectedMinutes: 0,
            hasUserInfo: false,
            who: '',
            confirmation: 'no hangout pending',
            hangoutLink: '',             // stores link to pending hangout
            makeAppoint: true,           // show schedule appointment
            showLink: false,             // shows hangout link if push notification fails
        },
        methods: {
            render: function(data){ // show availability information for this user
                var currentDate = new Date();
                var AMtoPM = true; // default is available morning to night
                // var avail = time.availHours(data.appointments);
                var busyTime = time.busyTimes(data.appointments);
                if(data.doNotDisturbStart > data.doNotDisturbEnd){AMtoPM = false;}
                time.forTimes(function renderSomeThings(timeStamp){
                    var dateObj = new Date(timeStamp);
                    if(time.compare(AMtoPM, dateObj.getHours(), data.doNotDisturbStart, data.doNotDisturbEnd) && !busyTime[timeStamp]){
                        lobby.app.openTimes.push({
                            // text: time.getText(dayOfWeek, hour, minute), // getText Converts to local time
                            text: dateObj.toLocaleString(),
                            value: timeStamp,
                        }); // can has, render something
                    }
                });
                this.hangoutLink = data.hangoutLink;
                this.hasUserInfo = true; // signal that view is ready to be rendered
            },
            appointment: function(){                // what happens when you press make appointment button
                if(this.who && this.selectedTime){
                    fb.pushSetup(function setupAppointment(error, token){
                        if(error){lobby.app.confirmation = error;} // TODO make a more human readable message
                        else if(token){
                            time.appointment = new Date();    // create a date object based on current
                            time.appointment.setHours(lobby.app.selectedTime.hours, lobby.app.selectedTime.minutes, 0, 0); // set date object selcted hour
                            socket.io.emit('appointment', {   // first lets just assume for today an work from there
                                lobbyname: lobby.app.lobbyname,
                                time: lobby.app.selectedTime,
                                who: lobby.app.who,
                                fcmToken: token
                            });
                        }
                    });                          // Set up client side firebase library (Ask for notification permissions)
                } else {this.confirmation = 'Have to know who you are and when';}
            },
            confirm: function(data){                                  // confirms appointment was made or not
                if(data.ok){                                          // given appointment was made
                    this.makeAppoint = false;                         // please dont make duplicates
                    this.confirmation = 'hangout pending';            // let user know shit is going down
                } else {this.confirmation = 'something went wrong';}  // hopefully is only ever visible in source
            },
            backupPlan: function(data){                 // given for whatever reason push is not possible
                return function plan(){                 // user would have to leave their browser window up
                    var warningTime = 60000; // give a minute warning
                    var currentTime = new Date().getTime();
                    var timeToFire = data.appointment - currentTime;
                    if(timeToFire > warningTime){timeToFire = timeToFire - warningTime;}
                    else {warningTime = 0;} // given chat is comming up quickly
                    setTimeout(function sendNotification(){
                        if(warningTime){this.showLink = true;}
                        setTimeout(function openHangout(){
                            if(this.showLink){window.open(data.hangoutLink);} // just open hangout like a boss
                        }, warningTime);
                    }, timeToFire);// set to show on the dot x millis from now
                };
            },
            openHangout: function(){
                this.showLink = false;
                window.open(this.hangoutLink);
            }
        }
    })
};

socket.init();
