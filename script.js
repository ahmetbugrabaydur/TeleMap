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