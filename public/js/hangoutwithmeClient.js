// hangoutwithmeClient.js ~ Copyright 2017 ~ Paul Beaudet MIT license

var socket = {
    io: io(),
    init: function(hwmFunction){
        socket.io.on('madeLobby', hwm.app.madeLobby); // guess vue just assigns all properties to parent
    }
};

var hwm = {        // Hangout With Me
    app: new Vue({ // I can only imagine this framework is full of dank memes
        el: '#app',
        data: {
            signup: true,   // show sigup form and welcome info
            admin: false,   // show admin controls
            adminText: 'Admin your page',
            promocode: '',
            lobbyname: '',
            password: '',
            issueMsg: '',
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
                    this.signup = false; // turn off welcome view
                    this.admin = true;   // turn on admin view
                }
            }
        }
    })
};

socket.init();
