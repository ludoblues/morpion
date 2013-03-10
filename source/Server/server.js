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

	update: function(user_id, square, _end, _continue) {
	    console.log('Update Playground from the room['+that.room+'] on square['+square.y+', '+square.x+'] by user['+user_id+'] actually marked['+this.map[square.y][square.x]+'] user onGame['+that.onGame+']');
	    if (user_id != that.onGame) {
		io.sockets.in(that.room).emit('cheat', { user_id: user_id, square: square, feedback: 'the user '+user_id+' tried to play more than 1 time in its turn!' });
		_end(that.room);
		return false;
	    }
		
	    if (this.map[square.y][square.x]) { 
		io.sockets.in(that.room).emit('cheat', { user_id: user_id, square: square, feedback: 'the user '+user_id+' trie to steale a square already marked by his challenger!' });
		_end(that.room);
		return false;
	    }

	    this.map[square.y][square.x] = user_id;
	    that.onGame = (that.onGame == 'A' ? 'B' : 'A');
	    io.sockets.in(that.room).emit('play', { user_id: user_id, square: square });
	    _continue(user_id, square, that.room);
	    that.Clock.reset();
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
		    io.sockets.in(self.room).emit('victory', { user_id: that.onGame, feedback: 'The user '+(that.onGame == 'A' ? 'B' : 'A')+' has consumed all his time.' });
		    self.stop();
		}
		self.delay--;
	    }, 1000);	    
	},

	stop: function() {
	    clearInterval(this.engine);
	},
	
	reset: function(room) {
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

    this.checkVictory = function(user_id, square, _end, _continue) {
	console.log('Check Victory!');
	var map = that.Playground.getMap();
	
	if ((map[0][square.x] == user_id && map[1][square.x] == user_id && map[2][square.x] == user_id) 
	    || (map[square.y][0] == user_id && map[square.y][1] == user_id && map[square.y][2] == user_id)) {
	    console.log('Player ['+user_id+'] won orthogonally!');
	    io.sockets.in(this.room).emit('victory', { user_id: user_id, feedback: 'The user '+user_id+' win!' });
	    _end(that.room);
	    return true;
	}

	if (map[1][1] != user_id) {
	    _continue(user_id, square, that.room);
	    return false;
	}else if ((map[0][0] == user_id && map[2][2] == user_id) || (map[0][2] == user_id && map[2][0] == user_id)) {
	    io.sockets.in(that.room).emit('victory', { user_id: user_id, feedback: 'The user '+user_id+' win!' });
	    console.log('Player ['+user_id+'] won diagonally!');
	    _end(that.room);
	    return true;
	}
	
	_continue(user_id, square, that.room);
    };

    this.checkEquality = function(user_id, room, _end) {
	console.log('Check Equality!');
	var map = that.Playground.getMap();
	var full = true;
	for (var y = 0; y < 3; y++) {
	    for (var x = 0; x < 3; x++) {
		if (map[y][x] == 0)
		    full = false;
	    }
	}
	if (full) {
	    console.log('equality detected!');
	    io.sockets.in(that.room).emit('equality', { feedback: 'nothing' });
	    _end(room);
	}
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

	for (Game in this.Games) {
	    var nb_players = this.Games[Game].getNbPlayers();
	    console.log('checking the room['+Game+'] nb_players['+nb_players+']');
	    if (nb_players < 2) {
		console.log('User joined an existing room['+Game+']');
		
		if (nb_players == 1) { 
		    Player.user_id = 'B';
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
	var ListeCar = new Array("a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5","6","7","8","9");
	var RoomName ='';
	for (i = 0; i < 20; i++) {
	    RoomName += ListeCar[Math.floor(Math.random() * ListeCar.length)];
	}

	while (typeof this.Games[RoomName] != 'undefined') {
	    return this.generateRoomName();
	}

	return RoomName;
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
	    return true;
	}
	return false;
    },

    getNbGames: function() {
	var nb_games = 0;
	for (Game in this.Games) {
	    nb_games++;
	}
	return nb_games;
    },

    clean: function() {
	for (Game in this.Games) {
	    if (!this.Games[Game].getNbPlayers())
		this.deleteGame(Game);
	}
    }
};


io.sockets.on('connection', function(Player) {

    if (Server.getNbGames() >= 10) {
	console.log('Repartition de la charge!');
    }

    function deleteGame(room) {
	Server.deleteGame(room);
    }

    function continueGame(user_id, square, room) {
	console.log('continue game');
	Server.Games[room].checkEquality(user_id, square, deleteGame);
	Server.Games[room].Clock.reset(room);
    }

    function checkVictory(user_id, square, room) {
	Server.Games[room].checkVictory(user_id, square, deleteGame, continueGame);
    }

    function playCallback(square) {
	console.log('Play Event by Player.id['+Player.user_id+'] on square['+square.x+', '+square.y+']');
	var user_rooms = io.sockets.manager.roomClients[Player.id];
	for (user_room in user_rooms) {
	    if (user_room == '' || typeof Server.Games[user_room.substring(1)] == 'undefined')
		continue;
	    
	    Server.Games[user_room.substring(1)].Playground.update(Player.user_id, square, deleteGame, checkVictory);
	}
    }
    
    function disconnectCallback() {
	console.info('|-->User['+Player.user_id+'] disconnect');
	var user_rooms = io.sockets.manager.roomClients[Player.id];
	for (user_room in user_rooms) {
	    console.log('user_room['+user_room+'] and value['+user_rooms[user_room]+'] from user['+Player.user_id+']');
	    if (user_room == '')
		continue;
	    
	    if (typeof Server.Games[user_room.substring(1)] != 'undefined') {
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