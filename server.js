const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs'); // File System module for saving/loading data

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Path to the save file
const SAVE_FILE = './session_save.json';

// Middleware to serve static files from the current directory
app.use(express.static(__dirname));

// Middleware to skip the ngrok browser warning for all users
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

// Initial session state
let sessionData = {
    currentMap: null,
    activeTokens: {}
};

// Load existing session from disk if the file exists
if (fs.existsSync(SAVE_FILE)) {
    try {
        const rawData = fs.readFileSync(SAVE_FILE);
        sessionData = JSON.parse(rawData);
        console.log("--> Session successfully loaded from disk!");
    } catch (err) {
        console.error("--> Error loading save file:", err);
    }
}

// Helper function to save current state to the JSON file
const saveToDisk = () => {
    try {
        fs.writeFileSync(SAVE_FILE, JSON.stringify(sessionData, null, 2));
    } catch (err) {
        console.error("--> Error saving to disk:", err);
    }
};

io.on('connection', (socket) => {
    console.log('A player has joined the session!');

    // Send the current map and tokens to the newly connected player
    if (sessionData.currentMap) {
        socket.emit('newMapReceived', sessionData.currentMap);
    }
    socket.emit('initialTokens', sessionData.activeTokens);

    // Handle Map Updates
    socket.on('mapUpdate', (data) => {
        sessionData.currentMap = data;
        saveToDisk(); // Update the save file
        socket.broadcast.emit('newMapReceived', data);
    });

    // Handle New Token Spawns
    socket.on('newToken', (data) => {
        sessionData.activeTokens[data.id] = data;
        saveToDisk(); // Update the save file
        socket.broadcast.emit('tokenSpawned', data);
    });

    // Handle Token Movement
    socket.on('tokenMove', (data) => {
        if (sessionData.activeTokens[data.id]) {
            sessionData.activeTokens[data.id].pos = data.pos;
            saveToDisk(); // Update the save file
            socket.broadcast.emit('tokenUpdate', data);
        }
    });

    // Handle Token Removal
    socket.on('removeToken', (tokenId) => {
        if (sessionData.activeTokens[tokenId]) {
            delete sessionData.activeTokens[tokenId];
            saveToDisk(); // Update the save file
            socket.broadcast.emit('tokenDeleted', tokenId);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Ready for the adventure!`);
});