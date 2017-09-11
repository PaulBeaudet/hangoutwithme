// hangoutwithme.js  ~ Copyright 2017 Paul Beaudet ~ MIT license
// Serves webpage routes to virtual lobbies for visitors to schedule a google hangout with owner of lobby
var path = require('path');       // cause its nice to know where things are
var bcrypt = {
    js: require('bcryptjs'), // u no, because storing passwords in plain text would be a better idea
    hash: function(password, doneHashing){
        bcrypt.js.hash(password, 10, function(error, hash){
            doneHashing(error, hash);
        });
    }
};

var hwm = { // Hangout with me
    createLobby: function(clientId){
        return function(data){
            var regex = /^[a-z]+$/;                                     // make sure there are only lowercase a-z to the last letter
            data.lobbyname = data.lobbyname.toLowerCase();              // lowercase input for potential customer, no need to be a hard ass
            var response = {
                duplicate: false,
                invalidName: false,
                idunnu: false
            };
            if(regex.test(data.lobbyname) && data.password ){               // given that only using lowercase letters and password was presented
                bcrypt.hash(data.password, function(ohhashit, hash){
                    if(ohhashit){ // failed to hash
                        response.idunnu = true;
                        socket.io.to(clientId).emit('madeLobby', response);
                    } else {
                        mongo.db[mongo.MAIN].collection(mongo.USERS).insertOne({// customer sign up, when an actual room is asigned
                                lobbyname: data.lobbyname.toLowerCase(),        // this unique feild defines routes that can be accessed on service
                                password: hash                                  // hash this thing
                            },
                            function onInsert(error, result){                   // what we do when mongo has done its thing
                                if(error){response.duplicate = true;}
                                else if(result){}                               // Best case scenerio, it stores a new lobby
                                else{response.idunnu = true;}
                                socket.io.to(clientId).emit('madeLobby', response);
                            }
                        );
                    }
                });
            } else {
                response.invalidName = true;
                socket.io.to(clientId).emit('madeLobby', response);    // you have to get whats intended, so put something good in
            }

        };
    },
    signin: function(clientId){
        return function(data){
            if(data.username && data.password){
                mongo.db[mongo.MAIN].collection(mongo.USERS).findOne({
                    lobbyname: data.username
                }, function foundUser(error, result){
                    var response = {good: false};
                    if(result){
                        bcrypt.js.compare(data.password, result.password, function(err, res){
                            if(res){ response.good = true;}
                            socket.io.to(clientId).emit('signInResponse', response);
                        });
                    } else {socket.io.to(clientId).emit('signInResponse', response);}

                });
            }
        };
    }
};


var route = {
    about: function(){  // should be used to convert signups
        return function(req, res){
            res.sendFile(path.join(__dirname+'/public/hangoutwithme.html'));
        };
    },
    findLobby: function(){
        return function(req, res){
            mongo.db[mongo.MAIN].collection(mongo.USERS).findOne(
                {lobbyname: req.url.substr(1).toLowerCase()},                   // slash not needed also we only understand lowercase letters to avoid squating
                mongo.bestCase(function foundARoom(){
                    res.sendFile(path.join(__dirname+'/public/lobby.html'));    // serve up their lobby if this is one of our customers
                }, function noRoom(){
                    res.sendFile(path.join(__dirname+'/public/notFound.html')); // visitor just malformed a url
                    mongo.log('lame request: '+req.url);                        // record this for later maybe will will have to redirect certain errors
                })
            );
        };
    }
};

var mongo = {
    MAIN: 'hangoutwithme', // name of key to call database by
    USERS: 'lobbyholders', // name of collection that stores customer data
    client: require('mongodb').MongoClient,
    db: {},                                            // object that contains connected databases
    connect: function(url, dbName, connected){         // url to db and what well call this db in case we want multiple
        mongo.client.connect(url, mongo.bestCase(function onConnect(db){
            mongo.db[dbName] = db;                     // assign database object to a persistent part of this sigleton
            connected();                               // callback for things dependent on this connection
        }, function noDb(){mongo.log('could not database?');}));        // not sure why this would happen
    },
    bestCase: function(success, noResult){                              // awful abstraction layer to be lazy
        return function handleWorstCaseThings(error, wantedThing){      // this is basically the same pattern for every mongo query callback
            if(error)           {mongo.log('not best case: ' + error);} // where betting on no errors bites you but shows up in db
            else if(wantedThing){if(success){success(wantedThing);}}    // return callback and pass wanted result
            else                {if(noResult){noResult();}}             // wanted thing was missing, oh noes
        };
    },
    log: function(msg){                                // persistent logs
        var timestamp = new Date();
        mongo.db[mongo.MAIN].collection('logs').insertOne({
                msg: msg,
                timestamp: timestamp.toUTCString()
            }, function onInsert(error){
            if(error){
                console.log('Mongo Log error: ' + error);
                console.log(msg);
            }
        });
    },
    init: function(mainDbUp){
        mongo.connect(process.env.MONGODB_URI, mongo.MAIN, function connected(){                        // connect to main database
            mongo.db[mongo.MAIN].collection(mongo.USERS).createIndex({"lobbyname": 1}, {unique: true}); // primary unique id feild for this collection
            mainDbUp();
        });
    }
};

var socket = {
    io: require('socket.io'),
    listen: function(server){
        socket.io = socket.io(server);
        socket.io.on('connection', function(client){
            client.on('createLobby', hwm.createLobby(client.id));
            client.on('signin', hwm.signin(client.id));
            client.on('disconnect', function(){});
        });
    }
};

var serve = {                                                // handles express server setup
    express: require('express'),                             // server framework library
    parse: require('body-parser'),                           // middleware to parse JSON bodies
    theSite: function(){                                     // method call to serve site
        serve.app = serve.express();                         // create famework object
        var http = require('http').Server(serve.app);        // http server for express framework
        serve.app.use(serve.parse.json());                   // support JSON bodies
        serve.app.use(serve.parse.urlencoded({extended: true})); // idk, something was broken maybe this fixed it
        serve.app.use('/static', serve.express.static(path.join(__dirname, 'public'))); // serve static files for site resources
        serve.router = serve.express.Router();               // create express router object to add routing events to
        serve.router.get('/', route.about());                // Quick about page for those that are lost
        serve.router.get('/*', route.findLobby());           // Default route goes to a user not found page
        serve.app.use(serve.router);                         // get express to user the routes we set
        return http;
    }
};

var http = serve.theSite();                                  // set express middleware and routes up
socket.listen(http);                                         // listen for socket io connections
mongo.init(function mainDbUp(){                              // set up connections for data persistence
    http.listen(process.env.PORT);                           // listen on specified PORT enviornment variable, when our main db is up
});
