self.addEventListener('message', function(event) {
    if (event.data.command == "setPush") {
        setTimeout(function sendNotification(){
            self.registration.showNotification('hangout', {body: 'Its time for your scheduled hangout'});
            console.log(event.data.hangoutLink);
        }, event.data.time);
    }
});
