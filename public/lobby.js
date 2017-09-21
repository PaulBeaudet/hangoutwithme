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

var time = {
    COVERAGE: 24, // hours of coverage
    appointment: '',
    compare: {    // return true for available times
        nightToMorning: function(hour, start, end){return (hour <= start || hour >= end);},
        morningToNight: function(hour, start, end){return (hour >= start && hour <= end);},
    },
    getText: function(hour){ // convert military to civilian time
        if(hour){
            if(hour > 11){
                if(hour === 12){return '12PM';}
                else{return hour - 12 + 'PM';}
            } else {return hour + 'AM';}
        } else {return "12AM";}
    },
    availHours: function(appointments){ // takes array un millis timestampted appointments
        availabilityArray = [];
        for(var hour = 0; hour < time.COVERAGE; hour++){
            availabilityArray[hour] = true; // default everything to true
        }
        for(var appointment = 0; appointment < appointments.length; appointment++){
            var busyTime = new Date(appointments[appointment].time).getHours();
            if(busyTime > -1 && busyTime < time.COVERAGE){ // only with in the range of our time coverage
                availabilityArray[busyTime] = false;       // mark taken times
            }
        }
        return availabilityArray;
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
    init: function(appointment, hangout, backupPlan){ // have already setup the serviceWorker, but we ask now because its most relevent
        if(Notification){                               // given this browser is cool
            if(Notification.permission === "granted"){  // see if the user is already cool
                notifications.signal(appointment, hangout, backupPlan);
            } else {                                    // if they are not cool lets wait to see if they are
                Notification.requestPermission().then(function(result){
                    if(result === 'granted' || result === 'default'){ // default might be to grant permission
                        notifications.signal(appointment, hangout, backupPlan);
                    } else if (result === 'denied' && backupPlan){    // hope we have a back up plan if denied
                        backupPlan(time, hangoutLink);
                    } // cause otherwise this will just do nothing
                });
            }
        } else if(backupPlan){backupPlan(time, hangoutLink);}
    },
    signal: function(appointment, hangoutLink, backupPlan){
        if (navigator.serviceWorker.controller) {             // see if this browser is cool
            navigator.serviceWorker.controller.postMessage({
                'command': 'setPush',
                'hangoutLink': hangoutLink,
                'appointment': appointment
            });
        } else if(backupPlan){backupPlan(time, hangoutLink);}
    }
};

var lobby = {      // admin controls
    app: new Vue({ // I can only imagine this framework is full of dank memes
        el: '#app',
        data: {
            lobbyname: window.location.href.split('/')[4],
            openTimes: [],
            selectedTime: '',
            hasUserInfo: false,
            onloadTime: new Date(),      // intial time for constructing options READ ONLY
            who: '',
            confirmation: 'no hangout pending',
            hangout: '',                 // stores link to pending hangout
            makeAppoint: true,           // show schedule appointment
            showLink: false,             // shows hangout link if push notification fails
        },
        methods: {
            render: function(data){ // show availability information for this user
                var compare = 'morningToNight'; // default is available morning to night
                var avail = time.availHours(data.appointments);
                if(data.doNotDisturbStart > data.doNotDisturbEnd){compare = 'nightToMorning';}
                for(var hour = this.onloadTime.getHours() + 1; hour < time.COVERAGE; hour++){  // just for today
                    if(time.compare[compare](hour, data.doNotDisturbStart, data.doNotDisturbEnd) && avail[hour]){
                        this.openTimes.push({text:time.getText(hour), value:hour}); // can has, render something
                    }
                }
                this.hangout = data.reachMeUrl;
                this.hasUserInfo = true; // signal that view is ready to be rendered
            },
            appointment: function(){
                if(this.who && this.selectedTime){
                    time.appointment = new Date();  // create a date object based on current
                    time.appointment.setHours(this.selectedTime, 0, 0, 0); // set date object selcted hour
                    socket.io.emit('appointment', { // first lets just assume for today an work from there
                        lobbyname: this.lobbyname,
                        time: time.appointment.getTime(),
                        who: this.who
                    });
                } else {
                    this.confirmation = 'Have to know who you are and when';
                }
            },
            confirm: function(data){                                  // confirms appointment was made or not
                if(data.ok){                                          // given appointment was made
                    this.makeAppoint = false;                         // please dont make duplicates
                    this.confirmation = 'hangout pending';            // let user know shit is going down
                    var appointment = time.appointment.getTime();     // preformat in millis
                    notifications.init(appointment, this.hangout, lobby.app.backupPlan(appointment, this.hangout));
                } else {this.confirmation = 'something went wrong';}  // hopefully is only ever visible in source
            },
            backupPlan: function(appointmentTime, hangoutLink){ // given for whatever reason push is not possible
                return function plan(){                         // user would have to leave their browser window up
                    console.log('proceeding with backup plan');
                    var warningTime = 60000; // give a minute warning
                    var currentTime = new Date().getTime();
                    var timeToFire = event.data.appointment - currentTime;
                    if(timeToFire > warningTime){timeToFire = timeToFire - warningTime;}
                    else {warningTime = 0;} // given chat is comming up quickly
                    console.log('version 1');
                    setTimeout(function sendNotification(){
                        if(warningTime){this.showLink = true;}
                        setTimeout(function openHangout(){
                            if(this.showLink){window.open(hangoutLink);} // just open hangout like a boss
                        }, warningTime);
                    }, timeToFire);// set to show on the dot x millis from now
                };
            },
            openHangout: function(){
                this.showLink = false;
                window.open(this.hangout);
            }
        }
    })
};

socket.init();
serviceWorker.init();
