const core = require('./core');
const Fs = require('fs');
const io = require('socket.io');
var express = require('express')
var cors = require('cors')
var app = express();
const server = require('http').createServer(app);

app.use(cors());
app.use(express.static('public'))

sockerServer = io.listen(server, {pingTimeout: 30000, pingInterval: 20000});

var i = 0;
var listeners = [];
sockerServer.on('connect', client => {
    console.log('Client connected[' + client.id + ']')

    client.on('br', buffer => {
        // return;
        let path = `raw/${++i}media.wav`;
        Fs.writeFile(path, buffer, (e) => {
            if (e) {
                console.log(e);
            }
            Fs.readFile(path, (e, buffer) => {
                if (e) {
                    console.log(e);
                } else {

                    Fs.unlink(path);
                    core.bufferReceived(buffer, string => {
                        if (string == "" || string == "\n")
                            return;
                        sendToListeners(string);
                    });
                }
            });
        })
    });

    client.on("listen", () => {
        listeners.push(client);
    })

    client.on('disconnect', () => {
        console.log('Client disconnected[' + client.id + ']');
        for (var i=0; i<listeners.length; i++) {
            if (listeners[i] == client) {
                listeners.splice(i, 1);
            }
        }
    });
});

function sendToListeners(string) {
    for (var i=0; i<listeners.length; i++) {
        listeners[i].emit('r', string);
    }
}


server.listen(3000, "0.0.0.0", () => {
    console.log("server started");
    core.loadModel();
    // var buffer = Fs.readFileSync("raw/2media.wav");
    // console.log(buffer.length)
    // core.bufferReceived()
});