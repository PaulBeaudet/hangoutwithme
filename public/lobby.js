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

var serviceWorker = { // seperate js thread that can cache pages offline and run push notifications in background
    init: function(){ // set up service worker
        if('serviceWorker' in navigator && 'PushManager' in window){
            navigator.serviceWorker.register('/serviceWorker.js') // needs to be in root dir to be communicated w/
            .then(function(registration){                         // Registration was successful
            }).catch(function(error){                             // registration failed :(
            });
        } // NOTE: can only be communicated w/ next load after setup
    }
};

var notifications = {
    init: function(data, backupPlan){ // have already setup the serviceWorker, but we ask now because its most relevent
        if(Notification){                               // given this browser is cool
            if(Notification.permission === "granted"){  // see if the user is already cool
                notifications.signal(data, backupPlan);
            } else {                                    // if they are not cool lets wait to see if they are
                Notification.requestPermission().then(function(result){
                    if(result === 'granted' || result === 'default'){ // default might be to grant permission
                        notifications.signal(data, backupPlan);
                    } else if (result === 'denied' && backupPlan){    // hope we have a back up plan if denied
                        backupPlan();
                    }                                                 // cause otherwise this will just do nothing
                });
            }
        } else if(backupPlan){backupPlan();}                          // this browser has no notification support
    },
    signal: function(data, backupPlan){
        if (navigator.serviceWorker.controller) {             // see if this browser is cool with serviceWorkers
            navigator.serviceWorker.controller.postMessage({  // comunicate with worker (given it was registered)
                'command': 'setPush',
                'hangoutLink': data.hangoutLink,
                'appointment': data.appointment,
                'lobbyname': data.lobbyname
            });
        } else if(backupPlan){backupPlan();}
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
    availHours: function(appointments){ // takes array un millis timestampted appointments
        availabilityArray = []; // TODO make sure this convert utc to local time
        for(var hour = 0; hour < time.COVERAGE; hour++){
            availabilityArray[hour] = true; // default everything to true
        }
        for(var appointment = 0; appointment < appointments.length; appointment++){
            var busyTime = new Date(appointments[appointment].time).getUTCHours();
            if(busyTime > -1 && busyTime < time.COVERAGE){ // only with in the range of our time coverage
                availabilityArray[busyTime] = false;       // mark taken times
            }
        }
        return availabilityArray;
    },
    busyTimes: function(appointments){
        var availabilityObject = {};
        for(var appointment = 0; appointment < appointments.length; appointment++){
            availabilityObject[appointments[appointment].time] = true;
        }
        return availabilityObject;
    },
    forUTCTime: function(renderTime){
        var dateObj = new Date();
        var dayOfMonth = dateObj.getDate();                               // day of month is needed to get proper timestamp
        var year = dateObj.getFullYear();                                 // need to get timestamp
        for(var day = 0; day < time.COVERAGE; day++){                     // for days of coverage NOTE span not exact days
            var month = dateObj.getMonth();                               // make sure month can possibly iterate
            var hour = 0;
            if(day === 0){hour = dateObj.getUTCHours() + 1;}              // should only happen once to discount previous hour
            for(hour; hour < 24; hour++){                                 // for the course of the day
                dateObj.setUTCHours(hour);                                // day will never iterate if hour stays same
                var dayOfWeek = dateObj.getDay();
                for(var minute = 0; minute < 60;  minute += time.OFFSET){ // handle minute offset
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
                            text:time.getText(dayOfWeek, hour, minute), // getText Converts to local time
                            value: utcTimeStamp,
                        }); // can has, render something
                    }
                });
                this.hangoutLink = data.hangoutLink;
                this.hasUserInfo = true; // signal that view is ready to be rendered
            },
            appointment: function(){
                if(this.who && this.selectedTime){
                    time.appointment = new Date();  // create a date object based on current
                    time.appointment.setHours(this.selectedTime.hours, this.selectedTime.minutes, 0, 0); // set date object selcted hour
                    socket.io.emit('appointment', { // first lets just assume for today an work from there
                        lobbyname: this.lobbyname,
                        time: this.selectedTime,
                        who: this.who
                    });
                } else {this.confirmation = 'Have to know who you are and when';}
            },
            confirm: function(data){                                  // confirms appointment was made or not
                if(data.ok){                                          // given appointment was made
                    this.makeAppoint = false;                         // please dont make duplicates
                    this.confirmation = 'hangout pending';            // let user know shit is going down
                    var dataToPass = { // NOTE:may only be a relevent way to self notify if browser window is open
                        appointment: time.appointment.getTime(),      // preformat in local millis
                        hangoutLink: this.hangoutLink,
                        lobbyname: this.lobbyname
                    };
                    notifications.init(dataToPass, lobby.app.backupPlan(dataToPass));
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
serviceWorker.init();
