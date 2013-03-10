var App = {
    Scenarios: {
	victory: function(data) {
	    App.Clock.stop();
	    $('h1#status-game').text('Player '+data.user_id+' won! ('+data.feedback+')');
	},
	
	equality: function(data) {
	    App.Clock.stop();
	    $('h1#status-game').text('Anybody won! ('+data.feedback+')');
	}
    },

    Clock: {
	countdown: 0,
	delay: 10,
	
	init: function(user_id, delay) {
	    this.delay = delay;
	    $('h1#status-game').text(App.Player.id == user_id ? 'It\'s yout turn to play!' : 'Your challenger is thinking...');
	    this.start(App.Player.id == user_id);
	},

	start: function(is_my_turn) {
	    console.log('|-->clock starts delay['+this.delay+']');
	    var self = this;
	    this.countdown = setInterval(function() {
		if (!self.delay) {
		    alert('Too late !');		    
		}
		self.delay--;
		$('time#clock').text(self.delay);
	    }, 1000);

	    console.log('|-->countdown['+this.countdown+'] launched');
	    if (is_my_turn) {
		App.Playground.unlock();
		return true;
	    }
	    App.Playground.lock();
	},
	
	stop: function() {
	    clearInterval(this.countdown);
	    App.Playground.lock();
	},

	reset: function(is_my_turn) {
	    this.delay = 10;
	    if (is_my_turn) {
		App.Playground.unlock();
		return true;
	    }
	    App.Playground.lock();
	}
    },

    Playground: {
	lock: function() {
	    $('td.square').unbind('click', this.play);
	},
	
	unlock: function() {
	    $('td.square.free').bind('click', this.play);
	},
	
	//TODO: sortir ce socket callback d'ici
	play: function() {
	    this.className = this.className.replace('free', 'played');
	    this.id = App.Player.id;
	    console.log('pos['+this.getAttribute('data-x')+', '+this.getAttribute('data-y')+'] played by player['+App.Player.id+']');
	    App.Player.play({ x: this.getAttribute('data-x'), y: this.getAttribute('data-y') });
	},

	update: function(data) {
	    if (data.user_id == App.Player.id) {
		App.Clock.reset(false);
		console.log('case updated by its own');
		$('h1#status-game').text('Your challenger is thinking...');
		return true;
	    }
	    var FreeSquares = $('td.square.free');
	    $.each(FreeSquares, function(index, element) {
		console.log(data);
		console.log('checking square['+element.getAttribute('data-y')+', '+element.getAttribute('data-x')+'] when the square['+data.square.y+', '+data.square.x+'] needs to be updated');
		if (element.getAttribute('data-y') == data.square.y && element.getAttribute('data-x') == data.square.x) {
		    App.Clock.reset(true);
		    element.className = element.className.replace('free', 'played');
		    element.id = data.user_id;
		    console.log('case updated by the challenger');
		    $('h1#status-game').text('It\'s yout turn to play!');
		    return false;
		}
	    });
	},

	cheat: function() {
	    alert('Someone tried to cheat !!');
	}
    },

    Player: {
	socket: {},
	id: '',
	
	initialize: function() {
	    this.socket = io.connect('http://localhost:4251');
	    this.socket.on('wait', this.wait);
	    this.socket.on('start', this.start);
	    this.socket.on('play', App.Playground.update);
	    this.socket.on('cheat', App.Playground.cheat);
	    this.socket.on('victory', App.Scenarios.victory);
	    this.socket.on('equality', App.Scenarios.equality);
	},

	wait: function(data) {
	    console.log('Player created with id['+data.user_id+']');
	    App.Player.id = data.user_id;
	},

	start: function(data) {
	    App.Clock.init(data.user_id, data.timer);
	},

	play: function(square) {
	    this.socket.emit('play', square);
	}
    },
    
    start: function(options) {
	this.Player.initialize();
	//Waiting for a challenger...
    }
};

$(document).ready(function(){
    App.start({ timer: 5000 });
});
