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
                var warningTime = 60000; // give a minute warning
                var currentTime = new Date().getTime();
                var timeToFire = event.data.appointment - currentTime;
                if(timeToFire > warningTime){timeToFire = timeToFire - warningTime;}
                else {warningTime = 0;} // given chat is comming up quickly
                setTimeout(function sendNotification(){
                    self.registration.showNotification('hangout', {
                        body: 'Click for hangout appointment with ' + event.data.lobbyname
                    });
                }, timeToFire);// set to show on the dot x millis from now
            }
        });
    },
};

fromClient.init();
