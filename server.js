const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 }); // Allow larger payloads for map images and tokens

const SAVE_FILE = './session_save.json';
app.use(express.static(__dirname));

let sessionData = { currentMap: null, activeTokens: {} };

if (fs.existsSync(SAVE_FILE)) {
    try { sessionData = JSON.parse(fs.readFileSync(SAVE_FILE)); } catch (e) {}
}

const saveToDisk = () => fs.writeFileSync(SAVE_FILE, JSON.stringify(sessionData, null, 2));

io.on('connection', (socket) => {
    if (sessionData.currentMap) socket.emit('newMapReceived', sessionData.currentMap);
    socket.emit('initialTokens', sessionData.activeTokens);

    socket.on('mapUpdate', (d) => { sessionData.currentMap = d; saveToDisk(); socket.broadcast.emit('newMapReceived', d); });
    socket.on('clearMapRequest', () => { sessionData.currentMap = null; saveToDisk(); io.emit('mapCleared'); });
    socket.on('newToken', (d) => { sessionData.activeTokens[d.id] = d; saveToDisk(); socket.broadcast.emit('tokenSpawned', d); });
    socket.on('tokenMove', (d) => { if(sessionData.activeTokens[d.id]) { sessionData.activeTokens[d.id].pos = d.pos; saveToDisk(); socket.broadcast.emit('tokenUpdate', d); }});
    socket.on('removeToken', (id) => { if(sessionData.activeTokens[id]) { delete sessionData.activeTokens[id]; saveToDisk(); socket.broadcast.emit('tokenDeleted', id); } });
    socket.on('manualSaveRequest', () => saveToDisk());
});

server.listen(3000, () => console.log("The server is running: http://localhost:3000"));