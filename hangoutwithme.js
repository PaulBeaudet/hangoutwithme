// hangoutwithme.js  ~ Copyright 2017 Paul Beaudet ~ MIT license
// Serves webpage routes to virtual lobbies for visitors to schedule a google hangout with owner of lobby
var path = require('path'); // cause its nice to know where things are

var lobby = {
    room: [],             // Array of active lobbies that can be visited
    create: function(lobbyname, onCreate){
        for(var i = 0; i < lobby.room.length; i++){
            if(lobbyname === lobby.room[i]){
                if(onCreate){onCreate('Room taken');} // error name taken case
                return false;
            }
        }
        lobby.room.push('/'+lobbyname);
        if(onCreate){onCreate();}                     // callback success case with no error
        return true;
    }
};

var route = {
    about: function(){
        return function(req, res){
            res.sendFile(path.join(__dirname+'/public/welcome.html'));
        };
    },
    findUser: function(){
        return function(req, res){
            for(var i = 0; i < lobby.room.length; i++){
                if(lobby.room[i] === req.url){
                    res.sendFile(path.join(__dirname+'/public/lobby.html'));
                    return;
                }
            }
            res.sendFile(path.join(__dirname+'/public/notFound.html'));      // if a user can not be found
        };
    },
    getALobby: function(){
        return function(req, res){
            console.log('creating room ' + req.body.lobbyname);
            lobby.create(req.body.lobbyname, function onCreate(error){
                if(error){
                    res.send(error);
                } else {
                    res.sendFile(path.join(__dirname+'/public/admin.html'));
                }
            });
        };
    }
};

var serve = {                                                // handles express server setup
    express: require('express'),                             // server framework library
    parse: require('body-parser'),                           // middleware to parse JSON bodies
    theSite: function(){                                     // method call to serve site
        serve.app = serve.express();                         // create famework object
        var http = require('http').Server(serve.app);        // http server for express framework
        serve.app.use(serve.parse.json());                   // support JSON bodies
        serve.app.use(serve.parse.urlencoded({
            extended: true
        }));
        serve.app.use('/static', serve.express.static(path.join(__dirname, 'public'))); // serve static files for site resources
        serve.router = serve.express.Router();               // create express router object to add routing events to
        serve.router.get('/', route.about());                // Quick about page for those that are lost
        serve.router.post('/', route.getALobby());           // gives a user a lobby if they give us good info
        serve.router.get('/*', route.findUser());            // Default route goes to a user not found page
        serve.app.use(serve.router);                         // get express to user the routes we set
        return http;
    }
};

var http = serve.theSite();                                  // set express middleware and routes up
http.listen(process.env.PORT);                               // listen on specified PORT enviornment variable
