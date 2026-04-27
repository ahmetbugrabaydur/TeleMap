const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// This line exports all files in the folder. 
app.use(express.static(__dirname));

app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

let currentMapData = null; 

io.on('connection', (socket) => {
    // When a new person connects, send them the current map if available.
    if (currentMapData) {
        socket.emit('newMapReceived', currentMapData);
    }

    socket.on('mapUpdate', (data) => {
        currentMapData = data; 
        socket.broadcast.emit('newMapReceived', data);
    });
    
});

io.on('connection', (socket) => {
    console.log('A player joined the session!');

    // When the DM updates the map, everyone else can see it.
    socket.on('mapUpdate', (data) => {
        console.log('Map updated by DM');
        socket.broadcast.emit('newMapReceived', data);
    });

    // When a token is moved, send its coordinates to everyone else
    socket.on('tokenMove', (data) => {
        socket.broadcast.emit('tokenUpdate', data);
    });

    socket.on('disconnect', () => {
        console.log('A player left.');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});