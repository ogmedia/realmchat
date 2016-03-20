console.log = console.log || function(){};

console.log('hey');

// 'use strict';
var grid_bounds = 500;

(function(){
	var playersRef = new Firebase('https://realmchat.firebaseio.com/players');

	var player = {
		data:{},
		cube:null
	};

	var raycaster = new THREE.Raycaster(); // create once
	var mouse = new THREE.Vector2(); // create once

	document.addEventListener( 'mousedown', onDocumentMouseDown, false );
    function onDocumentMouseDown( event ) {
		mouse.x = ( event.clientX / renderer.domElement.width ) * 2 - 1;
		mouse.y = - ( event.clientY / renderer.domElement.height ) * 2 + 1;
		console.log('clicked');
		raycaster.setFromCamera( mouse, camera );

		var intersects = raycaster.intersectObjects( scene.children );
		console.log(intersects);
	};

	var draw_player = function(position){
		var geometry = new THREE.BoxGeometry( 12.5, 12.5, 12.5 );
		var material = new THREE.MeshLambertMaterial( { color: 0xffff00, overdraw: 0.5 } );
		
		player.cube = new THREE.Mesh( geometry, material );
		player.cube.position.x = position.x;
		player.cube.position.y = position.y;
		player.cube.position.z = 1; 

		scene.add( player.cube );	
	};

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
			}else{
				//console.log('we have a position!');
			}
		});
	};
	var set_presence = function(profile,uid){
		var user_obj = {name:profile.displayName, avatar:profile.profileImageURL};
		playersRef.child(uid).child('profile').set(user_obj);
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
				this.$el.append('<a href="http://realmchat.github.io" target="_blank">realmchat</a>');
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

 				playersRef.child(auth.uid).child('position').on('value',function(playerPosSnap){
 					var pos = playerPosSnap.val();
 					draw_player(pos);
 				});
			}
		});

	};

	game_info();

	var container, stats;
	var camera, scene, renderer;

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
		//var timer = Date.now() * 0.0001;
		//camera.position.x = Math.cos( timer ) * 200;
		//camera.position.z = Math.sin( timer ) * 200;
		camera.lookAt( scene.position );
		renderer.render( scene, camera );
	}
})(THREE);

