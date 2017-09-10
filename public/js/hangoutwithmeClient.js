// hangoutwithmeClient.js ~ Copyright 2017 ~ Paul Beaudet MIT License

function doit(){
    console.log('doing it');
}

var socket = {
    io: io(),
    init: function(){
        socket.io.on('data', doit);
    },
};

socket.init();
