importScripts('https://www.gstatic.com/firebasejs/4.4.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/4.4.0/firebase-messaging.js');

var fb = { // sigelton for firebase shit
    config: {
        apiKey: "AIzaSyDbhuiLqM7gfpy1VJNNzU3sKoupDnQwMBk",
        authDomain: "hangoutwithme-84b5a.firebaseapp.com",
        databaseURL: "https://hangoutwithme-84b5a.firebaseio.com",
        projectId: "hangoutwithme-84b5a",
        storageBucket: "hangoutwithme-84b5a.appspot.com",
        messagingSenderId: "413956929221"
    },
    init: function(){
        firebase.initializeApp(fb.config);
        fb.messaging = firebase.messaging();
        fb.messaging.setBackgroundMessageHandler(function onBackgroundMessage(payload){
            var options = {
                body: payload.data.body,
                click_action: 'https://www.google.com',
            };
            // TODO set onclick event
            return self.registration.showNotification(payload.data.title, options);
        });
    }
};

fb.init();
