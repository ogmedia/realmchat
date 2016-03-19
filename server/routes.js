//routes
module.exports = function(s){
	//static routes
	s.route({
	    method: 'GET',
	    path: '/{param*}',
	    handler: {
	        directory: {
	            path: 'dist'
	        }
	    }
	});

	// Add the route
	s.route({
	    method: 'GET',
	    path:'/', 
	    handler: function (request, reply) {

	        return reply.view('layout/index.html');
	    }
	});
};