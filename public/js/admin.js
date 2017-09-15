// admin.js ~ Copyright 2017 ~ Paul Beaudet MIT license
var TIMES_IN_THE_DAY = [{text:'5AM', value:5},{text:'6AM', value:6},{text:'7AM', value:7},{text:'8AM', value:8},
                        {text:'9AM', value:9},{text:'10AM', value:10},{text:'11AM', value:11},{text:'12PM', value:12},
                        {text:'1PM', value:13},{text:'2PM', value:14},{text:'3PM', value:15},{text:'4PM', value:16},
                        {text:'5PM', value:17},{text:'6PM', value:18},{text:'7PM', value:19},{text:'8PM', value:20},
                        {text:'9PM', value:21},{text:'10PM', value:22},{text:'11PM', value:23},{text:'12AM', value:0},
                        {text:'1AM', value:1},{text:'2AM', value:2},{text:'3AM', value:3},{text:'4AM', value:4},];

var socket = {
    io: io(),
    init: function(){
        socket.io.on('saveAck', admin.app.saveAck); // response to saving profile information
        socket.io.on('userInfo', admin.app.update); // response to get profile
        socket.io.emit('getProfile', { // probably a bad way to do it, really dont want to template
            lobbyname: window.location.href.split('/')[4],
            token: window.location.href.split('/')[5]
        }); // mainly this is a timing thing, one would have to redefine a correct token and lobby name before this loads
    }
};

var admin = {      // admin controls
    app: new Vue({ // I can only imagine this framework is full of dank memes
        el: '#app',
        data: {
            personalUse: false,
            workUse: false,
            dayTimes: TIMES_IN_THE_DAY,
            doNotDisturbStart: 22,
            doNotDisturbEnd: 7,
            saved: '',
        },
        methods: {
            saveSettings: function(){ // save settings to server side in mongo database
                var profile = {
                    lobbyname: window.location.href.split('/')[4], // Should do something more inteligent to authenticate submistions
                    doNotDisturbStart: this.doNotDisturbStart,
                    doNotDisturbEnd: this.doNotDisturbEnd,
                    useCases:{},
                };
                if(this.personalUse){profile.useCases.personal = this.personalUse;}
                if(this.workUse){profile.useCases.work = this.workUse;}
                // TODO provide ability to add aditional use profiles
                socket.io.emit('saveSettings', profile);
            },
            saveAck: function(save){
                if(save.d){this.saved = 'saved';}
                else{this.saved = 'failed to save';}
            },
            update: function(data){
                if(data.doNotDisturbStart){this.doNotDisturbStart = data.doNotDisturbStart;}
                if(data.doNotDisturbEnd){this.doNotDisturbEnd = data.doNotDisturbEnd;}
                if(data.useCases){
                    if(data.useCases.work){this.workUse = true;}
                    if(data.useCases.personal){this.personalUse = true;}
                }
            }
        }
    })
};

socket.init();
