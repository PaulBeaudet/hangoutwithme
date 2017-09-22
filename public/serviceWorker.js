// servicesWorker.js ~ Copyright 2017 ~ Paul Beaduet ~ MIT LICENSE

var fromClient = {      // comunications that come from client
    openHangout: false, // store whether hangout is opened on notification click
    init: function(){
        self.onnotificationclick = function(onClick) {onClick.notification.close();};
        self.addEventListener('message', function(event) {
            if (event.data.command == "setPush") {
                self.onnotificationclick = function(onClick) {
                    onClick.notification.close();
                    clients.openWindow(event.data.hangoutLink); // can only do this within this timeframe
                };
                var warningTime = 15000; // give a minute warning
                var currentTime = new Date().getTime();
                var timeToFire = 30000;
                // var timeToFire = event.data.appointment - currentTime;
                if(timeToFire > warningTime){timeToFire = timeToFire - warningTime;}
                else {warningTime = 0;} // given chat is comming up quickly
                setTimeout(function sendNotification(){
                    self.registration.showNotification('hangout', {body: event.data.hangoutLink});
                }, timeToFire);// set to show on the dot x millis from now
            }
        });
    },
};

/*var socket = { // Communications that come from server
    io: io(),  // hopefully this pulls dependancies from the same server
    init: function(){
        socket.io.on('notification', socket.notify());
    },
    notify: function(){
        return function(data){
            self.registration.showNotification(data.title, {body: data.body});
        };
    }
}; */

fromClient.init();
//socket.init();
