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

// --- Combat Tracker Logic ---
let combatData = { list: [], turnIndex: 0 };

function toggleTracker() {
    document.getElementById('initiativeTracker').classList.toggle('hidden');
}

function addInitiative() {
    const nameInput = document.getElementById('charName');
    const initInput = document.getElementById('charInit');
    const name = nameInput.value.trim();
    const init = parseInt(initInput.value);

    if (!name || isNaN(init)) return;

    // Add to list and sort from largest to smallest.
    combatData.list.push({ id: Date.now(), name, init });
    combatData.list.sort((a, b) => b.init - a.init);
    
    nameInput.value = ''; initInput.value = '';
    
    updateAndSyncCombat();
}

function nextTurn() {
    if (combatData.list.length === 0) return;
    combatData.turnIndex = (combatData.turnIndex + 1) % combatData.list.length;
    updateAndSyncCombat();
}

function clearInitiative() {
    if (confirm("Are you sure you want to clear the initiative list?")) {
        combatData = { list: [], turnIndex: 0 };
        updateAndSyncCombat();
    }
}

function deleteCombatant(id) {
    combatData.list = combatData.list.filter(c => c.id !== id);
    if (combatData.turnIndex >= combatData.list.length) combatData.turnIndex = 0;
    updateAndSyncCombat();
}

function updateAndSyncCombat() {
    renderInitiative();
    socket.emit('combatUpdate', combatData); // Send to the server and other players
}

function renderInitiative() {
    const listEl = document.getElementById('initiativeList');
    listEl.innerHTML = '';

    combatData.list.forEach((char, index) => {
        const li = document.createElement('li');
        if (index === combatData.turnIndex) li.className = 'active-turn';
        
        li.innerHTML = `
            <span>${char.name} (Zar: ${char.init})</span>
            <button onclick="deleteCombatant(${char.id})" style="background:none; border:none; color:#e74c3c; cursor:pointer;">✖</button>
        `;
        listEl.appendChild(li);
    });
}

// Update the battle from the server.
socket.on('combatSync', (data) => {
    combatData = data;
    renderInitiative();
});

// --- CHAT AND DICE SYSTEM LOGIC ---

function toggleChat() {
    const panel = document.getElementById('chatContainer');
    const icon = document.getElementById('chatToggleIcon');
    panel.classList.toggle('chat-collapsed');
    icon.innerText = panel.classList.contains('chat-collapsed') ? '▲' : '▼';
}

function handleChatKeyPress(e) {
    if (e.key === 'Enter') sendChatMessage();
}

function toggleChat() {
    const panel = document.getElementById('chatContainer');
    const icon = document.getElementById('chatToggleIcon');
    panel.classList.toggle('chat-collapsed');
    icon.innerText = panel.classList.contains('chat-collapsed') ? '▲' : '▼';
}

function handleChatKeyPress(e) {
    if (e.key === 'Enter') sendChatMessage();
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const nameInput = document.getElementById('playerName').value.trim() || 'Gizemli Oyuncu';
    const colorInput = document.getElementById('playerColor').value;
    const text = input.value.trim();
    if (!text) return;

    const lowerText = text.toLowerCase();
    // Catch dice commands (/r, /roll, /adv, /dis)
    if (lowerText.startsWith('/r ') || lowerText.startsWith('/roll ') || lowerText.startsWith('/adv') || lowerText.startsWith('/dis')) {
        processRollCommand(lowerText, nameInput, colorInput);
    } else {
        // Chat
        const msgData = { sender: nameInput, text: text, type: 'normal', color: colorInput };
        appendChatMessage(msgData);
        socket.emit('chatMessage', msgData);
    }
    input.value = ''; 
}

// --- DICE ROLLING LOGIC WITH ADVANTAGE/DISADVANTAGE AND MODIFIERS ---
function processRollCommand(command, senderName, senderColor) {
    try {
        let isAdv = command.startsWith('/adv');
        let isDis = command.startsWith('/dis');

        if (isAdv || isDis) {

            let modMatch = command.match(/[+-]\s*\d+/);
            let modifier = modMatch ? parseInt(modMatch[0].replace(/\s+/g, '')) : 0;

            let roll1 = Math.floor(Math.random() * 20) + 1;
            let roll2 = Math.floor(Math.random() * 20) + 1;
            
            let finalRoll = isAdv ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
            let total = finalRoll + modifier;

            let modText = modifier !== 0 ? (modifier > 0 ? ` +${modifier}` : ` ${modifier}`) : '';
            let typeText = isAdv ? 'Advantage' : 'Disadvantage';
            
            let resultText = `🎲 ${typeText}: [${roll1}, ${roll2}]${modText} ➔ Total: ${total}`;
            
            const msgData = { sender: senderName, text: resultText, type: 'roll', color: senderColor };
            appendChatMessage(msgData);
            socket.emit('chatMessage', msgData);
            return;
        }

        const pureCommand = command.replace(/^\/r\s+|^\/roll\s+/i, '').replace(/\s+/g, '');
        const match = pureCommand.match(/^(?:(\d+))?d(\d+)(?:([+-])(\d+))?$/i);
        
        if (match) {
            const count = parseInt(match[1]) || 1; 
            const sides = parseInt(match[2]);
            const modifierSign = match[3];
            const modifier = parseInt(match[4]) || 0;

            if (count > 50 || sides > 100) throw new Error("Invalid dice size.");

            let total = 0;
            let rolls = [];
            for(let i=0; i<count; i++) {
                const r = Math.floor(Math.random() * sides) + 1;
                rolls.push(r);
                total += r;
            }

            if (modifierSign === '+') total += modifier;
            if (modifierSign === '-') total -= modifier;

            const modText = modifierSign ? ` ${modifierSign} ${modifier}` : '';
            const resultText = `🎲 Dice: ${count}d${sides}${modText} ➔ [${rolls.join(', ')}] = ${total}`;

            const msgData = { sender: senderName, text: resultText, type: 'roll', color: senderColor };
            appendChatMessage(msgData);
            socket.emit('chatMessage', msgData);
        } else {
            appendChatMessage({ sender: 'System', text: 'Invalid command. Example: /r 1d20, /adv +2, /dis', type: 'system' });
        }
    } catch (err) {
        appendChatMessage({ sender: 'System', text: 'The dice were not rolled.', type: 'system' });
    }
}

// Color screen printing function
function appendChatMessage(data) {
    const ul = document.getElementById('chatMessages');
    const li = document.createElement('li');
    
    if (data.type === 'roll') {
        li.className = 'chat-msg-roll';
        li.innerHTML = `<strong style="color: ${data.color}; text-shadow: 0 0 5px ${data.color};">${data.sender}</strong>: <span style="color:#e0e0e0">${data.text}</span>`;
    } else if (data.type === 'system') {
        li.className = 'chat-msg-system';
        li.innerText = data.text;
    } else {
        li.className = 'chat-msg-normal';
        li.innerHTML = `<strong style="color: ${data.color}; text-shadow: 0 0 5px ${data.color};">${data.sender}:</strong> ${data.text}`;
    }
    
    ul.appendChild(li);
    const body = document.getElementById('chatBody');
    body.scrollTop = body.scrollHeight;
}

socket.on('chatMessage', (data) => {
    appendChatMessage(data);
});