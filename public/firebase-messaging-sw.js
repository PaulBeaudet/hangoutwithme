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
            fb.link = payload.data.click_action;
            return self.registration.showNotification(payload.data.title, payload.data);
        });
        self.addEventListener('notificationclick', function onNotification(event){
            event.notification.close();  // close notifications whene its clicked on
            clients.openWindow(fb.link); // And open hangout link
        });
    }
};

fb.init();
