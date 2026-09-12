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
    },
    isReportMode: false,
    prevPanelHidden: false,
    tempReportMarker: null
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

function isDemoAccount(email) {
    if (!email) return false;
    const lower = String(email).trim().toLowerCase();
    return lower === 'citizen@localoop.org' || lower === 'official@city.gov' || lower.endsWith('@demo.localoop.org');
}

// ========== 1. INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    if (window.showLocaloopLoader) {
        window.showLocaloopLoader('Syncing Localoop Grid...');
    }
    const user = JSON.parse(localStorage.getItem('civicUser'));
    if (!user) return window.location.href = 'index.html';
    state.currentUser = user;
    
    // Update Header UI
    document.getElementById('profileName').textContent = user.name;
    document.getElementById('menuProfileName').textContent = user.name;
    document.getElementById('menuProfileRole').textContent = user.role || 'Citizen';
    const karmaEl = document.getElementById('userKarma');
    if (karmaEl) {
        karmaEl.textContent = user.karmaPoints || 0;
    }

    // Map Setup
    state.mapInstance = L.map('map', { 
        zoomControl: false, 
        minZoom: 4, 
        maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)), 
        maxBoundsViscosity: 1.0
    }).setView([17.3850, 78.4867], 13);

    // Clean base layer: Zero POI icons (no temples, no restaurants, no landmarks) and zero name tags
    try {
        if (typeof L.maplibreGL === 'function') {
            L.maplibreGL({
                style: '/clean-map-style.json'
            }).addTo(state.mapInstance);
        } else {
            throw new Error("L.maplibreGL not loaded");
        }
    } catch (e) {
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            maxNativeZoom: 16,
            attribution: '&copy; Esri'
        }).addTo(state.mapInstance);
    }

    state.mapInstance.on('click', handleMapClick);

    // Get user location first to position demo issues accurately around user location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;
            state.userLocation = { lat, lng };
            state.mapInstance.setView([lat, lng], 15);
            if (userMarker) userMarker.setLatLng([lat, lng]);
            else {
                userMarker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        html: '<div style="width:16px;height:16px;background:#4f46e5;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(79,70,229,0.3);"></div>',
                        className: '', iconSize: [16,16]
                    })
                }).addTo(state.mapInstance);
            }
            await fetchIssues();
            if (window.hideLocaloopLoader) setTimeout(window.hideLocaloopLoader, 500);
        }, async () => {
            await fetchIssues();
            if (window.hideLocaloopLoader) setTimeout(window.hideLocaloopLoader, 500);
        });
    } else {
        await fetchIssues();
        if (window.hideLocaloopLoader) setTimeout(window.hideLocaloopLoader, 500);
    }
});

// ========== 2. RENDER ENGINE & DATA FETCHING ==========

async function fetchIssues() {
    try {
        const user = state.currentUser || JSON.parse(localStorage.getItem('civicUser') || '{}');
        const userEmail = user.email ? encodeURIComponent(user.email) : '';
        const isDemo = isDemoAccount(user.email);
        
        let url = `/api/issues?userEmail=${userEmail}`;
        if (isDemo && state.userLocation) {
            url += `&lat=${state.userLocation.lat}&lng=${state.userLocation.lng}`;
        }
        
        const response = await fetch(url, {
            headers: { 'x-user-email': user.email || '' }
        });
        if (!response.ok) throw new Error("Network response was not ok");
        let allIssues = await response.json();

        // Filter out demo data for new / non-demo users
        if (!isDemo) {
            allIssues = allIssues.filter(i => 
                !i.isDemo && 
                !String(i.id).startsWith('iss_') && 
                i.reporterEmail !== 'citizen@localoop.org' && 
                i.reporterEmail !== 'official@city.gov'
            );
        } else if (state.userLocation) {
            // Relocate demo sample issues right around user location
            const { lat, lng } = state.userLocation;
            allIssues.forEach(iss => {
                if (iss.isDemo || String(iss.id).startsWith('iss_')) {
                    iss.lat = Number((lat + (iss.offsetLat || 0)).toFixed(6));
                    iss.lng = Number((lng + (iss.offsetLng || 0)).toFixed(6));
                }
            });
        }
        state.issues = allIssues;
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
    if (!container) return;

    const user = state.currentUser || JSON.parse(localStorage.getItem('civicUser') || '{}');
    const isDemo = isDemoAccount(user.email);

    // If user has 0 issues, show empty state immediately
    if (!isDemo && (!state.issues || state.issues.length === 0)) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
                <div style="width: 52px; height: 52px; border-radius: 50%; background: #e0e7ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; font-size: 22px;">
                    <i class="fas fa-clipboard-list"></i>
                </div>
                <div style="font-weight: 700; color: #1e293b; font-size: 15px; margin-bottom: 6px;">No Active Issues</div>
                <p style="font-size: 13px; line-height: 1.5; margin: 0 0 16px; color: #64748b;">No issues reported near you yet.</p>
                <button onclick="openReportModal()" class="btn-primary" style="padding: 10px 18px; font-size: 13px; margin: 0 auto; display: inline-flex; align-items: center; gap: 8px;">
                    <i class="fas fa-plus"></i> Report an Issue
                </button>
            </div>
        `;
        return;
    }

    navigator.geolocation.getCurrentPosition((position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        state.userLocation = { lat: userLat, lng: userLng };

        // For demo user: adjust coordinates around user location
        if (isDemo) {
            state.issues.forEach(iss => {
                if (iss.isDemo || String(iss.id).startsWith('iss_')) {
                    iss.lat = Number((userLat + (iss.offsetLat || 0)).toFixed(6));
                    iss.lng = Number((userLng + (iss.offsetLng || 0)).toFixed(6));
                }
            });
        }

        // Filter issues within 2km radius
        let localIssues = state.issues.filter(issue => {
            if (!issue.lat || !issue.lng) return false;
            const distance = getDistance(userLat, userLng, issue.lat, issue.lng);
            return distance <= 2.0; 
        });

        // For demo user: if away from sample coords, show demo issues so demo data is accessible
        if (isDemo && localIssues.length === 0 && state.issues.length > 0) {
            localIssues = state.issues;
        }

        if (localIssues.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: #f0fdf4; color: #15803d; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; font-size: 22px;">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div style="font-weight: 700; color: #1e293b; font-size: 15px; margin-bottom: 6px;">All Clear Nearby</div>
                    <p style="font-size: 13px; margin: 0 0 16px; color: #64748b;">No issues reported within 2km. Everything looks good!</p>
                    <button onclick="openReportModal()" class="btn-primary" style="padding: 10px 18px; font-size: 13px; margin: 0 auto; display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fas fa-plus"></i> Report an Issue
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="padding: 10px 14px; font-size: 12px; color: var(--brand); font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
                <span>${isDemo ? 'Demo Nearby Reports' : 'Active Reports'} (${localIssues.length})</span>
                ${isDemo ? '<span style="font-size: 10px; background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px;">Demo Mode</span>' : ''}
            </div>
            ${localIssues.map(issue => {
                const photos = Array.isArray(issue.images) && issue.images.length > 0 ? issue.images : (Array.isArray(issue.photos) && issue.photos.length > 0 ? issue.photos : []);
                const thumbImg = photos[0] || '';
                const distanceKm = getDistance(userLat, userLng, issue.lat, issue.lng).toFixed(1);
                return `
                <div class="issue-card ${state.currentIssueId === (issue._id || issue.id) ? 'active' : ''}" onclick="selectIssue('${issue._id || issue.id}')">
                    <div class="issue-card-content">
                        <div class="card-header">
                            <div class="card-title">${issue.title}</div>
                            <span class="status-badge ${(issue.status || '').toLowerCase() === 'resolved' ? 'status-resolved' : 'status-pending'}">
                                ${(issue.status || 'Pending').toUpperCase()}
                            </span>
                        </div>
                        <div class="card-meta">
                            <span><i class="fas fa-tag"></i> ${issue.category || 'Civic'}</span>
                            <span><i class="fas fa-map-marker-alt"></i> ${distanceKm} km away</span>
                        </div>
                    </div>
                    ${thumbImg ? `
                        <div class="issue-card-image-tab" title="View attached evidence">
                            <img src="${thumbImg}" alt="${issue.title}" referrerpolicy="no-referrer" onerror="this.parentElement.style.display='none'">
                        </div>
                    ` : ''}
                </div>
            `}).join('')}
        `;
    }, (err) => {
        if (state.issues.length > 0) {
            container.innerHTML = `
                <div style="padding: 10px 14px; font-size: 12px; color: var(--brand); font-weight: 600;">
                    ${isDemo ? 'Demo Reports' : 'All Reports'} (${state.issues.length})
                </div>
                ${state.issues.map(issue => {
                    const photos = Array.isArray(issue.images) && issue.images.length > 0 ? issue.images : (Array.isArray(issue.photos) && issue.photos.length > 0 ? issue.photos : []);
                    const thumbImg = photos[0] || '';
                    return `
                    <div class="issue-card ${state.currentIssueId === (issue._id || issue.id) ? 'active' : ''}" onclick="selectIssue('${issue._id || issue.id}')">
                        <div class="issue-card-content">
                            <div class="card-header">
                                <div class="card-title">${issue.title}</div>
                                <span class="status-badge ${(issue.status || '').toLowerCase() === 'resolved' ? 'status-resolved' : 'status-pending'}">
                                    ${(issue.status || 'Pending').toUpperCase()}
                                </span>
                            </div>
                            <div class="card-meta">
                                <span><i class="fas fa-tag"></i> ${issue.category || 'Civic'}</span>
                                <span><i class="fas fa-calendar"></i> ${new Date(issue.createdAt || Date.now()).toLocaleDateString()}</span>
                            </div>
                        </div>
                        ${thumbImg ? `
                            <div class="issue-card-image-tab">
                                <img src="${thumbImg}" alt="${issue.title}" referrerpolicy="no-referrer" onerror="this.parentElement.style.display='none'">
                            </div>
                        ` : ''}
                    </div>
                `}).join('')}
            `;
        } else {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: #e0e7ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; font-size: 22px;">
                        <i class="fas fa-clipboard-list"></i>
                    </div>
                    <div style="font-weight: 700; color: #1e293b; font-size: 15px; margin-bottom: 6px;">No Active Issues</div>
                    <p style="font-size: 13px; margin: 0 0 16px; color: #64748b;">No issues reported yet. Click "Report Issue" to pin and submit your report!</p>
                    <button onclick="openReportModal()" class="btn-primary" style="padding: 10px 18px; font-size: 13px; margin: 0 auto; display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fas fa-plus"></i> Report an Issue
                    </button>
                </div>
            `;
        }
    });
}

async function renderMyReports() {
    const container = document.getElementById('myReportsList');
    if (!container) return;

    const user = state.currentUser || JSON.parse(localStorage.getItem('civicUser') || '{}');
    const isDemo = isDemoAccount(user.email);
    
    // Filter issues where the reporter email matches the current user (or demo user data)
    const myIssues = state.issues.filter(issue => 
        (issue.reporterEmail && issue.reporterEmail.toLowerCase() === (user.email || '').toLowerCase()) ||
        (isDemo && (issue.isDemo || issue.reporterEmail === 'citizen@localoop.org'))
    );

    if (myIssues.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">You haven't reported any issues yet. Click anywhere on the map to submit your first report!</div>`;
        return;
    }

    container.innerHTML = `
        <div style="padding: 10px; font-size: 12px; color: var(--brand); font-weight: 600;">
            You have reported ${myIssues.length} issues
        </div>
        ${myIssues.map(issue => `
            <div class="issue-card" onclick="selectIssue('${issue._id || issue.id}')">
                <div class="card-header">
                    <div class="card-title">${issue.title}</div>
                    <span class="status-badge ${(issue.status || '').toLowerCase() === 'resolved' ? 'status-resolved' : 'status-pending'}">
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

    // Photo Mapping
    const photoArray = Array.isArray(issue.images) ? issue.images : (issue.photos ? issue.photos : []);
    const galleryContainer = document.getElementById('detailGallery');
    const photoBadge = document.getElementById('detailPhotoBadge');
    if (photoBadge) {
        photoBadge.textContent = photoArray.length > 0 ? `${photoArray.length} Photo${photoArray.length > 1 ? 's' : ''}` : 'None';
    }
    
    if (photoArray.length > 0) {
        galleryContainer.innerHTML = photoArray.map(img => `
            <div class="gallery-item" onclick="window.open('${img}', '_blank')" title="Click to view full photo evidence">
                <img src="${img}" alt="${issue.title}" referrerpolicy="no-referrer" onerror="this.parentElement.style.display='none'">
                <div class="gallery-overlay"><i class="fas fa-search-plus"></i></div>
            </div>
        `).join('');
    } else {
        galleryContainer.innerHTML = `<div class="empty-gallery" style="color: var(--text-muted); font-size: 13px; font-style: italic;">No evidence photos attached.</div>`;
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

// ========== 5. REPORTING & PIN-DROP LOGIC ==========

function toggleReportMode() {
    if (state.isReportMode) {
        cancelReportMode();
    } else {
        startReportMode();
    }
}

function startReportMode() {
    state.isReportMode = true;
    const issuesPanel = document.getElementById('issuesPanel');
    if (issuesPanel) {
        state.prevPanelHidden = issuesPanel.classList.contains('hidden');
        // Hide all sidebars as requested: "you get the map as we have right now, and no sidebars."
        issuesPanel.classList.add('hidden');
    }
    
    // Close detail panel and side menu
    closeIssueDetail();
    const sideMenu = document.getElementById('sideMenu');
    if (sideMenu) sideMenu.classList.remove('show');
    
    // Update report option button to cancel state
    const reportBtn = document.getElementById('reportActionBtn');
    if (reportBtn) {
        reportBtn.classList.add('active');
        reportBtn.innerHTML = '<i class="fas fa-times"></i> <span class="btn-text">Cancel</span>';
        reportBtn.title = 'Cancel Report Mode';
    }
    
    // Show instruction guidance banner
    const banner = document.getElementById('reportModeBanner');
    if (banner) banner.classList.add('show');
    
    // Set crosshair cursor on the map
    document.body.classList.add('report-mode-active');
}

function cancelReportMode() {
    state.isReportMode = false;
    
    // Remove temporary report pin if placed
    if (state.tempReportMarker && state.mapInstance) {
        state.mapInstance.removeLayer(state.tempReportMarker);
        state.tempReportMarker = null;
    }
    
    // Reset report option button
    const reportBtn = document.getElementById('reportActionBtn');
    if (reportBtn) {
        reportBtn.classList.remove('active');
        reportBtn.innerHTML = '<i class="fas fa-plus"></i> <span class="btn-text">Report Issue</span>';
        reportBtn.title = 'Report an Issue';
    }
    
    // Hide guidance banner
    const banner = document.getElementById('reportModeBanner');
    if (banner) banner.classList.remove('show');
    
    // Restore sidebar if it was open before
    const issuesPanel = document.getElementById('issuesPanel');
    if (issuesPanel && !state.prevPanelHidden) {
        issuesPanel.classList.remove('hidden');
    }
    
    document.body.classList.remove('report-mode-active');
}

function openReportModal() {
    startReportMode();
}

function handleMapClick(e) {
    if (!state.isReportMode) {
        // Normal mode: do NOT trigger report modal.
        // Prevents accidental clicks from creating repeated or unexpected issues.
        if (state.currentIssueId) {
            closeIssueDetail();
        }
        return;
    }

    // In Report Mode: drop pin and open modal
    if (state.tempReportMarker && state.mapInstance) {
        state.mapInstance.removeLayer(state.tempReportMarker);
    }

    state.tempReportMarker = L.marker([e.latlng.lat, e.latlng.lng], {
        icon: L.divIcon({
            html: `
                <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
                    <div style="position:absolute; inset:0; background:rgba(79,70,229,0.3); border-radius:50%; animation:pulse-red 1.5s infinite;"></div>
                    <div style="width:26px; height:26px; background:#4f46e5; border:3px solid white; border-radius:50%; box-shadow:0 4px 10px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:white; font-size:12px;">
                        <i class="fas fa-map-marker-alt"></i>
                    </div>
                </div>
            `,
            className: '',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        })
    }).addTo(state.mapInstance);

    document.getElementById('reportLat').value = e.latlng.lat;
    document.getElementById('reportLng').value = e.latlng.lng;
    document.getElementById('reportModal').classList.add('show'); 
}

function closeReportModal() {
    document.getElementById('reportModal').classList.remove('show');
    const form = document.getElementById('reportForm');
    if (form) form.reset();
    const preview = document.getElementById('photoPreview');
    if (preview) preview.innerHTML = '';

    cancelReportMode();
}

// Escape key dismisses report mode or modal safely
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('reportModal');
        if (modal && modal.classList.contains('show')) {
            closeReportModal();
        } else if (state.isReportMode) {
            cancelReportMode();
        }
    }
});

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
        state.userLocation = { lat, lng };
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
        const user = state.currentUser || JSON.parse(localStorage.getItem('civicUser') || '{}');
        if (isDemoAccount(user.email)) {
            // Relocate demo sample issues right around user location
            state.issues.forEach(iss => {
                if (iss.isDemo || String(iss.id).startsWith('iss_')) {
                    iss.lat = Number((lat + (iss.offsetLat || 0)).toFixed(6));
                    iss.lng = Number((lng + (iss.offsetLng || 0)).toFixed(6));
                }
            });
            renderUI();
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
    try {
        localStorage.removeItem('civicUser');
        localStorage.clear();
        sessionStorage.clear();
    } catch (e) {
        console.warn("Storage clear error during sign out:", e);
    }
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.replace('index.html');
}
window.performLogout = performLogout;

document.addEventListener('click', (e) => {
    const target = e.target.closest('#signOutBtn, #sideMenuSignOut, .sign-out-btn');
    if (target) {
        e.preventDefault();
        performLogout();
    }
});
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