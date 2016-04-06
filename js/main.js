(function(){

	var grid_bounds = 500;

	var playersRef = new Firebase('https://realmchat.firebaseio.com/players');
	var ME = null;

	//model and collection
	var player = Backbone.Model.extend({
		player_model: {},
		initialize: function(){
			//console.log('NEW PLAYER MODEL');
			var geometry = new THREE.BoxGeometry( 12.5, 12.5, 12.5 );
			var material = new THREE.MeshLambertMaterial( { color: 0xffff00, overdraw: 0.5 } );
			
			this.player_model = new THREE.Mesh( geometry, material );
			this.player_model.position.x = this.get('position').x;
			this.player_model.position.y = 2;
			this.player_model.position.z = this.get('position').z;

			scene.add( this.player_model );
		}
	});
	var playersCollection = Backbone.Firebase.Collection.extend({
		model:player,
		url: "https://realmchat.firebaseio.com/players"
	});
	var players = new playersCollection();
	players.on('change',function(player){
		//console.log(player);
		//console.log(scene.children);
		var new_pos = player.get('position');
		player.player_model.position.set( new_pos.x, new_pos.y, new_pos.z );
	});


	//raytracing for clicks and whatnot
	var raycaster = new THREE.Raycaster(); // create once
	var mouse = new THREE.Vector2(); // create once

	var set_random_position = function(uid){
		var new_pos = {};
		var r = Math.floor( Math.random() * 2 + 1 );

		new_pos.x = Math.floor( ( Math.random() * 1000 - 500 ) / 50 ) * 50 + 25;
		new_pos.y = ( r * 50 ) / 2;

		playersRef.child(uid).child('position').set(new_pos);
	};

	var last_position = function(uid){
		playersRef.child(uid).child('position').once('value',function(posSnap){
			var last_pos = posSnap.val();
			if(!last_pos ){
				//console.log('no position set yet');
				set_random_position(uid);
			}
		});
	};
	var set_presence = function(profile,uid){
		var user_obj = {name:profile.displayName, avatar:profile.profileImageURL};
		playersRef.child(uid).child('profile').set(user_obj);
		$('#profile').text(profile.displayName);
		$('#logins').hide();

		//last position check
		last_position(uid);
	};

	var authTwitter = function(){
		playersRef.authWithOAuthPopup("twitter", function(error, authData) {
		  if (error) {
		    console.log("Login Failed!", error);
		  } else {
		    set_presence(authData.twitter,authData.uid);
		  }
		});
	};

	var authFacebook = function(){
		playersRef.authWithOAuthPopup("facebook", function(error, authData) {
		  if (error) {
		    console.log("Login Failed!", error);
		  } else {
		    set_presence(authData.facebook, authData.uid);

		  }
		});
	};

	var game_info = function(){

		var gameInfoView = Backbone.View.extend({
			el: '#header',
			events: {
				'click #twitter-login': authTwitter,
				'click #facebook-login': authFacebook, 
			},
			initialize: function(){
				this.render();
			},
			render: function(){
				this.$el.append('<a href="http://realmchat.github.io" target="_blank">realmchat</a> <span id="profile"></span>');
				this.$el.append('<span id="logins"><button class="btn btn-default" id="twitter-login">Twitter</button> | <button class="btn btn-default" id="facebook-login">Facebook</button></span>');
			}
		});

		new gameInfoView();

		playersRef.onAuth(function(auth){
			if(auth){
 				//console.log(auth);
 				playersRef.child(auth.uid).child('lastActive').set(Firebase.ServerValue.TIMESTAMP);
 				if(auth.provider === 'facebook'){
				    set_presence(auth.facebook,auth.uid);

 				}
 				if(auth.provider === 'twitter'){
 					set_presence(auth.twitter,auth.uid);
 				}
 				//console.log('hide buttons here');
 				ME = auth;
			}
		});

	};

	game_info();

	var container, stats;
	var camera, scene, renderer;

	document.addEventListener( 'mousedown', onDocumentMouseDown, false );
	var sel_mesh = false;
    function onDocumentMouseDown( event ) {
		mouse.x = ( event.clientX / renderer.domElement.width ) * 2 - 1;
		mouse.y = - ( event.clientY / renderer.domElement.height ) * 2 + 1;
		//console.log('clicked');
		//console.log(mouse);
		raycaster.setFromCamera( mouse, camera );

		var intersects = raycaster.intersectObjects( scene.children );
		//console.log(intersects);
		if(intersects.length > 0){
			//update the position
			//
			var new_pos = {
				x: Math.floor(intersects[0].point.x),
				y: Math.floor(intersects[0].point.y),
				z: Math.floor(intersects[0].point.z)
			};
			console.log(new_pos);
			playersRef.child(ME.uid).child('position').set(new_pos);

			//put grid mesh here depending on click (area)

			//mesh for grid
			if(!sel_mesh){
				var geometry = new THREE.BoxGeometry( 50, -.5, 50 );
				var material = new THREE.MeshBasicMaterial( { color: 0x00ff00} );
				sel_mesh = new THREE.Mesh( geometry, material );
				scene.add( sel_mesh );
			}
			sel_mesh.position.set( new_pos.x, new_pos.y, new_pos.z );
		}
	}

	var statistics = function(){
		stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.top = '0px';
		stats.domElement.style.right = '0px';

		$('#header').append( stats.domElement );	
	};
	statistics();

	init();
	animate();

	function init() {


		container = document.createElement( 'div' );
		//document.body.appendChild( container );
		$('#game-zone').append(container);

		camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, - 500, 1000 );
		camera.position.x = 200;
		camera.position.y = 100;
		camera.position.z = 200;
		scene = new THREE.Scene();

		var grid = function(){
			// Grid
			var size = grid_bounds, step = 50;
			var gridHelper = new THREE.GridHelper( size, step );
			scene.add( gridHelper );

			//mesh for grid
			var geometry = new THREE.BoxGeometry( 1000, 0, 1000 );
			var material = new THREE.MeshBasicMaterial( { color: 0xffff00,wireframe:true } );
			var mesh = new THREE.Mesh( geometry, material );
			scene.add( mesh );
		};

		var earth = function(){

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
			renderer.setSize( window.innerWidth, window.innerHeight );
			container.appendChild( renderer.domElement );
		};

		grid();
		lighting();
		rendering();
		//
		window.addEventListener( 'resize', onWindowResize, false );


	}
	function onWindowResize() {
		camera.left = window.innerWidth / - 2;
		camera.right = window.innerWidth / 2;
		camera.top = window.innerHeight / 2;
		camera.bottom = window.innerHeight / - 2;
		camera.updateProjectionMatrix();
		renderer.setSize( window.innerWidth, window.innerHeight );
	}
	//

	function animate() {
		requestAnimationFrame( animate );
		stats.begin();
		render();
		stats.end();
	}
	function render() {
		var timer = Date.now() * 0.00001;
		camera.position.x = Math.cos( timer ) * 200;
		camera.position.z = Math.sin( timer ) * 200;
		camera.lookAt( scene.position );
		renderer.render( scene, camera );
	}
})(THREE);

