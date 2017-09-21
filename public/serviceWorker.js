// servicesWorker.js ~ Copyright 2017 ~ Paul Beaduet ~ MIT LICENSE

self.onnotificationclick = function(onClick) {onClick.notification.close();};

var openHangout = false; // store whether hangout is opened on notification click

self.addEventListener('message', function(event) {
    if (event.data.command == "setPush") {
        self.onnotificationclick = function(onClick) {
            onClick.notification.close();
            clients.openWindow(event.data.hangoutLink);
            openHangout = true;
        };
        var warningTime = 60000; // give a minute warning
        var currentTime = new Date().getTime();
        var timeToFire = event.data.appointment - currentTime;
        if(timeToFire > warningTime){timeToFire = timeToFire - warningTime;}
        else {warningTime = 0;} // given chat is comming up quickly
        console.log('version 1');
        setTimeout(function sendNotification(){
            if(warningTime){
                self.registration.showNotification('hangout', {body: event.data.hangoutLink});
            }
            setTimeout(function openHangout(){
                if(openHangout){}
                else{clients.openWindow(event.data.hangoutLink);} // just open hangout like a boss
            }, warningTime);
        }, timeToFire);// set to show on the dot x millis from now
    }
});
