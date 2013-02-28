#!/usr/bin/env node
var io = require('socket.io').listen(4251);

function OGame(id) {
    var that = this;

    this.onGame = 'B';

    this.room = id;

    this.Players = [];

    this.Playground = {
	map: [ [0, 0, 0], [0, 0, 0], [0, 0, 0] ],

	getMap: function() {
	    return this.map;
	},

	update: function(user_id, square) {
	    console.log('Update square['+square.y+', '+square.x+'] by user['+user_id+'] actually marked['+this.map[square.y][square.x]+'] user onGame['+that.onGame+']');
	    if (user_id != that.onGame) {
		io.sockets.in(this.room).emit('cheat', { user_id: user_id, square: square, feedback: 'the user '+user_id+' tried to play more than 1 time in its turn!' });
		return false;
	    }
		
	    if (this.map[square.y][square.x]) { 
		io.sockets.in(this.room).emit('cheat', { user_id: user_id, square: square, feedback: 'the user '+user_id+' trie to steale a square already marked by his challenger!' });
		return false;
	    }

	    this.map[square.y][square.x] = user_id;
	    that.onGame = (that.onGame == 'A' ? 'B' : 'A');
	    io.sockets.in(this.room).emit('play', { user_id: user_id, square: square });
	    return true;
	}
    };

    this.Clock = {
	delay: 10,
	engine: 0,
		
	start: function() {
	    this.delay = 10;
	    var self = this;
	    this.engine = setInterval(function() {
		if (!self.delay) {
		    //that.Players[that.onGame].username
		    io.sockets.in(self.room).emit('victory', { user_id: that.onGame, feedback: 'The user '+(that.onGame == 'A' ? 'B' : 'A')+' has consumed all his time.' });
		    self.stop();
		}
		self.delay--;
	    }, 1000);	    
	},

	stop: function() {
	    clearInterval(this.engine);
	},
	
	reset: function(room, socket) {
	    this.delay = 10;
	},
	
    };
    
    this.getRoom = function() {
	return this.room;
    };

    this.setRoom = function(room) {
	this.room = room;
    };

    this.getNbPlayers = function() {
	return this.Players.length;
    };

    this.addPlayer = function(Player) {
	if (this.Players.lenght == 2)
	    return false;

	this.Players.push(Player);
	return true;
    };

    this.checkVictory = function(user_id, square, callback) {
	console.log('Checking victory concernant le user['+user_id+'] de la room['+this.room+'] après avoir joué la case['+square.y+', '+square.x+']');
	var map = this.Playground.getMap();
	console.log('map['+map+']');

	if (map[0][square.x] == user_id && map[1][square.x] == user_id && map[2][square.x] == user_id) {
	    console.log('ordo victory');
	    io.sockets.in(this.room).emit('victory', { user_id: user_id, feedback: 'The user '+user_id+' win!' });
	    callback(true);
	    return true;
	}

	if (map[square.y][0] == user_id && map[square.y][1] == user_id && map[square.y][2] == user_id) {
	    console.log('abs victory');
	    io.sockets.in(this.room).emit('victory', { user_id: user_id, feedback: 'The user '+user_id+' win!' });
	    callback(true);
	    return true;
	}

	if (map[1][1] != user_id) {
	    callback(false);
	    return false;
	}

	if ((map[0][0] == user_id && map[2][2] == user_id) || map[2][0] == user_id && map[0][2] == user_id) {
	    console.log('diag victory');
	    io.sockets.in(this.room).emit('victory', { user_id: user_id, feedback: 'The user '+user_id+' win!' });
	    callback(true);
	    return true;
	}
	callback(false);
    };

    this.checkEquality = function(callback) {
	var map = this.Playground.getMap();
	var full = true;
	for (var y = 0; y < 3 ; y++) {
	    for (var x = 0; x < 3 ; x++) {
		if (!map[y][x])
		    full = false;
	    }
	}
	if (full) {
	    console.log('EQUALITY!');
	    io.sockets.in(this.room).emit('equality');
	}
	callback(full);
    };

    this.start = function() {
	var nb_players = this.getNbPlayers();
	this.Players[nb_players - 1].emit('wait', { user_id: this.Players[nb_players - 1].user_id });
	if (nb_players == 2) {
	    this.onGame = this.Players[nb_players - 1].user_id;
	    io.sockets.in(this.getRoom()).emit('start', { timer: 10, user_id: this.Players[nb_players - 1].user_id });
	    this.Clock.start();
	}
    };
}


var Server = {
    Games: [],

    assignUser: function(Player) {
	Player.user_id = 'A';
	Player.username = 'Gerard';

	console.log('nb_games['+this.Games.length+']');
	for (Game in this.Games) {
	    var nb_players = this.Games[Game].getNbPlayers();
	    console.log('checking the room['+Game+'] nb_playres['+nb_players+']');
	    if (nb_players < 2) {
		console.log('User joined an existing room['+Game+']');
		
		if (nb_players == 1) { 
		    Player.user_id = 'B';
		    Player.username = 'Jean Claude';
		}

		Player.join(Game);
		this.Games[Game].addPlayer(Player);
		this.Games[Game].start();
		return true;
	    }
	}

	var game_id = Server.generateRoomName();
	Player.join(game_id);
	var Game = new OGame(game_id);
	Game.addPlayer(Player);
	this.Games[game_id] = Game;
	this.Games[game_id].start();
    },

    generateRoomName: function() {
	var key =  'a';
	while (typeof this.Games[key] != 'undefined') {
	    key += 'a';
	}
	return key;
    },

    addGame: function(Game) {
	if (!Game instanceof Game) {
	    return false;
	}
	Game.setRoom(this.generateRoomName());
	this.Games[Game.getRoom()] = Game;
	return true;
    },

    deleteGame: function(room) {
	if (typeof this.Games[room] != 'undefined') {
	    this.Games[room].Clock.stop();
	    delete this.Games[room];
	    console.log('room['+room+'] delete OK');
	    return true;
	}
	console.log('room['+room+'] delete KO');
	return false;
    }
};


io.sockets.on('connection', function(Player) {

    function playCallback(square) {
	console.info('|-->User['+Player.id+'] Play on ['+square.y+', '+square.x+']');
	var user_rooms = io.sockets.manager.roomClients[Player.id];
	for (user_room in user_rooms) {
	    console.log('user_room['+user_room+'] and value['+user_rooms[user_room]+'] from user['+Player.user_id+']');
	    if (user_room == '')
		continue;
	    
	    console.log('square maked['+Server.Games[user_room.substring(1)].Playground.getMap()[square.y][square.x]+'] before any server proccessing');

	    if (typeof Server.Games[user_room.substring(1)] != 'undefined'/* && this.Games[user_room.substring(1)].secret == Player.secret */) {
		if (!Server.Games[user_room.substring(1)].Playground.update(Player.user_id, square)) {
		    console.log('CHEATER DETECTED');
		}
		Server.Games[user_room.substring(1)].checkVictory(Player.user_id, square, function(is_over) {
	    	    if (is_over) {
			Server.deleteGame(user_room.substring(1));
			return true;
		    }
		    Server.Games[user_room.substring(1)].checkEquality(function(is_over) {
			if (is_over) {
			    Server.deleteGame(user_room.substring(1));
			    return true;
			}
			Server.Games[user_room.substring(1)].Clock.reset(user_room, Player);
		    });
		});
	    }
	}
	console.info('|-->User['+Player.id+'] Played on ['+square.y+', '+square.x+']');
    }
   
    function disconnectCallback() {
	console.info('|-->User['+Player.user_id+'] disconnect');
	var user_rooms = io.sockets.manager.roomClients[Player.id];
	for (user_room in user_rooms) {
	    console.log('user_room['+user_room+'] and value['+user_rooms[user_room]+'] from user['+Player.user_id+']');
	    if (user_room == '')
		continue;
	    
	    if (typeof Server.Games[user_room.substring(1)] != 'undefined'/* && this.Games[user_room.substring(1)].secret == Player.secret */) {
		io.sockets.in(user_room.substring(1)).emit('victory', { user_id: (Player.user_id == 'A' ? 'B' : 'A'), feedback: 'The user '+Player.user_id+' has abandonned the game.' });
		Server.deleteGame(user_room.substring(1));
	    }
	}
	console.info('|-->User['+Player.user_id+'] disconnected');
    }

    Player.on('play', playCallback);
    Player.on('disconnect', disconnectCallback);

    Server.assignUser(Player);
});