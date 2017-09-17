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
        if(appointments.length){        // given that we have any appointments
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
            onloadTime: new Date(),
            who: '',
            confirmation: 'no hangout pending',
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
                if(data.ok){this.confirmation = 'hangout pending';}
                else{this.confirmation = 'something went wrong';}
            }
        }
    })
};

socket.init();
