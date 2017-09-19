// signup.js ~ Copyright 2017 ~ Paul Beaudet MIT license
var socket = {
    io: io(),
    init: function(){
        socket.io.on('ack', signup.app.ack); // guess vue just assigns all properties to parent
    }
};

var signup = {        // Hangout With Me
    app: new Vue({ // I can only imagine this framework is full of dank memes
        el: '#app',
        data: {
            promocode: '',
            lobbyname: '',
            password: '',
            issueMsg: '',
        },
        methods: {
            createLobby: function(){
                if(this.promocode === 'seesource'){ // Because if your looking at the code you should try it out
                    socket.io.emit('createLobby', {
                        lobbyname: this.lobbyname,
                        password: this.password
                    });
                } else { // lets do this client side its really not meant to be secure
                    this.issueMsg = 'That is not valid access code';
                }
            },
            ack: function(data){
                if(data.issue){
                    this.issueMsg = data.issue; // notify user if there is an issue with their request
                } else {
                    window.location.href = '/admin/' + this.lobbyname + '/' + data.token;
                }
            }
        }
    })
};

socket.init();
