const server = require('http').createServer();
const io = require('socket.io')(server);
const Fs = require('fs');
const core = require('./core');


io.on('connection', client => {
    console.log('Client connected[' + client.id + ']')

    client.on('br', buffer => { 

        core.bufferReceived(buffer, string => {
            client.emit('r', string);
        });
    });

    client.on('disconnect', () => {
        console.log('Client disconnected[' + client.id + ']');
    });
});


server.listen(3000, () => {
    console.log("server started");
    core.loadModel();
});