// 1. Initialize map
const map = L.map('map').setView([17.3850, 78.4867], 13);

// Clean base layer: Zero POI icons (no temples, no restaurants, no landmarks) and zero name tags
try {
    if (typeof L.maplibreGL === 'function') {
        L.maplibreGL({
            style: '/clean-map-style.json'
        }).addTo(map);
    } else {
        throw new Error("L.maplibreGL not loaded");
    }
} catch (e) {
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        maxNativeZoom: 16,
        attribution: '&copy; Esri'
    }).addTo(map);
}

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
        const user = JSON.parse(localStorage.getItem('civicUser') || '{}');
        const userEmail = user.email ? encodeURIComponent(user.email) : '';
        const isDemo = user.email && (user.email === 'citizen@localoop.org' || user.email === 'official@city.gov' || user.email.endsWith('@demo.localoop.org'));

        // Send edges and user email to backend
        const response = await fetch(`/api/issues?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}&userEmail=${userEmail}`, {
            headers: { 'x-user-email': user.email || '' }
        });
        let issues = await response.json();
        
        // Hide demo issues for real / new users
        if (!isDemo) {
            issues = issues.filter(i => !i.isDemo && i.id !== 'iss_1' && i.id !== 'iss_2' && i.reporterEmail !== 'citizen@localoop.org' && i.reporterEmail !== 'official@city.gov');
        }

        currentIssuesData = issues; // Save the data globally!
        
        // Wipe the old pins off the map so we don't get duplicates
        issueMarkers.clearLayers();

        // Draw the new pins
        issues.forEach(issue => {
            const latLng = (issue.lat !== undefined && issue.lng !== undefined)
                ? [issue.lat, issue.lng]
                : (issue.location?.coordinates ? [issue.location.coordinates[1], issue.location.coordinates[0]] : null);
            
            if (!latLng) return;
            
            // Create the Popup HTML (The Box that opens on click)
            const popupContent = `
                <div style="text-align: center;">
                    <h3 style="margin: 0 0 5px 0;">${issue.title}</h3>
                    <p style="margin: 0 0 10px 0; color: gray;">By: ${issue.reportedBy || issue.uploader || 'Citizen'}</p>
                    <button onclick="openSidebar('${issue.id || issue._id}')" 
                            style="padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        View Full Details
                    </button>
                </div>
            `;

            L.marker(latLng)
             .bindTooltip(issue.title, { direction: 'top', offset: [0, -10] }) // HOVER EFFECT
             .bindPopup(popupContent) // CLICK EFFECT
             .addTo(issueMarkers);
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