console.log = console.log || function(){};

console.log('hey');

// 'use strict';

(function(){
	var playersRef = new Firebase('https://realmchat.firebaseio.com/players');
	var set_presence = function(profile,uid){
		var user_obj = {name:profile.displayName, avatar:profile.profileImageURL};
		playersRef.child(uid).child('profile').set(user_obj);
		$('#logins').hide();
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
 				console.log(auth);
 				playersRef.child(auth.uid).child('lastActive').set(Firebase.ServerValue.TIMESTAMP);
 				if(auth.provider === 'facebook'){
				    set_presence(auth.facebook,auth.uid);

 				}
 				if(auth.provider === 'twitter'){
 					set_presence(auth.twitter,auth.uid);
 				}
 				console.log('hide buttons here');
				}
			});

	};

	game_info();

	var container, stats;
	var camera, scene, renderer;
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
			var size = 500, step = 50;
			var geometry = new THREE.Geometry();
			for ( var i = - size; i <= size; i += step ) {
				geometry.vertices.push( new THREE.Vector3( - size, 0, i ) );
				geometry.vertices.push( new THREE.Vector3(   size, 0, i ) );
				geometry.vertices.push( new THREE.Vector3( i, 0, - size ) );
				geometry.vertices.push( new THREE.Vector3( i, 0,   size ) );
			}
			var material = new THREE.LineBasicMaterial( { color: 0x000000, opacity: 0.2 } );
			var line = new THREE.LineSegments( geometry, material );
			//should add label here with same dimensions/positions
			scene.add( line );
		};

		var earth = function(){

		};

		var cubes = function(){
			console.log('rendering cubes');
			//these will be users - pull from firebase
			//ortho

			// Cubes
			var geometry = new THREE.BoxGeometry( 12.5, 12.5, 12.5 );
			var material = new THREE.MeshLambertMaterial( { color: 0xffffff, overdraw: 0.5 } );
			for ( var i = 0; i < 10; i ++ ) {
				//console.log('cube: ' + i);
				var cube = new THREE.Mesh( geometry, material );
				cube.scale.y = Math.floor( Math.random() * 2 + 1 );
				cube.position.x = Math.floor( ( Math.random() * 1000 - 500 ) / 50 ) * 50 + 25;
				cube.position.y = ( cube.scale.y * 50 ) / 2;
				cube.position.z = Math.floor( ( Math.random() * 1000 - 500 ) / 50 ) * 50 + 25;
				scene.add( cube );
			}
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

		var statistics = function(){
			stats = new Stats();
			stats.domElement.style.position = 'absolute';
			stats.domElement.style.top = '0px';
			stats.domElement.style.right = '0px';

			$('#header').append( stats.domElement );	
		};

		var rendering = function(){
			renderer = new THREE.CanvasRenderer();
			renderer.setClearColor( 0xf0f0f0 );
			renderer.setPixelRatio( window.devicePixelRatio );
			renderer.setSize( window.innerWidth, window.innerHeight );
			container.appendChild( renderer.domElement );
		};

		grid();
		cubes();
		lighting();
		rendering();
		statistics();
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
		var timer = Date.now() * 0.0001;
		camera.position.x = Math.cos( timer ) * 200;
		camera.position.z = Math.sin( timer ) * 200;
		camera.lookAt( scene.position );
		renderer.render( scene, camera );
	}
})(THREE);