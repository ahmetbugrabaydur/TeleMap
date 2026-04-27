const socket = io();
let markers = {}; // To track pawns on the screen by ID
let currentMapLayer; // To keep track of the current map layer for easy updates

// Map creation
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -3
});
map.zoomControl.setPosition('topright');

// Default view
const defaultBounds = [[0, 0], [1000, 1000]];
map.fitBounds(defaultBounds);

// 2. Map Loading Mechanism (For DM)
document.getElementById('mapInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const imgData = event.target.result;
        
        // The image dimensions are obtained and the map is scaled accordingly.
        const img = new Image();
        img.onload = function() {
            const w = this.width;
            const h = this.height;
            const newBounds = [[0, 0], [h, w]];
            
            // Send the new map to the server
            socket.emit('mapUpdate', { imgData: imgData, bounds: newBounds });
        };
        img.src = imgData;
    };
    reader.readAsDataURL(file);
});

// Apply the map update received from the server
socket.on('newMapReceived', (data) => {
    if (currentMapLayer) map.removeLayer(currentMapLayer);
    currentMapLayer = L.imageOverlay(data.imgData, data.bounds).addTo(map);
    map.fitBounds(data.bounds);
});

// 3. Token Creation and Management
document.getElementById('tokenInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const imgUrl = event.target.result;
        const name = prompt("Enter the name of the token: ", "New Token");
        
        if (name) {
            spawnToken(imgUrl, name);
        }
    };
    reader.readAsDataURL(file);
});

// Token Creation Function
function spawnToken(imgUrl, name, id = null, pos = null) {
    const tokenId = id || Date.now(); // If no ID is provided, create a new one 
    const position = pos || map.getCenter();

    const icon = L.icon({
        iconUrl: imgUrl,
        iconSize: [50, 50],
        iconAnchor: [25, 25],
        className: 'token-style'
    });

    const marker = L.marker(position, {
        icon: icon,
        draggable: true
    }).addTo(map);

    marker.tokenId = tokenId;
    markers[tokenId] = marker;

    // If this is a new token (not received from the server), emit it to others
    if (!id) {
        socket.emit('newToken', { 
            id: tokenId, 
            name: name, 
            image: imgUrl, 
            pos: position 
        });
    }

    // When the token is dragged, send its new position to the server
    marker.on('dragend', function() {
        socket.emit('tokenMove', { id: tokenId, pos: marker.getLatLng() });
    });

    // Bind a popup with the token's name and a delete button
    const popupContent = `
        <div style="text-align:center;">
            <b>${name}</b><br>
            <button onclick="deleteToken(${tokenId})" style="margin-top:5px; background:#ff4757; color:white; border:none; border-radius:3px; cursor:pointer;">Delete</button>
        </div>
    `;
    marker.bindPopup(popupContent);
}

// Token Deletion Function
window.deleteToken = function(id) {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
        socket.emit('removeToken', id);
    }
};

// Update a pawn that someone else is moving.
socket.on('tokenUpdate', (data) => {
    if (markers[data.id]) {
        markers[data.id].setLatLng(data.pos); 
    }
});

// Print the pawn that someone else added to the screen.
socket.on('tokenSpawned', (data) => {
    spawnToken(data.image, data.name, data.id, data.pos);
});

// Remove a pawn that someone else deleted from the screen.
socket.on('tokenDeleted', (id) => {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
});

// When a new player joins the game, load all existing tokens.
socket.on('initialTokens', (tokens) => {
    Object.values(tokens).forEach(t => {
        spawnToken(t.image, t.name, t.id, t.pos);
    });
});