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

var fb = { // sigelton for firebase things
    config: {
        apiKey: "AIzaSyDbhuiLqM7gfpy1VJNNzU3sKoupDnQwMBk",
        authDomain: "hangoutwithme-84b5a.firebaseapp.com",
        databaseURL: "https://hangoutwithme-84b5a.firebaseio.com",
        projectId: "hangoutwithme-84b5a",
        storageBucket: "hangoutwithme-84b5a.appspot.com",
        messagingSenderId: "413956929221"
    },
    pushSetup: function(onResponse){
        firebase.initializeApp(fb.config);
        fb.messaging = firebase.messaging();
        fb.messaging.requestPermission().then(function onPermission(){
            return fb.messaging.getToken();            // only try to get token when we get permission
        }).then(function gotTheToken(token){           // first step is to get a token, server is going to store it anyhow
            console.log(token);
            onResponse(null, token);
        }).catch(onResponse);

        fb.messaging.onMessage(function gotAMessage(payload){
            console.log('onMessage: ' + JSON.stringify(payload, null, 4));
            lobby.app.confirmation = payload.data.body; // TODO just trigger a notification regardless
        });
    }
};

var time = {
    getUTCHour: function(localHour){ // returns utc hour from local hour
        var dateObj = new Date();
        dateObj.setHours(localHour, 0, 0, 0);
        return dateObj.getUTCHours();
    },
    getLocalHour: function(utcHour){
        var dateObj = new Date();
        dateObj.setUTCHours(utcHour, 0, 0, 0);
        return dateObj.getHours();
    }
};

var admin = {      // admin controls
    app: new Vue({ // I can only imagine this framework is full of dank memes
        el: '#app',
        data: {
            personalUse: false,
            workUse: false,
            dayTimes: TIMES_IN_THE_DAY,
            doNotDisturbStart: 7,
            doNotDisturbEnd: 22,
            hangoutLink: '',
            info: '',
            webPushOptIn: true, // not really much of an option, but at least the user has a heads up
        },
        methods: {
            saveSettings: function(){ // save settings to server side in mongo database
                if(this.webPushOptIn){
                    fb.pushSetup(function onResponse(error, token){
                        if(error){
                            admin.app.info = 'Sorry, currently hangoutwithme needs to use web push notifications to work. ' +
                            'This may be unsupported by your browser or notifications were rejected';
                        } else if(token){ // Profiles can only be saved if we have web push info
                            var profile = {
                                lobbyname: window.location.href.split('/')[4], // Should do something more inteligent to authenticate submistions
                                doNotDisturbStart: time.getUTCHour(admin.app.doNotDisturbStart),
                                doNotDisturbEnd: time.getUTCHour(admin.app.doNotDisturbEnd),
                                hangoutLink: admin.app.hangoutLink, // TODO u no..
                                fcmToken: token,
                                useCases:{},
                            };
                            if(admin.app.personalUse){profile.useCases.personal = admin.app.personalUse;}
                            if(admin.app.workUse){profile.useCases.work = admin.app.workUse;}
                            // TODO provide ability to add aditional use profiles
                            socket.io.emit('saveSettings', profile);
                        }
                    });
                }
            },
            saveAck: function(save){
                if(save.d){this.info = 'saved';}
                else{this.info = 'failed to save';}
            },
            update: function(data){
                if(data.doNotDisturbStart){this.doNotDisturbStart = time.getLocalHour(data.doNotDisturbStart);}
                if(data.doNotDisturbEnd){this.doNotDisturbEnd = time.getLocalHour(data.doNotDisturbEnd);}
                if(data.hangoutLink){this.hangoutLink = data.hangoutLink;}
                if(data.useCases){
                    if(data.useCases.work){this.workUse = true;}
                    if(data.useCases.personal){this.personalUse = true;}
                }
            }
        }
    })
};

socket.init();
