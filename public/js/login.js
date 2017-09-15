// login.js ~ Copyright 2017 ~ Paul Beaudet MIT license
var socket = {
    io: io(),
    init: function(){
        socket.io.on('ack', login.app.ack);
    }
};

var login = {        // Hangout With Me
    app: new Vue({ // I can only imagine this framework is full of dank memes
        el: '#app',
        data: {
            lobbyname: '',
            password: '',
            issueMsg: '',
        },
        methods: {
            initSignin: function(){
                if(this.lobbyname && this.password){
                    socket.io.emit('signin', {lobby: this.lobbyname, password: this.password});
                } else {
                    this.issueMsg = 'Enter in the right information';
                }
            },
            ack: function(data){
                if(data.issue){
                    this.issueMsg = data.issue;
                } else {
                    window.location.href = '/admin/' + this.lobbyname + '/' + data.token;
                }
            }
        }
    })
};

socket.init();
