'use strict';

const Hapi = require('hapi');

// Create a server with a host and port
const server = new Hapi.Server();
server.connection({ 
    host: 'localhost', 
    port: process.env.npm_package_config_port 
});

//register plugins
server.register( [ require('vision'), require('inert') ], (err) => {

    server.views({
        engines: {
            html: require('handlebars')
        },
        relativeTo: __dirname,
        path: '../views'
    });

    require('./routes')(server);

});

// Start the server
server.start((err) => {

    if (err) {
        throw err;
    }
    console.log('Server running at:', server.info.uri);
});

