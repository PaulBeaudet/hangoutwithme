// hangoutwithme.js  ~ Copyright 2017 Paul Beaudet ~ MIT license
// Serves webpage routes to virtual lobbies for visitors to schedule a google hangout with owner of lobby
var path = require('path');       // cause its nice to know where things are

var auth = { // methods for signing into a service
    bcrypt: require('bcryptjs'),
    createLobby: function(clientId){
        return function(data){
            var regex = /^[a-z]+$/;                                         // make sure there are only lowercase a-z to the last letter
            if(regex.test(data.lobbyname) && data.password ){               // given that only using lowercase letters and password was presented
                auth.bcrypt.hash(data.password, 10, function(ohhashit, hash){
                    if(hash){ // got hash for this password
                        mongo.db[mongo.MAIN].collection(mongo.LOBBY).insertOne({// customer sign up, when an actual room is asigned
                                lobbyname: data.lobbyname,                      // this unique feild defines routes that can be accessed on service
                                password: hash                                  // store hash I don't want to know your password
                            },
                            function onInsert(error, result){                   // what we do when mongo has done its thing
                                if(error)      {auth.ack('This name is probably taken', clientId);}
                                else if(result){auth.ack(false, clientId, data.lobbyname);} // Best case scenerio, it stores a new lobby
                                else           {auth.ack('Something went wrong, try again', clientId);}
                            }
                        );
                    }else{auth.ack('Hard time registering password', clientId);}
                });
            } else {auth.ack('Name is invalid, try a different one', clientId);}
        };
    },
    signin: function(clientId){
        return function(data){
            var credentialsSuck = 'You might have the wrong user name or password';
            mongo.db[mongo.MAIN].collection(mongo.LOBBY).findOne({lobbyname: data.lobby}, function foundUser(error, result){
                if(error){
                    auth.ack({issue: 'Error occured, try again'});
                } else if(result){
                    auth.bcrypt.compare(data.password, result.password, function(err, res){
                        if(res){
                            auth.ack(false, clientId, data.lobby); // first arg denotes no error
                        } else {
                            auth.ack(credentialsSuck, clientId);   // password is wrong
                        }
                    });
                } else {auth.ack(credentialsSuck, clientId);}      // username is wrong
            });
        };
    },
    ack: function(error, clientId, lobby){ // signals client to redirect to a one time url on singup or login
        if(error){ // cover pre-redirect issue - in this way only error needs to be passed
            socket.io.to(clientId).emit('ack', {issue: error});
        } else { // insert lobby and client id to open up one time login url
            var expiry = new Date().getTime() + 3600000; // current time plus an hour
            mongo.db[mongo.MAIN].collection(mongo.lOGIN).insertOne({token: clientId, lobbyname: lobby, expiry: expiry},
                function(error, result){
                    if(error){
                        socket.io.to(clientId).emit('ack', {issue: 'Issue with sign in, try again'});
                    } else if(result){
                        socket.io.to(clientId).emit('ack', {token: clientId});
                    } else {
                        socket.io.to(clientId).emit('ack', {issue: 'Something went wrong, try again'});
                    }
                }
            );
        }
    },
    refreshLinks: function(){ // Remove all links that have expired
        mongo.db[mongo.MAIN].collection(mongo.lOGIN).deleteMany(
            {expiry:{$lte: new Date().getTime()}}, // remove everything that has expired
            function(error, result){
                if(result){ //  number of removals would be result.result.n
                }else{mongo.log('issue refreshing links');}
            }
        );
    },
    checkLink: function(token, lobbyname, goodlink, badlink){
        mongo.db[mongo.MAIN].collection(mongo.lOGIN).findOne(
            {$and :[{token: token},{lobbyname: lobbyname},]}, // match based on username and maybe kinda unique token
            function(error, result){
                if(result){
                    if(result.expiry > new Date().getTime()){
                        goodlink();
                    } else { // given this link has expired remove it
                        badlink();
                        auth.refreshLinks(); // might be a good way to pace removing dead links
                    }
                } else {
                    badlink();
                    auth.refreshLinks(); // might be a good way to pace removing dead links
                    mongo.log('failed login for: ' + lobbyname + ' with ' + token + ' error: ' + error);
                }
            }
        );
    }
};

var admin = { // methods for managing a lobby
    saveSettings: function(clientId){
        return function(data){ // we are just going to pass through for now
            mongo.db[mongo.MAIN].collection(mongo.USER).update(
                {lobbyname: data.lobbyname},
                { $set: data }, // TODO validate in information
                {upsert: true},
                function(error, result){
                    var save = {d: false};
                    if(result){save.d = true;}
                    socket.io.to(clientId).emit('saveAck', save);
                }
            );
        };
    },
    getProfile: function(clientId){
        return function(data){ // idea here is you "might" be rendering private info
            auth.checkLink(data.token, data.lobbyname, function goodlink(){
                mongo.db[mongo.MAIN].collection(mongo.USER).findOne(
                    {lobbyname: data.lobbyname},
                    function gotProfile(error, result){
                        if(result){ // basically this is just a relay to the database
                            socket.io.to(clientId).emit('userInfo', result);
                        }
                    }
                );
            }, function badlink(){});
        };
    }
};

var lobby = { // methods for managing lobby usage
    getInfo: function(clientId){
        return function(data){
            mongo.db[mongo.MAIN].collection(mongo.USER).findOne(
                {lobbyname: data.lobbyname},
                function gotProfile(error, result){
                    if(result){ // TODO validate out private information
                        socket.io.to(clientId).emit('lobbyInfo', result);
                    }
                }
            );
        };
    }
};

var mongo = {
    MAIN: 'hangoutwithme', // name of key to call database by
    LOBBY: 'lobbys',       // name of collection that stores customer routes
    USER: 'profiles',      // name of collection that stores user data
    lOGIN: 'logins',       // persitent key/val store of lOGIN users (should prob use redis)
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
            mongo.db[mongo.MAIN].collection(mongo.LOBBY).createIndex({"lobbyname": 1}, {unique: true}); // primary unique id feild for this collection
            mainDbUp();
        });
    }
};

var socket = {
    io: require('socket.io'),
    listen: function(server){
        socket.io = socket.io(server);
        socket.io.on('connection', function(client){
            client.on('createLobby', auth.createLobby(client.id));
            client.on('signin', auth.signin(client.id));
            client.on('saveSettings', admin.saveSettings(client.id));
            client.on('getProfile', admin.getProfile(client.id));
            client.on('getLobbyInfo', lobby.getInfo(client.id));
            client.on('disconnect', function(){});
        });
    }
};

var route = {
    signup: function(){  // should be used to convert signups
        return function(req, res){
            res.sendFile(path.join(__dirname+'/public/signup.html'));
        };
    },
    login: function(){
        return function(req, res){
            res.sendFile(path.join(__dirname+'/public/login.html'));
        };
    },
    admin: function(){
        return function(req, res){
            auth.checkLink(req.params.token, req.params.lobby, function goodlink(){
                res.sendFile(path.join(__dirname+'/public/admin.html'));
            }, function badlink(){
                res.sendFile(path.join(__dirname+'/public/login.html'));
            });
        };
    },
    findLobby: function(){
        return function(req, res){
            mongo.db[mongo.MAIN].collection(mongo.LOBBY).findOne(
                {lobbyname: req.params.lobby.toLowerCase()},                    // slash not needed also we only understand lowercase letters to avoid squating
                mongo.bestCase(function foundARoom(){
                    res.sendFile(path.join(__dirname+'/public/lobby.html'));    // serve up their lobby if this is one of our customers
                }, function noRoom(){
                    res.sendFile(path.join(__dirname+'/public/notFound.html')); // visitor just malformed a url
                    mongo.log('lame request: '+req.param.lobby);                // record this for later maybe will will have to redirect certain errors
                })
            );
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
        serve.app.use(serve.parse.urlencoded({extended: true})); // idk, something was broken maybe this fixed it
        serve.app.use('/static', serve.express.static(path.join(__dirname, 'public'))); // serve static files for site resources
        serve.router = serve.express.Router();               // create express router object to add routing events to
        serve.router.get('/', route.signup());               // Quick about page for those that are lost
        serve.router.get('/signup', route.signup());         // Quick about page for those that are lost
        serve.router.get('/login', route.login());           // login page
        serve.router.get('/admin/:lobby/:token', route.admin()); // admin page
        serve.router.get('/user/:lobby', route.findLobby()); // Default route goes to a user not found page
        serve.app.use(serve.router);                         // get express to user the routes we set
        return http;
    }
};

var http = serve.theSite();                                  // set express middleware and routes up
socket.listen(http);                                         // listen for socket io connections
mongo.init(function mainDbUp(){                              // set up connections for data persistence
    http.listen(process.env.PORT);                           // listen on specified PORT enviornment variable, when our main db is up
});
