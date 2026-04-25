const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -3
});

// File paths for the Map and the Token
const mapImageUrl = 'Maps/BattleMap.jpg';
const tokenImageUrl = 'Tokens/TokenM.png';

// Define the dimensions of the map
const bounds = [[0, 0], [1000, 1000]]; 

// Add the image overlay to the map
L.imageOverlay(mapImageUrl, bounds).addTo(map);

// Focus the map on the image area
map.fitBounds(bounds);

// Create and place a Token at the center 
const tokenIcon = L.icon({
    iconUrl: tokenImageUrl,
    iconSize: [50, 50],    // Size of the token in pixels
    iconAnchor: [25, 25]   // Point of the icon which will correspond to marker's location (center)
});

const token = L.marker([500, 500], {
    icon: tokenIcon,
    draggable: true        // Allows the user to move the token manually
}).addTo(map);

// Add a popup to indicate the token is ready
token.bindPopup("Token Ready! Drag me around.").openPopup();

// Debugging: Log coordinates to the console on every click
map.on('click', function(e) {
    console.log("Clicked Coordinates: ", e.latlng);
});

// 1. Token Database
const availableTokens = [
    { name: "Main Hero", image: "Tokens/TokenM.png" },
    { name: "Goblin", image: "Tokens/goblin.png" }, 
    { name: "Orc Warrior", image: "Tokens/orc.png" }
];

// 2. Render the sidebar list
const tokenListContainer = document.getElementById('tokenList');

function renderTokens(filter = "") {
    tokenListContainer.innerHTML = "";
    
    availableTokens.forEach(token => {
        if (token.name.toLowerCase().includes(filter.toLowerCase())) {
            const div = document.createElement('div');
            div.className = "token-item";
            div.innerHTML = `<img src="${token.image}"> <span>${token.name}</span>`;
            div.onclick = () => spawnToken(token.image, token.name);
            tokenListContainer.appendChild(div);
        }
    });
}

// 3. Spawn Token Function
function spawnToken(imgUrl, name) {
    const center = map.getCenter(); // Spawns in the middle of your current view
    
    const icon = L.icon({
        iconUrl: imgUrl,
        iconSize: [50, 50],
        iconAnchor: [25, 25]
    });

    const marker = L.marker(center, {
        icon: icon,
        draggable: true
    }).addTo(map);

    // 4. ADDING REMOVE BUTTON: Inside the popup
    const popupContent = `
        <div style="text-align:center;">
            <b>${name}</b><br>
            <button onclick="removeToken(this)" style="margin-top:10px; color:red; cursor:pointer;">Remove</button>
        </div>
    `;
    
    marker.bindPopup(popupContent);
}

// 5. Global Remove Function 
window.removeToken = function(button) {
    const popup = button.closest('.leaflet-popup');
    if (popup) {
       
        map.eachLayer(layer => {
            if (layer instanceof L.Marker && layer.getPopup() && layer.getPopup()._content.includes(button.outerHTML)) {
                map.removeLayer(layer);
            }
        });
    }
};
