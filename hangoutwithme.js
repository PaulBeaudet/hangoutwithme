// hangoutwithme.js  ~ Copyright 2017 Paul Beaudet ~ MIT license
// Serves webpage routes to virtual lobbies for visitors to schedule a google hangout with owner of lobby
var path = require('path'); // cause its nice to know where things are

var route = {
    userNotFound: function(){
        return function(req, res){
            res.sendFile(path.join(__dirname+'/notFound.html'));
        };
    },
    about: function(){
        return function(req, res){
            res.send('this is a site for setting up times to video chat with people you know or want to get to know');
        };
    }
};

var serve = {                                                // handles express server setup
    express: require('express'),                             // server framework library
    parse: require('body-parser'),                           // middleware to parse JSON bodies
    theSite: function (){                                    // methode call to serve site
        var app = serve.express();                           // create famework object
        var http = require('http').Server(app);              // http server for express framework
        app.use(serve.parse.json());                         // support JSON bodies
        app.use('/static', serve.express.static(path.join(__dirname, 'public'))); // serve static files for site resources
        var router = serve.express.Router();                 // create express router object to add routing events to
        router.get('/', route.about());                      // Quick about page for those that are lost
        router.get('/*', route.userNotFound());              // Default route goes to a user not found page
        app.use(router);                                     // get express to user the routes we set
        return http;
    }
};

var http = serve.theSite();                                  // set express middleware and routes up
http.listen(process.env.PORT);                               // listen on specified PORT enviornment variable
