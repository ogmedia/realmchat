define('auth',function(){

	console.log('AUTH MODULE LOADED');
	var ME = null;
	var playersRef = new Firebase('https://realmchat.firebaseio.com/players');
	var logged_in = false;
	var welcome = false;
	var uid = false;
	var token = false;
	var kik_enabled = false;

	var update_auth_state = function(auth){
		if(auth){
			//console.log(auth);
			playersRef.child(auth.uid).child('lastActive').set(Firebase.ServerValue.TIMESTAMP);
			playersRef.child(auth.uid).child('id').set(auth.uid);

			if(auth.provider === 'facebook'){
		    	//RC_APP.set_presence(auth.facebook,auth.uid);

			}
			if(auth.provider === 'twitter'){
				//RC_APP.set_presence(auth.twitter,auth.uid);
			}
			if(auth.provider === 'kik'){

			}
			console.log('AUTH STATE UPDATE');
			console.log(auth);
			//console.log('hide buttons here');
			ME = auth;
			logged_in = true;
			uid = auth.uid;

		}else{
			console.warn('no longer valid auth state!!');
			ME = null;
			logged_in = false;
		}
	};

	var kik_status = function(){
		console.log(kik);
		if (kik.enabled) {

			if (kik.hasPermission()) {
			    // your webpage has permission
			}else{
				console.log('doesnt have permission');
			   // alert('doesnt have permission');
			}
			
			alert('kik is enabled');

			kik.getAnonymousUser(function (token) {
    			get_user_token_for_kik(token);
    			kik_enabled = token;
    			kik.getUser(function (user) {
    			    if (!user) {
    			        // user denied access to their information
    			    } else {
    			        typeof user.username;  // 'string'
    			        typeof user.fullName;  // 'string'
    			        typeof user.firstName; // 'string'
    			        typeof user.lastName;  // 'string'
    			        typeof user.pic;       // 'string'
    			        typeof user.thumbnail; // 'string'

    			        console.log(user);
    			        alert(user);
    			    }
    			});

			});
		}
	};
	var get_user_token_for_kik = function(token){
		$.get( 'localhost:8888/kik', { token: token }, function(res){
			console.log('back from kik-token exchange');
			console.log(res);
		});
	};

	var custom_auth = function(token){
		if(token){
			playersRef.authWithCustomToken(auth, function(error, auth) {
		  		if (error) {
		    		console.warn("Authentication Failed!", error);
		  		} else {
		    		update_auth_state(auth);
		  		}
			});
		}else{
			console.warn('invalid token argument for custom_auth');
		}
	};

	var set_profile_data = function(profile, uid){
		if(profile && uid){
			var user_obj = {name:profile.displayName, avatar:profile.profileImageURL};
			console.log('writing the user data for: ' + uid + ':...');
			console.log(user_obj);

	 		playersRef.child(uid).child('profile').set(user_obj);
	 	}else{
	 		console.error('invalid arguments for set_profile_data');
	 	}
	};

	return {
		init: function(){		
			playersRef.onAuth(update_auth_state);
			kik_status();			
		},
		get_kik_status: function(){
			return kik_enabled;
		},
		get_auth_state: function(){
			if(logged_in){
				return{
					ME: ME,
					logged_in: logged_in,
					uid: uid,
					token: token
				};
			}else{
				return false;
			}
		},
		get_id: function(){
			return uid;
		},
		authTwitter: function(){
			playersRef.authWithOAuthPopup("twitter", function(error, auth) {
			  if (error) {
			    console.warn("Login Failed!", error);
			  } else {
			   	set_profile_data(auth.twitter, auth.uid);
			  }
			});
		},
		authFacebook: function(){
			playersRef.authWithOAuthPopup("facebook", function(error, auth) {
			  if (error) {
			    console.warn("Login Failed!", error);
			  } else {
			    set_profile_data(auth.facebook, auth.uid);

			  }
			});
		},
		ME:ME,
		custom: custom_auth,
	};

});
//views for realmchat
define('views',['auth','vc'],function(auth,vc){
	console.log('views module loaded');

	var playersModalIcon = Backbone.View.extend({
		tagName: 'span',
		template: _.template('<img src="<%=image%>" class="img-circle" />'),
		intialize: function(){
			console.log(this.model);
		},
		render: function(){
			this.$el.html( this.template( {image: this.model.get('avatar')} ) );
			return this;
		}
	});

	var playersModalView = Backbone.View.extend({
		tagName: 'div',
		className: 'modal fade',
		template: _.template( $('#join-modal-template').html() ),
		events:{
			"click .join-chat": "join_chat",
			"click .cancel-chat": "cancel_chat",
		},
		initialize: function(){
			//remove the listener

			//document.removeEventListener( 'mousedown', onDocumentMouseDown, false );

			//template first
			this.$el.html( this.template() );

			//then add the player icons
			var t = this;
			this.collection.forEach(function(p){
				var pIcon = new playersModalIcon({model:p});
				pIcon.render();
				t.$el.find('.modal-body').append( pIcon.$el.html() );
				
			});
			t.$el.find('.modal-body').append( $('#my-video-icon-template').html() );
			vc.init();
			//then show/render
			this.render();
		},
		render: function(){
			this.$el.modal({backdrop:'static'});
			this.$el.modal('show');
			return this;
		},
		cancel_chat: function(){
			this.$el.modal('hide');
		},
		join_chat: function(){
			//var p_ids = _.pluck(this.collection,'peer_id');
			//console.log( p_ids );
			vc.join(this.collection);
			peer.connectToPeers(this.collection);
			
		},
	});

	var userView = Backbone.View.extend({
		tagName: 'video',
		initialize: function(){
			console.log('new user video created');
			this.render();
		},
		render: function(){
			$('.modal-body').append( this.el );

		}
	});

	var welcomeView = Backbone.View.extend({
		tagName: 'div',
		className: 'modal fade',
		id: 'get-started-modal',
		template: _.template( $('#get-started-modal').html() ),
		events: {
			'click #twitter-login': 'twitter',
			'click #facebook-login': 'facebook'
		},
		initialize: function(){
			console.log(auth);
			this.$el.append( this.template() );
			this.$el.find('.modal-body').append('<span id="logins"><button class="btn btn-default" id="twitter-login">Twitter</button> | <button class="btn btn-default" id="facebook-login">Facebook</button></span>');
			$('body').prepend( this.$el );
			this.render();
		},
		render: function(){
			this.$el.modal('show');
			return this;
		},
		twitter: function(){
			console.log('clicked twitter');
			auth.authTwitter();
		},
		facebook: function(){
			console.log('clicked facebook');
			auth.authFacebook();
		}
	});

	return {
		welcome: welcomeView,
		players_modal_view: playersModalView,
		players_modal_icon: playersModalIcon
	};

});
define("collections",['player'],function(player){
	var playersCollection = Backbone.Firebase.Collection.extend({
		model:player,
		url: "https://realmchat.firebaseio.com/players"
	});

	var gridCollectionX = Backbone.Firebase.Collection.extend({
		url: "https://realmchat.firebaseio.com/grid/x"
	});
	var gridCollectionZ = Backbone.Firebase.Collection.extend({
		url: "https://realmchat.firebaseio.com/grid/z"
	});

	return{
		playersCollection:  playersCollection,
		gridCollectionX: gridCollectionX,
		gridCollectionZ: gridCollectionZ
	};
});
//player model
define('player',function(){

	var PlayerModel = Backbone.Model.extend({
		player_model: null,
		defaults:{
			grid:{
				x: 0,
				z: 0
			},
			position:
			{
				x: 0,
				z: 0
			}
		},
		initialize: function(){
			console.log('inited - ' + this.get('id') );
			// var player_av = this.get('profile').avatar;

			// var geometry = new THREE.BoxGeometry( 12.5, 12.5, 12.5 );
			// var texture = new THREE.TextureLoader().load( player_av );
			
			// texture.wrapS = THREE.RepeatWrapping;
			// texture.wrapT = THREE.RepeatWrapping;

			// var material = new THREE.MeshLambertMaterial( { color: 0xffff00, map: texture, overdraw: 0.5 } );
			
			// this.player_model = new THREE.Mesh( geometry, material );
			// this.player_model.position.x = this.get('position').x;
			// this.player_model.position.y = 2;
			// this.player_model.position.z = this.get('position').z;

			// //scene.add( this.player_model );
		}
	});

	return PlayerModel;
});

define('client',function(){
	var clientModel = Backbone.Model.extend({

	});

	return clientModel;
});
define('zone',['three','projector','renderer'], function(THREE){
	console.log("GAME ZONE FILE LOADED");

	var playersRef = new Firebase('https://realmchat.firebaseio.com/players');
	var gridRef = new Firebase('https://realmchat.firebaseio.com/grid');

	var grid_bounds = 500;
	var grid_step_size = 50;
	var grid_mesh = null;

	var cont_size_x = 800;
	var cont_size_y = 500;

	// 	//raytracing for clicks and whatnot
	var raycaster = new THREE.Raycaster(); // create once
	var mouse = new THREE.Vector2(); // create once

	var container, stats;
	var camera, scene, renderer;
	var sel_mesh = false;

	var onWindowResize = function() {
		camera.left = window.innerWidth / - 2;
		camera.right = window.innerWidth / 2;
		camera.top = cont_size_y / 2;
		camera.bottom = cont_size_y / - 2;
		camera.updateProjectionMatrix();
		renderer.setSize( window.innerWidth, cont_size_y );
	}
	// //

	var animate = function() {
		requestAnimationFrame( animate );
		//stats.begin();
		render();
		//stats.end();
	};

	var view_center_x = 200;
	var view_center_z = 200;
	var view_center_y = 200;

	var render = function() {
		var timer = Date.now() * 0.00001;
		camera.position.x = Math.cos( timer ) * view_center_x;
		camera.position.z = Math.sin( timer ) * view_center_z;

		camera.lookAt( scene.position );
		renderer.render( scene, camera );
	};

	var init =  function() {

		container = document.createElement( 'div' );
		//document.body.appendChild( container );
		$('#game-zone').append(container);

		camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, cont_size_y / 2, cont_size_y / - 2, - 500, 1000 );
		camera.position.x = 200;
		camera.position.y = 100;
		camera.position.z = 200;
		scene = new THREE.Scene();

		var grid = function(){
			// Grid
			var size = grid_bounds, step = grid_step_size;
			var gridHelper = new THREE.GridHelper( size, step );
			scene.add( gridHelper );

			//mesh for grid
			var geometry = new THREE.BoxGeometry( 1000, 0, 1000 );
			var material = new THREE.MeshBasicMaterial( { color: 0xffff00,wireframe:true } );
			grid_mesh = new THREE.Mesh( geometry, material );
			scene.add( grid_mesh );
		};


		var lighting = function(){
			// Lights
			var ambientLight = new THREE.AmbientLight( Math.random() * 0x10 );
			scene.add( ambientLight );
			var directionalLight = new THREE.DirectionalLight( Math.random() * 0xffffff );
			directionalLight.position.x = Math.random() - 0.5;
			directionalLight.position.y = Math.random() - 0.5;
			directionalLight.position.z = Math.random() - 0.5;
			directionalLight.position.normalize();
			scene.add( directionalLight );
	
		};

		var rendering = function(){
			renderer = new THREE.CanvasRenderer();
			renderer.setClearColor( 0xf0f0f0 );
			renderer.setPixelRatio( window.devicePixelRatio );
			renderer.setSize( cont_size_x, cont_size_y );
			container.appendChild( renderer.domElement );
		};

		grid();
		lighting();
		rendering();
		//
		window.addEventListener( 'resize', onWindowResize, false );

	};

	init();
	animate();

	return{
		add_player: function(p){
			var player_av = p.get('profile').avatar;

			var geometry = new THREE.BoxGeometry( 12.5, 12.5, 12.5 );
			var texture = new THREE.TextureLoader().load( player_av );
			
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;

			var material = new THREE.MeshLambertMaterial( { color: 0xffff00, map: texture, overdraw: 0.5 } );
			
			p.player_model = new THREE.Mesh( geometry, material );
			p.player_model.position.x = p.get('position').x;
			p.player_model.position.y = 2;
			p.player_model.position.z = p.get('position').z;

			scene.add( p.player_model );
		},
		mouse: mouse,
		renderer: renderer,
		raycaster: raycaster,
		grid_mesh: grid_mesh,
		camera: camera,
		grid_step_size:grid_step_size,
		scene: scene
	};
	// var ZONE = {


	// };

	// return ZONE;
	// var set_random_position = function(uid){
	// 	var new_pos = {};
	// 	var r = Math.floor( Math.random() * 2 + 1 );

	// 	new_pos.x = Math.floor( ( Math.random() * 1000 - 500 ) / 50 ) * 50 + 25;
	// 	new_pos.y = ( r * 50 ) / 2;

	// 	playersRef.child(uid).child('position').set(new_pos);
	// };

	// var last_position = function(uid){
	// 	playersRef.child(uid).child('position').once('value',function(posSnap){
	// 		var last_pos = posSnap.val();
	// 		if(!last_pos ){
	// 			//console.log('no position set yet');
	// 			set_random_position(uid);
	// 		}
	// 	});
	// };

});
//peer

define("peer",function(){
	// console.log('peer setup script');
	// var peer_con = new Peer({host: 'localhost', port: 9000, debug:3, path: '/peerjs' });	
	// var peer_id = null;
	// var call = null;

	// peer_con.on('open', function(id) {
	// 	//rc_app.set_peer_id(id);
	// 	peer_id = id;
	// });

	// peer_con.on('call', function(c) { 
	// 	//console.log('connected to peer:' + c.peer);
	// 	if(c){
	// 		call = c;
	// 	}
	// 	setConnEvents(call);
	// 	console.log('call coming in... trying to answer');

	// 	call.answer(mediaStream);
	// });

	return {
			//call: call,
			//peer_id: peer_id,

			connectToPeers: function(peers){
				console.log('trying to connect to peers]');
				peers.forEach(function(p){
					console.log('calling peer-ID....: ' + p.get('peer_id'));
					var c = peer_con.call( p.get('peer_id'), vc.mediaStream );
					vc.setConnEvents(c,p);
				});
			}
	};

});


//the video chat module
define('vc',['views','peer'],function(views,peer){
	// window.VC = function(){
	// 	var ready = function(){

	// 		var call = null;
		var mediaStream = null;
	// 		var myId = null;

		function hasGetUserMedia() {
		  return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
		            navigator.mozGetUserMedia || navigator.msGetUserMedia);
		}

		if (hasGetUserMedia()) {
				navigator.getUserMedia = (navigator.getUserMedia || 
			                          navigator.webkitGetUserMedia || 
			                          navigator.mozGetUserMedia || 
			                          navigator.msGetUserMedia);
		} else {
		  alert('getUserMedia() is not supported in your browser');
		}
					
		var init = function(){

			if (hasGetUserMedia()) {

				var errorCallback = function(e) {
					console.log('Reeeejected!', e);
				};
				console.log('getting media');
				// Good to go!
				//chrome
				navigator.getUserMedia({video: true, audio: false},function(stream){
					mediaStream = stream;
					console.log('got media stream');
					setTimeout(function(){
						videojs("my-video",{width:200}).ready(function(){
							myPlayer = this;
							var url = window.URL || window.webkitURL;

						  	myPlayer.src( url.createObjectURL( stream ) );
						  	myPlayer.play();
						  // Player (this) is initialized and ready.
						});
					},1000);

				},errorCallback);

			} else {
			  alert('getUserMedia() is not supported in your browser');
			}


	// 		peer.on('call', function(c) { 
	// 			//console.log('connected to peer:' + c.peer);
	// 			if(c){
	// 				call = c;
	// 			}
	// 			setConnEvents(call);
	// 			console.log('call coming in... trying to answer');

	// 			call.answer(mediaStream);
	// 		});


	// 		var connectToPeer = function(peerId){
	// 			call = peer.call(peerId,mediaStream);
	// 			setConnEvents(call);
	// 		};


	// 		var setConnEvents = function(call){


	// 			call.on('stream', function(stream) {
	// 				console.log('call answered, setting up video');
	// 			  // `stream` is the MediaStream of the remote peer.
	// 			  // Here you'd add it to an HTML video/canvas element.
	// 				$('#their-video-cont').show();
	// 				videojs("their-video",{width:300}).ready(function(){
	// 				  var myPlayer = this;

	// 				  var url = window.URL || window.webkitURL;
	// 				  myPlayer.src( url.createObjectURL( stream ) );
	// 				  myPlayer.play();
	// 				  // Player (this) is initialized and ready.
	// 				});
	// 			});
	// 		};

	// 	};
	// };
		};

// <!--
// <script type="text/template" id="user-video-template">
//   <video id="their-video" class="video-js">
//       <p class="vjs-no-js">
//         To view this video please enable JavaScript, and consider upgrading to a web browser that
//         <a href="http://videojs.com/html5-video-support/" target="_blank">supports HTML5 video</a>
//       </p>
//   </video>
// </script>
// -->

	return {
		init: init,
		stream: mediaStream,
		join: function(players){
			$('.modal-body').html('');
			players.forEach(function(p){
				var p_id = p.get('peer_id');
				new views.userView({
					model: p,
					id: 'video-' + p.get('id')
				});
				console.log(p_id);
			});
		},
		setConnEvents: function(call,peer){
			console.log('setting up stream when answered for video-' + peer.get('id') );

			call.on('stream', function(stream) {
				console.log('call answered, setting up video');
			  // `stream` is the MediaStream of the remote peer.
			  // Here you'd add it to an HTML video/canvas element.
				
				videojs("video-"+peer.get('id'),{width:200}).ready(function(){
				  var myPlayer = this;
				  var url = window.URL || window.webkitURL;
				  myPlayer.src( url.createObjectURL( stream ) );
				  myPlayer.play();
				  // Player (this) is initialized and ready.
				});
			});
		}
	};

});


define('main',['player','collections','views','zone','auth','hammer','vendor'], function(player,collections,views,zone,auth){

	var players = null;
	var active = false;

	var gridRef = new Firebase('https://realmchat.firebaseio.com/grid');
	var playersRef = new Firebase('https://realmchat.firebaseio.com/players');
	var sel_mesh = null;

	var gridTreeX = null;
	var gridTreeZ = null;

	var h_el =document.getElementById('game-zone');
	var hammertime = new Hammer(h_el);

	var start = function(){
		players = new collections.playersCollection();
		gridTreeX = new collections.gridCollectionX();
		gridTreeZ = new collections.gridCollectionZ();

		//console.log(players.toJSON());
		players.on('change',function(p){
			var new_pos = p.get('position');
			p.player_model.position.set( new_pos.x, new_pos.y, new_pos.z );
		});

		//add the players to the grid when they come to the collection
		players.on('add',function(p){
			zone.add_player(p);
		});
		auth.init();

		if(!auth.get_auth_state()){
			console.log( get_auth_state());
			main.show_welcome();
		}else{
			setTimeout(setup_touch,2000);
			// if(auth.ME){
			// 	setup_touch();
			// 	active = true;				
			// }else{
			// 	$('body').on('click',function(){
			// 		if(!active){
			// 			setup_touch();
			// 			//$('body').off('click');
			// 		}
			// 	});
			// }
		}
	};



    var onZoneTap = function( event ) {
    	console.log('TAPPED');
    	var offset =  $('#game-zone').offset();
		zone.mouse.x = ( (event.center.x - offset.left) / zone.renderer.domElement.width ) * 2 - 1;
		zone.mouse.y = -( ( event.center.y - offset.top) / zone.renderer.domElement.height ) * 2 + 1;
		zone.raycaster.setFromCamera( zone.mouse, zone.camera );

		var intersects = zone.raycaster.intersectObjects( [zone.grid_mesh] );


		if(intersects.length > 0){
			//update the position
			var grid_step_size = zone.grid_step_size;
			//find the square in the grid constraints of that point
			var x_grid_block = parseInt(Math.floor(intersects[0].point.x) / zone.grid_step_size);
			var z_grid_block = parseInt(Math.floor(intersects[0].point.z) / zone.grid_step_size);

			var x_constraint = parseInt(Math.floor(intersects[0].point.x) % zone.grid_step_size);
			var z_constraint = parseInt(Math.floor(intersects[0].point.z) % zone.grid_step_size);

			var pos_x_grid = x_grid_block;
			var pos_z_grid = z_grid_block;

			var new_x = null;
			var new_z = null;

 			if(x_constraint > 0){
 				new_x = (pos_x_grid * grid_step_size) + (grid_step_size/2);
 				x_grid_block++;
 			}else if(x_constraint <0){
				new_x = (pos_x_grid * grid_step_size) - (grid_step_size/2);
 				x_grid_block--;
 			}else{
 				if(pos_x_grid >= 0){
 			 		new_x = (pos_x_grid * grid_step_size) + (grid_step_size/2);
 					x_grid_block++;		
 				}else{
					new_x = (pos_x_grid * grid_step_size) - (grid_step_size/2);
 					x_grid_block--;
 				}

 			}

 			if(z_constraint > 0 ){
				new_z = (pos_z_grid * grid_step_size) + (grid_step_size/2);
 				z_grid_block++;
 			}else if(z_constraint < 0){
				new_z = (pos_z_grid * grid_step_size) - (grid_step_size/2);
 				z_grid_block--;
 			}else{
 				if(pos_z_grid >= 0){
 					new_z = (pos_z_grid * grid_step_size) + (grid_step_size/2);
 					z_grid_block++;					
 				}else{
 					new_z = (pos_z_grid * grid_step_size) - (grid_step_size/2);
 					z_grid_block--;					
 				}

 			}

			var new_mesh_pos = {
				x: new_x,
				y:1,
				z: new_z,
			};

			var new_pos = {
				x: new_x,
				y:3,
				z: new_z,
			};

			//get rid of original position before writing new
			var myPlayer = players.findWhere({id: auth.get_id() });
			var playerGrid = myPlayer.get('grid');
			if(playerGrid){
				if(playerGrid.x && playerGrid.z){
					gridRef.child('x').child(playerGrid.x).child('players').child(auth.get_id()).remove();
					gridRef.child('z').child(playerGrid.z).child('players').child(auth.get_id()).remove();
				}
			}

			//set the new pos
			playersRef.child(auth.get_id()).child('position').set(new_pos);
			playersRef.child(auth.get_id()).child('grid').set({ x: x_grid_block, z: z_grid_block });
			
			//set the new grid
			gridRef.child('x').child(x_grid_block).child('players').child(auth.get_id()).set(Firebase.ServerValue.TIMESTAMP);
			gridRef.child('z').child(z_grid_block).child('players').child(auth.get_id()).set(Firebase.ServerValue.TIMESTAMP);

			//put grid mesh here depending on click (area)

			//mesh for grid
			if(!sel_mesh){
				var geometry = new THREE.BoxGeometry( 50, '-.5', 50 );
				var material = new THREE.MeshBasicMaterial( { color: 0x66ff66} );
				sel_mesh = new THREE.Mesh( geometry, material );
				zone.scene.add( sel_mesh );
			}
			sel_mesh.position.set( new_mesh_pos.x, new_mesh_pos.y, new_mesh_pos.z );

			check_player_collision( x_grid_block, z_grid_block );
		}
	};

	var setup_touch = function(){

		hammertime.on('panup',function(ev){
			if(view_center_y >= 20){
				view_center_y = view_center_y-20;
				camera.translateOnAxis( new THREE.Vector3(0,0,1).normalize(), -20 );
			}
		});
		hammertime.on('pandown',function(ev){
			if(view_center_y <= 400){
				view_center_y = view_center_y+20;
				camera.translateOnAxis( new THREE.Vector3(0,0,1).normalize(), 20 );
			}
		});

		hammertime.on('tap', onZoneTap);
		
	};

	var check_player_collision = function(x,z){
		var myPlayer = players.findWhere({id: auth.get_id()});
		var playerGrid = myPlayer.get('grid');
		var xNode = gridTreeX.findWhere({id:x.toString()});
		var xNodePlayers = Object.keys(xNode.get('players')).filter(function(p_id){
			if(p_id !== auth.get_id() ){
				return true;
			}else{
				return false;
			}
		});
			//found one on the x
		if(xNodePlayers.length > 0){
			var zNode = gridTreeZ.findWhere({ id: z.toString() });
			var matchedPlayers = Object.keys(zNode.get('players')).filter(function(p_id){
				if(p_id !== auth.get_id()){
					return true;
				}else{
					return false;
				}
			});

			if( matchedPlayers.length > 0 ){				
				Promise.all( matchedPlayers.map(get_player_info) ).then(function(d){
					display_players_modal(d);
				});
			}
		}
	};

	var get_player_info = function(uid){
		return new Promise(function(resolve,reject){
			playersRef.child(uid).once('value',function(pSnap){
				var p_info = pSnap.child('profile').val();
				p_info.id = pSnap.child('id').val();
				p_info.peer_id = pSnap.child('peer_id').val();
				resolve( pSnap.val() );
			},function(err){
				reject(err);
			});

		});
	};

	var display_players_modal = function(ps){
		var psinchat = ps.map(function(z){
			return z;
		});
		var currPC = new Backbone.Collection(psinchat);
		new views.players_modal_view({collection:currPC});
		hammertime.off('tap', onZoneTap);
	};

	var main = {
		start: function(){
			start();
			//console.log(views);
			//console.log(auth);	
		},
		show_welcome: function(){
			welcome = new views.welcome();
			welcome.render();
		}
	};

	return main;
	// var rc_auth = {};
	// var rc_vc = {};
	// var rc_peer = {};

	// var playersRef = new Firebase('https://realmchat.firebaseio.com/players');
	// var gridRef = new Firebase('https://realmchat.firebaseio.com/grid');
	// var ME = null;

	// var players = new playersCollection();
	// var gridTreeX = new gridCollectionX();
	// var gridTreeZ = new gridCollectionZ();



	// var game_info = function(){
	// 	new gameInfoView();
	// };

	// game_info();

	// var check_player_collision = function(x,z){
	// 	var myPlayer = players.findWhere({id: ME.uid});
	// 	var playerGrid = myPlayer.get('grid');
	// 	var xNode = gridTreeX.findWhere({id:x.toString()});
	// 	var xNodePlayers = Object.keys(xNode.get('players')).filter(function(p_id){
	// 		if(p_id !== ME.uid){
	// 			return true;
	// 		}else{
	// 			return false;
	// 		}
	// 	});

	// 	//found one on the x
	// 	if(xNodePlayers.length > 0){
	// 		var zNode = gridTreeZ.findWhere({ id: z.toString() });
	// 		var matchedPlayers = Object.keys(zNode.get('players')).filter(function(p_id){
	// 			if(p_id !== ME.uid){
	// 				return true;
	// 			}else{
	// 				return false;
	// 			}
	// 		});

	// 		if( matchedPlayers.length > 0 ){				
	// 			Promise.all( matchedPlayers.map(get_player_info) ).then(function(d){
	// 				display_players_modal(d);
	// 			});
	// 		}
	// 	}
	// };

	// var display_players_modal = function(ps){
	// 	var psinchat = ps.map(function(z){
	// 		return z;
	// 	});
	// 	var currPC = new Backbone.Collection(psinchat);
	// 	new playersModalView({collection:currPC});

	// };

	// var get_player_info = function(uid){
	// 	return new Promise(function(resolve,reject){
	// 		playersRef.child(uid).once('value',function(pSnap){
	// 			var p_info = pSnap.child('profile').val();
	// 			p_info.id = pSnap.child('id').val();
	// 			p_info.peer_id = pSnap.child('peer_id').val();
	// 			resolve( pSnap.val() );
	// 		},function(err){
	// 			reject(err);
	// 		});

	// 	});
	// };

	// var h_el =document.getElementById('game-zone');
	// var hammertime = new Hammer(h_el);


	// hammertime.on('panup',function(ev){
	// 	if(view_center_y >= 20){
	// 		view_center_y = view_center_y-20;
	// 		camera.translateOnAxis( new THREE.Vector3(0,0,1).normalize(), -20 );
	// 	}
	// });
	// hammertime.on('pandown',function(ev){
	// 	if(view_center_y <= 400){
	// 		view_center_y = view_center_y+20;
	// 		camera.translateOnAxis( new THREE.Vector3(0,0,1).normalize(), 20 );
	// 	}
	// });

	// hammertime.on('tap', onZoneTap);

	// return (function(){


	// 		return	{
	// 			set_peer_id: function(p_id){
	// 				console.log('peer id from the RC_APP!');
	// 				console.log(p_id);
	// 				playersRef.child(ME.uid).child('peer_id').set(p_id);
	// 			},

	// 			playersRef: playersRef,

	// 			set_presence: function(profile,uid){
	// 				var user_obj = {name:profile.displayName, avatar:profile.profileImageURL};
	// 				playersRef.child(uid).child('profile').set(user_obj);
	// 				$('#profile').text(profile.displayName);
	// 				$('#logins').hide();

	// 				//last position check
	// 				last_position(uid);
	// 			}
	// 		}; 

	// })();

		// set_presence: function(profile,uid){
		// 	var user_obj = {name:profile.displayName, avatar:profile.profileImageURL};
		// 	playersRef.child(uid).child('profile').set(user_obj);
		// 	$('#profile').text(profile.displayName);
		// 	$('#logins').hide();

		// 	//last position check
		// 	last_position(uid);
		// },

});

require.config({
	baseUrL: '/js',
	//app: '/js',
	paths:{
		'jquery':'https://ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min',
		'three': 'js/three.min',
		'projector': 'js/Projector',
		'renderer':'js/CanvasRenderer',
		'vendor':'js/vendor.min',
		'hammer':'js/hammer.min',
	}
});

requirejs(['three'],function(THREE){
	require(['projector','renderer'],function(){
		require(['jquery','vendor','zone','auth','peer','views','main'],
			function($, vendor, zone,auth,peer,views,main){
				main.start();
		});
	});
});