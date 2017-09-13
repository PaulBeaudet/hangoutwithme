// hangoutwithmeClient.js ~ Copyright 2017 ~ Paul Beaudet MIT license

var TIMES_IN_THE_DAY = [{text:'5AM', value:5},{text:'6AM', value:6},{text:'7AM', value:7},{text:'8AM', value:8},
                        {text:'9AM', value:9},{text:'10AM', value:10},{text:'11AM', value:11},{text:'12PM', value:12},
                        {text:'1PM', value:13},{text:'2PM', value:14},{text:'3PM', value:15},{text:'4PM', value:16},
                        {text:'5PM', value:17},{text:'6PM', value:18},{text:'7PM', value:19},{text:'8PM', value:20},
                        {text:'9PM', value:21},{text:'10PM', value:22},{text:'11PM', value:23},{text:'12AM', value:0},
                        {text:'1AM', value:1},{text:'2AM', value:2},{text:'3AM', value:3},{text:'4AM', value:4},];

var socket = {
    io: io(),
    init: function(hwmFunction){
        socket.io.on('madeLobby', hwm.app.madeLobby); // guess vue just assigns all properties to parent
        socket.io.on('signInResponse', hwm.app.signInResponse);
        socket.io.on('saveAck', hwm.app.saveAck);
    }
};

var hwm = {        // Hangout With Me
    app: new Vue({ // I can only imagine this framework is full of dank memes
        el: '#app',
        data: {
            signup: true,   // show sigup form and welcome info
            signin: false,  // show sign up view
            admin: false,   // show admin controls
            promocode: '',
            lobbyname: '',
            password: '',
            issueMsg: '',
            conversationTypes: [],
            dayTimes: TIMES_IN_THE_DAY,
            doNotDisturbStart: 22,
            doNotDisturbEnd: 7,
            saved: '',
        },
        methods: {
            createLobby: function(){
                if(this.promocode === 'dergs'){
                    socket.io.emit('createLobby', {
                        lobbyname: this.lobbyname,
                        password: this.password
                    });
                } else {
                    this.issueMsg = 'That is not valid access code';
                }
            },
            madeLobby: function(deets){
                if     (deets.duplicate)  {this.issueMsg = 'This page is taken';}
                else if(deets.invalidName){this.issueMsg = 'Try only using characters in name instead';}
                else if(deets.idunnu)     {this.issueMsg = 'something went wrong, try again';}
                else {
                    this.signup = false;    // turn off welcome view
                    this.admin = true;      // turn on admin view
                }
            },
            signinView: function(){
                this.signup = false;
                this.admin  = false;
                this.signin = true;
            },
            initSignin: function(){
                if(this.lobbyname && this.password){
                    socket.io.emit('signin', {username: this.lobbyname, password: this.password});
                } else {
                    this.issueMsg = 'Enter in the right information';
                }
            },
            signInResponse: function(data){
                if(data.good){
                    this.signup = false;
                    this.admin  = true;
                    this.signin = false;
                } else {
                    this.issueMsg = 'Wrong username or password';
                }
            },
            saveSettings: function(){ // save settings to server side in mongo database
                socket.io.emit('saveSettings', {
                    lobbyname: this.lobbyname, // we go this far, resuing this should be ok...
                    doNotDisturbStart: this.doNotDisturbStart,
                    doNotDisturbEnd: this.doNotDisturbEnd,
                    conversationTypes: this.conversationTypes
                });
            },
            saveAck: function(save){
                if(save.d){this.saved = 'saved';}
                else{this.saved = 'failed to save';}
            }
        }
    })
};

socket.init();
