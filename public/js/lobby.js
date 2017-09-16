// lobby.js ~ Copyright 2017 ~ Paul Beaudet MIT license
var socket = {
    io: io(),
    init: function(){
        socket.io.on('lobbyInfo', lobby.app.render);
        socket.io.emit('getLobbyInfo', {
            lobbyname: window.location.href.split('/')[4]
        });
    }
};

var time = {
    compare: { // return true for available times
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
        },
        methods: {
            render: function(data){ // show availability information for this user
                var compare = 'morningToNight'; // default is available morning to night
                if(data.doNotDisturbStart > data.doNotDisturbEnd){compare = 'nightToMorning';}
                for(var hour = 0; hour < 24; hour++){ // we are talking about today so enter start time
                    if(time.compare[compare](hour, data.doNotDisturbStart, data.doNotDisturbEnd)){
                        this.openTimes.push({text:time.getText(hour), value:hour}); // can has, render something
                    }
                }
                this.hasUserInfo = true; // signal that view is ready to be rendered
            },
            submitAppointment: function(){
                console.log(this.selectedTime); // store an appointment
            }
        }
    })
};

socket.init();
