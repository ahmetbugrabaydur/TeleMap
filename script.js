const socket = io();
let markers = {}; 
let currentMapOverlay = null;
let deleteMode = false;
let pendingUploadData = null; 

// Map Initialization
const map = L.map('map', { crs: L.CRS.Simple, minZoom: -3 }).setView([500, 500], 2);

map.zoomControl.setPosition('topright');

const GRID_UNIT_SIZE = 50;

function getScaledSize() {
    const currentZoom = map.getZoom();
    const point1 = map.project([0, 0], currentZoom);
    const point2 = map.project([0, GRID_UNIT_SIZE], currentZoom);
    let size = Math.abs(point2.x - point1.x);
    return size < 15 ? 15 : size;
}

// Grid Overlay
function handleUniversalUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        pendingUploadData = event.target.result;
        document.getElementById('uploadModal').style.display = 'flex'; 
    };
    reader.readAsDataURL(file);
    e.target.value = ""; 
}

function processUpload(type) {
    if (!pendingUploadData) return;

    if (type === 'map') {
        socket.emit('mapUpdate', { imgData: pendingUploadData, bounds: [[0, 0], [1000, 1000]] });
    } else if (type === 'token') {
        const name = prompt("Token Name:", "New Token");
        if (name !== null) spawnToken(pendingUploadData, name);
    }
    closeUploadModal();
}

function closeUploadModal() {
    document.getElementById('uploadModal').style.display = 'none';
    pendingUploadData = null;
}

function toggleDeleteMode() {
    deleteMode = !deleteMode;
    const btn = document.getElementById('deleteModeBtn');
    const mapEl = document.getElementById('map');

    if (deleteMode) {
        btn.innerHTML = "<span>✂️</span> DELETE: ON";
        btn.classList.add('active');
        mapEl.classList.add('delete-cursor');
    } else {
        btn.innerHTML = "<span>✂️</span> DELETE";
        btn.classList.remove('active');
        mapEl.classList.remove('delete-cursor');
    }
}

map.on('click', (e) => {
    if (deleteMode && currentMapOverlay) {
        if(confirm("Are you sure you want to delete the map completely?")) {
            socket.emit('clearMapRequest');
            toggleDeleteMode();
        }
    }
});

function spawnToken(imgUrl, name, id = null, pos = null) {
    const tokenId = id || Date.now();
    const position = pos || map.getCenter();
    const size = getScaledSize();

    const icon = L.icon({
        iconUrl: imgUrl, iconSize: [size, size], iconAnchor: [size/2, size/2], className: 'token-style'
    });

    const marker = L.marker(position, { icon, draggable: true }).addTo(map);
    marker.tokenId = tokenId; marker.imgUrl = imgUrl; markers[tokenId] = marker;

    marker.on('click', (e) => {
        if (deleteMode) {
            L.DomEvent.stopPropagation(e); 
            map.removeLayer(marker); delete markers[tokenId];
            socket.emit('removeToken', tokenId);
        }
    });

    marker.on('dragend', () => socket.emit('tokenMove', { id: tokenId, pos: marker.getLatLng() }));
    if (!id) socket.emit('newToken', { id: tokenId, name, image: imgUrl, pos: position });
}

socket.on('newMapReceived', (data) => {
    if (currentMapOverlay) map.removeLayer(currentMapOverlay);
    currentMapOverlay = L.imageOverlay(data.imgData, data.bounds).addTo(map);
    map.fitBounds(data.bounds);
});

socket.on('mapCleared', () => {
    if (currentMapOverlay) { map.removeLayer(currentMapOverlay); currentMapOverlay = null; }
});

map.on('zoomend', () => {
    const size = getScaledSize();
    Object.values(markers).forEach(m => m.setIcon(L.icon({ iconUrl: m.imgUrl, iconSize: [size, size], iconAnchor: [size/2, size/2], className: 'token-style' })));
});

socket.on('tokenSpawned', (d) => spawnToken(d.image, d.name, d.id, d.pos));
socket.on('tokenUpdate', (d) => markers[d.id]?.setLatLng(d.pos));
socket.on('tokenDeleted', (id) => { if (markers[id]) { map.removeLayer(markers[id]); delete markers[id]; } });
socket.on('initialTokens', (ts) => Object.values(ts).forEach(t => spawnToken(t.image, t.name, t.id, t.pos)));

function manualSave() { 
    socket.emit('manualSaveRequest'); 
    alert("Session saved!");
} 