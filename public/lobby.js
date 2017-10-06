// lobby.js ~ Copyright 2017 ~ Paul Beaudet MIT license
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
        }).catch(setupAppointment);

        fb.messaging.onMessage(function gotAMessage(payload){
            console.log('onMessage: ' + JSON.stringify(payload, null, 4));
            lobby.app.confirmation = payload.data.body;
            // TODO just send a push notification regardless
        });
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
    forUTCTime: function(renderTime){
        var dateObj = new Date();
        var dayOfMonth = dateObj.getDate();                               // day of month is needed to get proper timestamp
        var year = dateObj.getFullYear();                                 // need to get timestamp
        for(var day = 0; day < time.COVERAGE; day++){                     // for days of coverage NOTE span not exact days
            var month = dateObj.getMonth();                               // make sure month can possibly iterate
            var hour = 0;
            var firstHour = false;
            if(day === 0){
                hour = dateObj.getUTCHours();
                firstHour = true;
            }                                                             // should only happen once to discount previous hour
            for(hour; hour < 24; hour++){                                 // for the course of the day
                dateObj.setUTCHours(hour);                                // day will never iterate if hour stays same
                var dayOfWeek = dateObj.getDay();
                var minute = 0;
                if(firstHour){
                    minute = time.getStartMinute(dateObj.getMinutes());
                    firstHour = false;
                }
                for(minute; minute < 60;  minute += time.OFFSET){ // handle minute offset
                    var utcTimeStamp = Date.UTC(year, month, dayOfMonth, hour, minute); // get millis from epoch UTC in loop
                    renderTime(dayOfWeek, hour, minute, utcTimeStamp);
                }
            }
            dayOfMonth++;                   // Going over last day of month should point at first day of next
            dateObj.setDate(dayOfMonth); // Iterate our date object as we render times, so month can turn over
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
                time.forUTCTime(function renderSomeThings(dayOfWeek, hour, minute, utcTimeStamp){
                    if(time.compare(AMtoPM, hour, data.doNotDisturbStart, data.doNotDisturbEnd) && !busyTime[utcTimeStamp]){
                        lobby.app.openTimes.push({
                            text: time.getText(dayOfWeek, hour, minute), // getText Converts to local time
                            value: utcTimeStamp,
                        }); // can has, render something
                    }
                });
                this.hangoutLink = data.hangoutLink;
                this.hasUserInfo = true; // signal that view is ready to be rendered
            },
            appointment: function(){                // what happens when you press make appointment button
                if(this.who && this.selectedTime){
                    fb.pushSetup(function setupAppointment(error, token){
                        if(error){this.confirmation = error;} // TODO make a more human readable message
                        else if(token){
                            time.appointment = new Date();    // create a date object based on current
                            time.appointment.setHours(this.selectedTime.hours, this.selectedTime.minutes, 0, 0); // set date object selcted hour
                            socket.io.emit('appointment', {   // first lets just assume for today an work from there
                                lobbyname: this.lobbyname,
                                time: this.selectedTime,
                                who: this.who,
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
