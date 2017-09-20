self.addEventListener('message', function(event) {
    if (event.data.command == "setPush") {
        var currentTime = new Date().getTime();
        setTimeout(function sendNotification(){
            self.registration.showNotification('hangout', {body: event.data.hangoutLink});
        }, event.data.appointment - currentTime);// set to show on the dot x millis from now
    }
});
