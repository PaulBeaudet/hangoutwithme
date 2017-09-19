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
    compare: {    // return true for available times
        nightToMorning: function(hour, start, end){return (hour <= start || hour > end);},
        morningToNight: function(hour, start, end){return (hour >= start && hour < end);},
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

var notifications = {
    init: function(time, hangout){
        if(Notification){    // maybe set up notification here
            if(Notification.permission === "granted"){
                console.log('permission already granted');
                notifications.createPushServiceWorker();
            } else {
                Notification.requestPermission().then(function(result){
                    if(result === 'granted'){
                        notifications.createPushServiceWorker();
                    } else if (result === 'denied'){
                        console.log('denied!');
                    } else if (result === 'default'){
                        console.log('ignored!'); // actually the default setting might be allow
                    }
                });
            }

        } else { alert('Desktop notifications not available in your browser. Try Chromium.');}
    },
    appointment: function(msg, hangout){
        var notification = new Notification('Time to hangout', {icon: '/static/wooper.gif',body: msg,});
        notification.onclick = function(){window.open(hangout);};
    },
    createPushServiceWorker: function(time, hangoutLink){
        if('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.register('/serviceWorker.js')
            .then(function(registration) {                  // Registration was successful
                notifications.signal(30000, 'wat');         // get need information to service worker
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }).catch(function(error) {                      // registration failed :(
                console.log('ServiceWorker registration failed: ', error);
            });
        } else {console.log('doa gone fucked up');}
    },
    signal: function(time, hangoutLink){
        console.log(navigator.serviceWorker.controller);
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                'command': 'setPush',
                'hangoutLink': hangoutLink,
                'time': time
            });
        } else {console.log("No active ServiceWorker");}
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
            onloadTime: new Date(), // maybe want to watch out for how this is being used
            who: '',
            confirmation: 'no hangout pending',
            hangout: '',
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
                    this.onloadTime.setHours(this.selectedTime);
                    socket.io.emit('appointment', { // first lets just assume for today an work from there
                        lobbyname: this.lobbyname,
                        time: this.onloadTime.getTime(),
                        who: this.who
                    });
                } else {
                    this.confirmation = 'Have to know who you are and when';
                }
            },
            confirm: function(data){  // confirms appointment was made or not
                if(data.ok){
                    this.confirmation = 'hangout pending';
                    var timeToHangout = this.onloadTime - new Date().getTime();
                    setTimeout(lobby.app.notify, timeToHangout);
                    notifications.init();
                } else {this.confirmation = 'something went wrong';}
            },
            notify: function(){
                this.confirmation = 'join this hangout! -> ' + this.hangout;
            }
        }
    })
};

socket.init();
