// 1. Initialize map
const map = L.map('map').setView([17.3850, 78.4867], 13);

// 🔥 UPGRADED HIGH-RES TILE LAYER 🔥
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, // Allows you to zoom in much closer before it gets blurry
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
}).addTo(map);

// We create a "Layer Group" for our issue pins. 
const issueMarkers = L.layerGroup().addTo(map);
let currentIssuesData = []; // Store fetched issues globally so the sidebar can access them

// 2. Find User Location and draw the "Blue Dot"
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            map.setView([userLat, userLng], 14);

            // Draw a Google Maps style blue dot for the user
            L.circleMarker([userLat, userLng], {
                radius: 8,
                fillColor: "#007bff",
                color: "#ffffff",
                weight: 2,
                opacity: 1,
                fillOpacity: 1
            }).bindPopup("<b>You are here</b>").addTo(map);

            // Fetch the pins for this specific area
            fetchIssuesInView();
        },
        (error) => {
            console.warn("Location denied. Loading default area.");
            fetchIssuesInView(); 
        }
    );
} else {
    fetchIssuesInView();
}

// 3. The Bounding Box Fetch Function
async function fetchIssuesInView() {
    // Get the exact coordinates of the edges of the user's screen
    const bounds = map.getBounds();
    const minLat = bounds.getSouthWest().lat;
    const minLng = bounds.getSouthWest().lng;
    const maxLat = bounds.getNorthEast().lat;
    const maxLng = bounds.getNorthEast().lng;

    try {
        // Send those edges to your Node backend
        const response = await fetch(`/api/issues?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}`);
        const issues = await response.json();
        
        currentIssuesData = issues; // Save the data globally!
        
        // Wipe the old pins off the map so we don't get duplicates
        issueMarkers.clearLayers();

        // Draw the new pins
       issues.forEach(issue => {
    // 1. Create the marker
    // Example of how to add the marker with a color-changing class
const marker = L.marker([issue.lat, issue.lng]).addTo(map);

// If the status is resolved, add the CSS class to turn it green
if (issue.status.toLowerCase() === 'resolved') {
    marker._icon.classList.add('marker-resolved');
}

    // 2. Determine the class based on status
    // We normalize to lowercase to avoid "Resolved" vs "resolved" issues
    const status = (issue.status || 'pending').toLowerCase();
    
    if (status === 'resolved') {
        marker._icon.classList.add('pin-resolved');
    } else {
        marker._icon.classList.add('pin-pending');
    }

    // 3. Add the popup
    marker.bindPopup(`
        <b>${issue.title}</b><br>
        Status: <span style="color: ${status === 'resolved' ? 'green' : 'orange'}">
            ${status.toUpperCase()}
        </span>
    `);
});
    } catch (err) {
        console.error("Error loading issues:", err);
    }
}

// 4. The Magic Trigger: Reload pins every time the user moves the map
map.on('moveend', fetchIssuesInView);

// --- SIDEBAR LOGIC ---

// Make sure this is a global function so the HTML button can trigger it
window.openSidebar = function(issueId) {
    // Find the exact issue from our saved data
    const issue = currentIssuesData.find(i => i.id === issueId);
    if (!issue) return;

    // Populate the sidebar HTML with the issue data
    document.getElementById('side-title').textContent = issue.title;
    document.getElementById('side-uploader').textContent = issue.uploader;
    document.getElementById('side-status').textContent = issue.status;
    document.getElementById('side-desc').textContent = issue.description;
    document.getElementById('side-image').src = issue.image;

    // Populate comments
    const commentsList = document.getElementById('side-comments');
    commentsList.innerHTML = ''; // Clear old comments
    issue.comments.forEach(comment => {
        const li = document.createElement('li');
        li.textContent = comment;
        commentsList.appendChild(li);
    });

    // Slide the sidebar in!
    document.getElementById('sidebar').classList.add('active');
}

window.closeSidebar = function() {
    // Slide the sidebar out
    document.getElementById('sidebar').classList.remove('active');
}