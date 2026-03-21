// ========== ENTERPRISE STATE MANAGEMENT ==========
const state = {
    issues: [],          // All issues from DB
    currentUser: JSON.parse(localStorage.getItem('civicUser')),
    mapInstance: null,   // Your Leaflet map
    markers: {},         // Store markers by issue ID
    currentIssueId: null,
    filters: {
        status: 'All',
        searchTerm: ''
    }
};

let userMarker = null;

/**
 * Haversine Formula to calculate distance between two coordinates in km
 */
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

// ========== 1. INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('civicUser'));
    if (!user) return window.location.href = 'index.html';
    state.currentUser = user;
    
    // Update Header UI
    document.getElementById('profileName').textContent = user.name;
    document.getElementById('menuProfileName').textContent = user.name;
    document.getElementById('menuProfileRole').textContent = user.role || 'Citizen';

    // Map Setup
    state.mapInstance = L.map('map', { 
        zoomControl: false, 
        minZoom: 4, 
        maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)), 
        maxBoundsViscosity: 1.0
    }).setView([17.3850, 78.4867], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
        noWrap: true, attribution: '© CARTO'
    }).addTo(state.mapInstance);

    await fetchIssues();
    state.mapInstance.on('click', handleMapClick);
    
    // Initial location sync
    locateUser();
});

// ========== 2. RENDER ENGINE & DATA FETCHING ==========

async function fetchIssues() {
    try {
        const response = await fetch('/api/issues');
        if (!response.ok) throw new Error("Network response was not ok");
        state.issues = await response.json();
    } catch (error) {
        console.warn("Backend fetch failed. Using local state if available.");
    }
    renderUI();
}

/**
 * Renders the Sidebar List with 2km Proximity Logic
 */
async function renderReports() {
    const container = document.getElementById('issuesList');
    
    navigator.geolocation.getCurrentPosition((position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // Filter issues within 2km radius
        const localIssues = state.issues.filter(issue => {
            if (!issue.lat || !issue.lng) return false;
            const distance = getDistance(userLat, userLng, issue.lat, issue.lng);
            return distance <= 2.0; 
        });

        if (localIssues.length === 0) {
            container.innerHTML = `<div class="empty-state">No issues reported within 2km of you.</div>`;
            return;
        }

        container.innerHTML = `
            <div style="padding: 10px; font-size: 12px; color: var(--brand); font-weight: 600;">
                Showing ${localIssues.length} issues within 2km
            </div>
            ${localIssues.map(issue => `
               
<div class="issue-card ${state.currentIssueId === issue._id ? 'active' : ''}" onclick="selectIssue('${issue._id}')">
                    <div class="card-header">
                        <div class="card-title">${issue.title}</div>
                        <span class="status-badge ${issue.status === 'Resolved' ? 'status-resolved' : 'status-pending'}">
                            ${issue.status}
                        </span>
                    </div>
                    <div class="card-meta">
                        <span><i class="fas fa-user"></i> ${issue.uploader === state.currentUser.name ? 'You' : issue.uploader}</span>
                        <span><i class="fas fa-map-marker-alt"></i> ${getDistance(userLat, userLng, issue.lat, issue.lng).toFixed(1)} km away</span>
                    </div>
                </div>
            `).join('')}
        `;
    }, (err) => {
        container.innerHTML = `<div class="error">Please enable location to see local reports.</div>`;
    });
}
async function renderMyReports() {
    const container = document.getElementById('myReportsList'); // Use a separate container ID
    if (!container) return;

    const user = state.currentUser || JSON.parse(localStorage.getItem('civicUser'));
    
    // Filter issues where the reporter email matches the current user
    const myIssues = state.issues.filter(issue => issue.reporterEmail === user.email);

    if (myIssues.length === 0) {
        container.innerHTML = `<div class="empty-state">You haven't reported any issues yet.</div>`;
        return;
    }

    container.innerHTML = `
        <div style="padding: 10px; font-size: 12px; color: var(--brand); font-weight: 600;">
            You have reported ${myIssues.length} issues
        </div>
        ${myIssues.map(issue => `
            <div class="issue-card" onclick="selectIssue('${issue._id}')">
                <div class="card-header">
                    <div class="card-title">${issue.title}</div>
                    <span class="status-badge ${issue.status.toLowerCase() === 'resolved' ? 'status-resolved' : 'status-pending'}">
                        ${issue.status}
                    </span>
                </div>
                <div class="card-meta">
                    <span><i class="fas fa-calendar"></i> ${new Date(issue.createdAt || Date.now()).toLocaleDateString()}</span>
                    <span><i class="fas fa-exclamation-circle"></i> ${issue.urgency}</span>
                </div>
            </div>
        `).join('')}
    `;
}
function renderUI() {
    // 1. Clear Markers
    renderReports();   // The 2km local discovery (Existing)
    renderMyReports(); // The user's personal reports (New)
    Object.values(state.markers).forEach(m => state.mapInstance.removeLayer(m));
    state.markers = {};

    // 2. Filter issues for map based on filters
    const filtered = state.issues.filter(i => 
        (state.filters.status === 'All' || i.status === state.filters.status) &&
        (!state.filters.searchTerm || 
         i.title.toLowerCase().includes(state.filters.searchTerm.toLowerCase()) ||
         i.category.toLowerCase().includes(state.filters.searchTerm.toLowerCase()))
    );

    // 3. Create Map Markers
    filtered.forEach(issue => {
        if (issue.lat && issue.lng) {
            let markerColor = '#f59e0b'; // Default: Orange
            let iconClass = 'fa-exclamation';
            let animationClass = '';

            if (issue.status === 'Resolved') {
                markerColor = '#10b981'; // Green
                iconClass = 'fa-check';
            } else if (issue.urgency === 'high') {
                markerColor = '#ef4444'; // Red
                iconClass = 'fa-triangle-exclamation';
                animationClass = 'marker-pulse';
            }

            const customIcon = L.divIcon({
                className: 'custom-map-marker',
                html: `
                    <div class="marker-pin ${animationClass}" style="background: ${markerColor}">
                        <i class="fas ${iconClass}"></i>
                    </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 40]
            });

            const marker = L.marker([issue.lat, issue.lng], { icon: customIcon })
                .addTo(state.mapInstance)
                .on('click', () => selectIssue(issue.id));
            
            state.markers[issue.id] = marker;
        }
    });

    // 4. Update the Sidebar list
    renderReports();
}

// ========== 3. ISSUE DETAIL & INTERACTIONS ==========

function selectIssue(id) {
    // FIX 1: Search using both id and _id to be safe
    const issue = state.issues.find(i => i._id === id || i.id === id);
    if (!issue) {
        console.error("Issue not found in state:", id);
        return;
    }
    
    state.currentIssueId = id;
    const userEmail = state.currentUser.email;
    const isResolved = issue.status === 'Resolved';
    const noCount = issue.noVotes?.length || 0;
    const isCreator = issue.reporterEmail === userEmail; // Use email for reliability
    const hasVoted = (issue.yesVotes || []).includes(userEmail) || (issue.noVotes || []).includes(userEmail);

    // Update Basic Info
    document.getElementById('detailTitle').textContent = issue.title;
    document.getElementById('detailReporter').innerHTML = `<i class="fas fa-user-circle" style="color:var(--brand);"></i> ${issue.reportedBy || 'Anonymous'}`;
    document.getElementById('detailDescription').textContent = issue.description || "No description provided.";
    document.getElementById('detailCategory').textContent = issue.category;
    
    const statusEl = document.getElementById('detailStatus');
    statusEl.textContent = issue.status;
    statusEl.className = `status-badge ${isResolved ? 'status-resolved' : 'status-pending'}`;

    // FIX 2: Photo Mapping (Match 'images' from your reportData)
    const photoArray = Array.isArray(issue.images) ? issue.images : (issue.photos ? issue.photos : []);
    const galleryContainer = document.getElementById('detailGallery');
    
    if (photoArray.length > 0) {
        galleryContainer.innerHTML = `
            <div class="detail-label" style="margin-bottom: 10px;">Evidence Gallery</div>
            <div class="horizontal-gallery">
                ${photoArray.map(img => `
                    <div class="gallery-item" onclick="window.open('${img}', '_blank')">
                        <img src="${img}" alt="Evidence" onerror="this.src='https://via.placeholder.com/300?text=Image+Not+Found'">
                    </div>
                `).join('')}
            </div>`;
    } else {
        galleryContainer.innerHTML = `<div class="detail-label">Evidence Gallery</div><div class="empty-gallery">No photos attached.</div>`;
    }

    // Dynamic Voting UI
    const btnContainer = document.getElementById('dynamicVerifyBtnContainer');
    if (isResolved) {
        btnContainer.innerHTML = `<div class="resolution-banner success"><i class="fas fa-check-circle"></i> Issue Officially Resolved</div>`;
    } else if (isCreator) {
        btnContainer.innerHTML = `<div class="resolution-banner info"><i class="fas fa-map-pin"></i> You reported this issue</div>`;
    } else if (hasVoted) {
        btnContainer.innerHTML = `<div class="resolution-banner success-subtle"><i class="fas fa-heart" style="color:#22c55e;"></i> Thanks for your feedback!</div>`;
    } else {
        btnContainer.innerHTML = `
            <div class="vote-card">
                <h4 style="margin-bottom:12px; font-size:14px;">Is this issue still present?</h4>
                <div style="display:flex; gap:12px; justify-content:center;">
                    <button class="btn-vote-yes" onclick="voteIssue('${id}', 'yes')"><i class="fas fa-check"></i> Yes</button>
                    <button class="btn-vote-no" onclick="voteIssue('${id}', 'no')"><i class="fas fa-times"></i> No</button>
                </div>
                <div class="vote-progress-wrapper" style="margin-top:12px;">
                    <div class="vote-progress-bar" style="width: ${(noCount/3)*100}%"></div>
                </div>
                <p style="font-size:11px; color:var(--text-muted); margin-top:8px;">${noCount}/3 'No' votes to resolve</p>
            </div>`;
    }

    // Handle Comments
    const commentsContainer = document.getElementById('dynamicCommentsContainer');
    const commentsHtml = (issue.comments || []).map(c => `
        <div class="comment-bubble">
            <div class="comment-author">${c.user}</div>
            <div class="comment-text">${c.text}</div>
        </div>`).join('');

    commentsContainer.innerHTML = `
        <div class="comments-section-wrapper">
            <div class="detail-label">Community Discussion</div>
            <div class="comment-list" id="commentListScroll">${commentsHtml || 'No comments yet.'}</div>
            <div class="comment-input-area">
                <input type="text" id="newCommentInput" placeholder="Add a comment..." onkeypress="if(event.key === 'Enter') postComment('${id}')">
                <button onclick="postComment('${id}')"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>`;

    // FIX 3: Force the Panel to show
    const panel = document.getElementById('issueDetailPanel');
    panel.classList.remove('hidden');
    panel.classList.add('show');
    
    if (issue.lat && issue.lng) state.mapInstance.flyTo([issue.lat, issue.lng], 16);
}
// ========== 4. API ACTIONS (VOTING & COMMENTING) ==========

async function voteIssue(id, voteType) {
    try {
        const res = await fetch(`/api/issues/${id}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: state.currentUser.email, voteType })
        });
        if (res.ok) {
            const updated = await res.json();
            const index = state.issues.findIndex(i => i.id === id);
            if (index !== -1) state.issues[index] = updated;
            selectIssue(id); // Refresh Detail View
        }
    } catch (err) { console.error("Vote failed", err); }
}

async function postComment(id) {
    const input = document.getElementById('newCommentInput');
    const text = input.value.trim();
    if (!text) return;

    try {
        const res = await fetch(`/api/issues/${id}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: state.currentUser.name, text })
        });
        if (res.ok) {
            const updated = await res.json();
            const index = state.issues.findIndex(i => i.id === id);
            if (index !== -1) state.issues[index] = updated;
            selectIssue(id); // Refresh Detail View
        }
    } catch (err) { console.error("Comment failed", err); }
}

// ========== 5. REPORTING MODAL LOGIC ==========

function handleMapClick(e) {
    document.getElementById('reportLat').value = e.latlng.lat;
    document.getElementById('reportLng').value = e.latlng.lng;
    document.getElementById('reportModal').classList.add('show'); 
}

function closeReportModal() {
    document.getElementById('reportModal').classList.remove('show');
    document.getElementById('reportForm').reset();
    document.getElementById('photoPreview').innerHTML = '';
}

function handlePhotoUpload(event) {
    const preview = document.getElementById('photoPreview');
    const files = event.target.files;
    preview.innerHTML = '';
    Array.from(files).forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = e => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.innerHTML = `<img src="${e.target.result}"><button type="button" class="photo-remove">×</button>`;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

async function submitNewIssue(e) {
    e.preventDefault();
    
    // Ensure we have the latest user data
    const user = state.currentUser || JSON.parse(localStorage.getItem('civicUser'));
    
    if (!user) {
        alert("Session expired. Please log in again.");
        return;
    }

    const newIssue = {
        title: document.getElementById('reportTitle').value.trim(),
        category: document.getElementById('reportCategory').value,
        description: document.getElementById('reportDesc').value.trim(),
        status: "pending", // Lowercase to match your status badges
        urgency: document.getElementById('reportUrgency').value || 'low',
        
        // --- FIELD ALIGNMENT ---
        reportedBy: user.name,       // Changed from 'uploader'
        reporterEmail: user.email,   // Changed from 'uploaderEmail'
        reporterRole: user.role,     // Added for the leaderboard/details
        
        lat: parseFloat(document.getElementById('reportLat').value),
        lng: parseFloat(document.getElementById('reportLng').value),
        
        // Use 'images' to match the JSON data we imported
        images: typeof uploadedPhotos !== 'undefined' ? uploadedPhotos : [] 
    };

    try {
        const res = await fetch('/api/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newIssue)
        });

        if (res.ok) {
            // Optional: Show a success toast or alert
            console.log("Issue saved to MongoDB");
            
            closeReportModal();
            
            // Clear the uploaded photos array for the next report
            if (typeof uploadedPhotos !== 'undefined') uploadedPhotos = []; 
            
            // Re-fetch and re-render the map and list
            await fetchIssues(); 
        } else {
            const errorData = await res.json();
            alert("Failed to save: " + errorData.message);
        }
    } catch (err) { 
        console.error("Submit failed", err); 
        alert("Server connection failed.");
    }
}// Helper to set urgency value when a button is clicked

function selectUrgency(level, btnElement) {
    // 1. Update the hidden input value
    document.getElementById('reportUrgency').value = level;

    // 2. Remove 'selected' class from ALL buttons in the selector
    const allBtns = document.querySelectorAll('.urgency-level');
    allBtns.forEach(btn => btn.classList.remove('selected'));

    // 3. Add 'selected' class to the one just clicked
    btnElement.classList.add('selected');
    
    console.log("Database will now receive urgency:", level);
}
// ========== 6. UTILITIES (LOCATION & FILTERS) ==========

function locateUser() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        state.mapInstance.flyTo([lat, lng], 15);
        if (userMarker) userMarker.setLatLng([lat, lng]);
        else {
            userMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                    html: '<div style="width:16px;height:16px;background:#4f46e5;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(79,70,229,0.3);"></div>',
                    className: '', iconSize: [16,16]
                })
            }).addTo(state.mapInstance);
        }
    });
}
function updateHeaderUI() {
    const user = state.currentUser || JSON.parse(localStorage.getItem('civicUser'));
    if (!user) return;

    // Update Name
    const nameEl = document.getElementById('headerUserName');
    if (nameEl) nameEl.textContent = user.name;

    // Update Karma Display
    const karmaEl = document.getElementById('headerKarmaCount');
    if (karmaEl) {
        // Use || 0 to handle new users with no points yet
        karmaEl.innerHTML = `<i class="fas fa-medal" style="color: #fbbf24;"></i> ${user.karmaPoints || 0} Karma`;
    }
}
function toggleSideMenu() {
    document.getElementById('sideMenu').classList.toggle('show');
    document.getElementById('sideMenuOverlay').classList.toggle('show');
}

function toggleIssuesPanel() {
    document.getElementById('issuesPanel').classList.toggle('hidden');
}

function filterByStatus(s) {
    state.filters.status = s;
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    if (event) event.target.classList.add('active');
    renderUI();
}

function filterIssues() {
    state.filters.searchTerm = document.getElementById('searchIssues').value;
    renderUI();
}

function zoomIn() { state.mapInstance.zoomIn(); }
function zoomOut() { state.mapInstance.zoomOut(); }

function performLogout() {
    if (confirm('Logout?')) {
        localStorage.clear();
        window.location.href = 'index.html';
    }
}
// --- ADD THIS TO dashboard.js ---
function closeIssueDetail() {
    const panel = document.getElementById('issueDetailPanel');
    if (panel) {
        panel.classList.remove('show');
        panel.classList.add('hidden');
        state.currentIssueId = null;
        // Re-render markers and list to clear active states
        if(typeof renderReports === 'function') renderReports();
    }
}