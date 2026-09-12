const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/src/assets', express.static(path.join(__dirname, 'src', 'assets')));

// Ensure 'uploads' directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
app.use('/uploads', express.static(uploadsDir));

// ==========================================
// 1. IN-MEMORY DATA STORES (SERVER MEMORY)
// ==========================================
// Accounts stored in server memory (Map keyed by lowercase email)
const memoryUsers = new Map();

// Issues stored in server memory
let memoryIssues = [];

function isDemoEmail(email) {
    if (!email) return false;
    const clean = String(email).trim().toLowerCase();
    return clean === 'citizen@localoop.org' || 
           clean === 'official@city.gov' || 
           clean.endsWith('@demo.localoop.org');
}

function registerMemoryUser(userData) {
    const email = (userData.email || '').trim().toLowerCase();
    const isDemo = isDemoEmail(email) || !!userData.isPreSeeded || !!userData.isDemo;
    const user = {
        id: userData.id || 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        name: (userData.name || 'User').trim(),
        email: email,
        password: (userData.password || '').trim(),
        role: userData.role || 'Citizen',
        locality: (userData.locality || '').trim(),
        karmaPoints: Number(userData.karmaPoints) || 0,
        profilePic: userData.profilePic || '',
        issuesReported: userData.issuesReported || [],
        createdAt: userData.createdAt || new Date(),
        isPreSeeded: !!userData.isPreSeeded,
        isDemo: isDemo
    };
    memoryUsers.set(email, user);
    return user;
}

// Pre-seed demo users so testing is effortless
registerMemoryUser({
    name: 'Jane Citizen',
    email: 'citizen@localoop.org',
    password: 'password123',
    role: 'Citizen',
    locality: 'Central District',
    karmaPoints: 120,
    isPreSeeded: true,
    isDemo: true
});

registerMemoryUser({
    name: 'Inspector Davis',
    email: 'official@city.gov',
    password: 'password123',
    role: 'Authority',
    locality: 'Ward 4, West Zone',
    karmaPoints: 450,
    isPreSeeded: true,
    isDemo: true
});

// Seed realistic civic issues with appropriate images and relative offsets for demo users
memoryIssues = [
    {
        id: 'iss_1',
        _id: 'iss_1',
        title: 'Deep Pothole on Main Avenue',
        description: 'Dangerous pothole on vehicular traffic lane causing tire impacts, vehicle damage, and bottleneck congestion.',
        category: 'Roads',
        urgency: 'High',
        status: 'pending',
        lat: 17.3871,
        lng: 78.4891,
        offsetLat: 0.0028,
        offsetLng: 0.0019,
        images: ['/assets/images/road_pothole_damage_1789127825968.jpg'],
        reportedBy: 'Jane Citizen',
        reporterEmail: 'citizen@localoop.org',
        reporterRole: 'Citizen',
        yesVotes: ['citizen@localoop.org'],
        noVotes: [],
        comments: [
            { user: 'Officer Davis', text: 'Inspected on morning patrol. Queued for municipal road patch crew.', timestamp: new Date() }
        ],
        isDemo: true,
        createdAt: new Date(Date.now() - 3600000 * 5)
    },
    {
        id: 'iss_2',
        _id: 'iss_2',
        title: 'Broken Streetlight at Park Corner',
        description: 'Municipal street lamp fixture is broken and has remained dark, reducing pedestrian night visibility.',
        category: 'Lighting',
        urgency: 'Medium',
        status: 'pending',
        lat: 17.3825,
        lng: 78.4830,
        offsetLat: -0.0032,
        offsetLng: 0.0025,
        images: ['/assets/images/broken_streetlight_pole_1789127847390.jpg'],
        reportedBy: 'Jane Citizen',
        reporterEmail: 'citizen@localoop.org',
        reporterRole: 'Citizen',
        yesVotes: [],
        noVotes: [],
        comments: [],
        isDemo: true,
        createdAt: new Date(Date.now() - 3600000 * 24)
    },
    {
        id: 'iss_3',
        _id: 'iss_3',
        title: 'Overflowing Waste Bin on Sidewalk',
        description: 'Public municipal trash bin overflowing onto sidewalk curb, creating pedestrian obstruction and sanitation hazards.',
        category: 'Sanitation',
        urgency: 'Medium',
        status: 'pending',
        lat: 17.3860,
        lng: 78.4815,
        offsetLat: 0.0015,
        offsetLng: -0.0035,
        images: ['/assets/images/overflowing_trash_bin_1789127866321.jpg'],
        reportedBy: 'Jane Citizen',
        reporterEmail: 'citizen@localoop.org',
        reporterRole: 'Citizen',
        yesVotes: ['citizen@localoop.org'],
        noVotes: [],
        comments: [
            { user: 'Sanitation Support', text: 'Scheduled for prompt collection on upcoming route.', timestamp: new Date() }
        ],
        isDemo: true,
        createdAt: new Date(Date.now() - 3600000 * 12)
    },
    {
        id: 'iss_4',
        _id: 'iss_4',
        title: 'Underground Water Pipe Leak on Street',
        description: 'Underground water pipeline leak causing continuous water accumulation along asphalt curb and gutter.',
        category: 'Water Supply',
        urgency: 'High',
        status: 'pending',
        lat: 17.3830,
        lng: 78.4880,
        offsetLat: -0.0022,
        offsetLng: -0.0028,
        images: ['/assets/images/street_water_leak_1789127886346.jpg'],
        reportedBy: 'Jane Citizen',
        reporterEmail: 'citizen@localoop.org',
        reporterRole: 'Citizen',
        yesVotes: [],
        noVotes: [],
        comments: [],
        isDemo: true,
        createdAt: new Date(Date.now() - 3600000 * 8)
    }
];

// ==========================================
// 2. OPTIONAL MONGODB CONNECTION
// ==========================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/local';
let isMongoConnected = false;

// Configure Mongoose with short timeout to prevent buffering hangs if no local MongoDB is running
mongoose.connect(MONGO_URI, { 
    family: 4, 
    serverSelectionTimeoutMS: 2000 
})
.then(() => {
    isMongoConnected = true;
    console.log('✅ Connected to MongoDB successfully!');
})
.catch(err => {
    isMongoConnected = false;
    console.log('ℹ️ Running in Server Memory mode (MongoDB offline: ' + err.message + ')');
});

// Mongoose Models
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "Citizen" },
    locality: { type: String, default: "" },
    karmaPoints: { type: Number, default: 0 },
    profilePic: { type: String, default: "" },
    issuesReported: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Issue' }]
});
const User = mongoose.model('User', userSchema);

const issueSchema = new mongoose.Schema({
    title: String,
    description: String,
    category: String,
    urgency: String,
    status: { type: String, default: "pending" },
    lat: Number,
    lng: Number,
    images: [String],
    reportedBy: String,
    reporterEmail: String,
    reporterRole: String,
    yesVotes: { type: [String], default: [] },
    noVotes: { type: [String], default: [] },
    comments: { type: Array, default: [] },
    resolutionDescription: String,
    resolutionImage: String,
    resolvedAt: Date,
    createdAt: { type: Date, default: Date.now }
});
const Issue = mongoose.model('Issue', issueSchema);

// ==========================================
// 3. DYNAMIC AUTHENTICATION (IN SERVER MEMORY)
// ==========================================

// Helper: Determine redirect URL based on role
function getRedirectUrlForRole(role) {
    const govRoles = ['Gov Official', 'Authority', 'Official', 'Governance', 'gov'];
    return govRoles.includes(role) ? '/gov/dashboard.html' : '/dashboard.html';
}

// SIGN UP ROUTE
async function handleSignup(req, res) {
    try {
        const { name, email, password, role, locality, userType } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                error: "Email and password are required.", 
                message: "Email and password are required." 
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const cleanPassword = typeof password === 'string' ? password.trim() : password;

        // Check if account already exists in server memory
        if (memoryUsers.has(normalizedEmail)) {
            const existing = memoryUsers.get(normalizedEmail);
            // If it's a pre-seeded demo user and user claims it by signing up, activate it with user's chosen password
            if (existing && existing.isPreSeeded) {
                existing.name = name ? name.trim() : existing.name;
                existing.password = cleanPassword;
                if (locality) existing.locality = locality.trim();
                existing.isPreSeeded = false;
                console.log(`👤 Pre-seeded user activated: ${existing.name} (${existing.email}) with custom password`);

                const redirectUrl = getRedirectUrlForRole(existing.role);
                return res.status(201).json({
                    message: "Signup successful",
                    success: true,
                    token: "civic_tok_" + existing.id,
                    user: {
                        id: existing.id,
                        name: existing.name,
                        email: existing.email,
                        role: existing.role,
                        locality: existing.locality,
                        karmaPoints: existing.karmaPoints
                    },
                    redirectUrl: redirectUrl
                });
            }

            console.log(`⚠️ Signup rejected: ${normalizedEmail} already exists in memory`);
            return res.status(400).json({ 
                error: "Email already registered!", 
                message: "Email already registered! Please sign in with your password." 
            });
        }

        // Determine user role
        let assignedRole = role;
        if (userType === 'gov' || (!assignedRole && locality)) {
            assignedRole = 'Authority';
        }
        if (!assignedRole) {
            assignedRole = 'Citizen';
        }

        // Create user in server memory
        const newUser = registerMemoryUser({
            name: name ? name.trim() : (assignedRole === 'Authority' ? 'Official' : 'Citizen'),
            email: normalizedEmail,
            password: cleanPassword,
            role: assignedRole,
            locality: locality ? locality.trim() : '',
            karmaPoints: 0
        });

        console.log(`👤 New User Registered in Server Memory: ${newUser.name} (${newUser.email}) - Role: ${newUser.role}`);

        // Async sync to MongoDB if connected (failsafe without blocking)
        if (isMongoConnected) {
            User.create({
                name: newUser.name,
                email: newUser.email,
                password: newUser.password,
                role: newUser.role,
                locality: newUser.locality,
                karmaPoints: 0
            }).catch(e => console.log('Mongo sync notice:', e.message));
        }

        const redirectUrl = getRedirectUrlForRole(newUser.role);

        return res.status(201).json({
            message: "Signup successful",
            success: true,
            token: "civic_tok_" + newUser.id,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                locality: newUser.locality,
                karmaPoints: newUser.karmaPoints,
                isDemo: false
            },
            redirectUrl: redirectUrl
        });

    } catch (err) {
        console.error("❌ Signup Error:", err);
        return res.status(500).json({ 
            error: "Registration failed. Try again.", 
            message: "Registration failed. Try again." 
        });
    }
}

// SIGN IN / LOGIN ROUTE
async function handleLogin(req, res) {
    try {
        const email = (req.body.email || req.body.username || '').trim().toLowerCase();
        const rawPassword = req.body.password;
        const password = typeof rawPassword === 'string' ? rawPassword.trim() : rawPassword;

        if (!email || !password) {
            return res.status(400).json({ 
                error: "Email and password are required", 
                message: "Email and password are required" 
            });
        }

        console.log("🔍 Dynamic login attempt for:", email);

        // 1. Look up in server memory
        let user = memoryUsers.get(email);

        // 2. If not found in memory but MongoDB is active, check MongoDB
        if (!user && isMongoConnected) {
            try {
                const dbUser = await User.findOne({ email });
                if (dbUser) {
                    user = registerMemoryUser({
                        id: dbUser._id.toString(),
                        name: dbUser.name,
                        email: dbUser.email,
                        password: dbUser.password,
                        role: dbUser.role,
                        locality: dbUser.locality || '',
                        karmaPoints: dbUser.karmaPoints || 0
                    });
                }
            } catch (e) {
                console.log('Mongo login fallback error:', e.message);
            }
        }

        // Check password match (including whitespace trim & demo password flexibility)
        const isDemoCitizen = email === 'citizen@localoop.org' && ['password123', 'password', '123456', 'citizen', '1234'].includes(password);
        const isDemoGov = email === 'official@city.gov' && ['password123', 'password', '123456', 'official', 'gov', '1234'].includes(password);

        const isPasswordValid = user && (
            user.password === password ||
            user.password === rawPassword ||
            (user.password && user.password.toLowerCase() === password.toLowerCase()) ||
            isDemoCitizen ||
            isDemoGov
        );

        if (!user || !isPasswordValid) {
            console.log("❌ Login failed for:", email);
            return res.status(401).json({ 
                error: "Invalid email or password", 
                message: "Invalid email or password. Use demo password 'password123' or click 'Sign up' to create an account.",
                success: false
            });
        }

        const isDemo = isDemoEmail(user.email) || !!user.isPreSeeded || !!user.isDemo;
        const redirectUrl = getRedirectUrlForRole(user.role);
        console.log(`✅ Login Success: ${user.name} (${user.role}) [demo: ${isDemo}] -> ${redirectUrl}`);

        return res.status(200).json({
            message: "Success",
            success: true,
            token: "civic_tok_" + user.id,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                locality: user.locality || "",
                karmaPoints: user.karmaPoints || 0,
                isDemo: isDemo
            },
            redirectUrl: redirectUrl
        });

    } catch (error) {
        console.error("❌ Login Crash:", error);
        return res.status(500).json({ 
            error: "Server error during login", 
            message: "Server error during login" 
        });
    }
}

// Authentication Endpoints
app.post('/api/auth/signup', handleSignup);
app.post('/api/auth/register', handleSignup);
app.post('/api/signup', handleSignup);

app.post('/api/auth/login', handleLogin);
app.post('/api/login', handleLogin);

app.post('/api/auth/logout', (req, res) => {
    res.status(200).json({ success: true, message: "Logged out successfully" });
});
app.post('/api/logout', (req, res) => {
    res.status(200).json({ success: true, message: "Logged out successfully" });
});

// ==========================================
// 4. LEADERBOARD API
// ==========================================
app.get('/api/users/leaderboard', (req, res) => {
    try {
        const userEmail = (req.query.userEmail || req.headers['x-user-email'] || '').trim().toLowerCase();
        const isDemo = isDemoEmail(userEmail);

        let usersList = Array.from(memoryUsers.values());

        if (!isDemo) {
            // Non-demo users: exclude pre-seeded demo personas
            usersList = usersList.filter(u => !isDemoEmail(u.email) && !u.isPreSeeded && !u.isDemo);
        }

        const mapped = usersList
            .sort((a, b) => (b.karmaPoints || 0) - (a.karmaPoints || 0))
            .slice(0, 10)
            .map(u => ({
                name: u.name,
                email: u.email,
                role: u.role,
                points: u.karmaPoints || 0,
                pic: u.profilePic || '',
                reportCount: (u.issuesReported || []).length,
                isDemo: isDemoEmail(u.email) || !!u.isPreSeeded
            }));

        res.json(mapped);
    } catch (err) {
        console.error("Leaderboard error:", err);
        res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
});

// ==========================================
// 5. ISSUES API (SERVER MEMORY + MONGO FALLBACK)
// ==========================================

// GET all issues (Filtered: demo data only for demo users)
app.get('/api/issues', async (req, res) => {
    try {
        const userEmail = (req.query.userEmail || req.headers['x-user-email'] || '').trim().toLowerCase();
        const isDemo = isDemoEmail(userEmail);

        let issues = [...memoryIssues];

        if (!isDemo) {
            // Filter out pre-seeded demo issues and demo data for new accounts
            issues = issues.filter(issue => 
                !issue.isDemo && 
                !String(issue.id).startsWith('iss_') && 
                issue.reporterEmail !== 'citizen@localoop.org' && 
                issue.reporterEmail !== 'official@city.gov'
            );
        } else {
            // For demo users: if user coordinates provided, dynamically position demo issues around user location
            const userLat = parseFloat(req.query.lat);
            const userLng = parseFloat(req.query.lng);
            if (!isNaN(userLat) && !isNaN(userLng) && (userLat !== 0 || userLng !== 0)) {
                issues = issues.map(iss => {
                    if (iss.isDemo || String(iss.id).startsWith('iss_')) {
                        return {
                            ...iss,
                            lat: Number((userLat + (iss.offsetLat || 0)).toFixed(6)),
                            lng: Number((userLng + (iss.offsetLng || 0)).toFixed(6))
                        };
                    }
                    return iss;
                });
            }
        }

        // Bounding box filter support (used by live map viewport)
        const { minLat, maxLat, minLng, maxLng } = req.query;
        if (minLat && maxLat && minLng && maxLng) {
            const south = parseFloat(minLat);
            const north = parseFloat(maxLat);
            const west = parseFloat(minLng);
            const east = parseFloat(maxLng);
            if (!isNaN(south) && !isNaN(north) && !isNaN(west) && !isNaN(east)) {
                issues = issues.filter(issue => {
                    const lat = issue.lat !== undefined ? issue.lat : (issue.location?.coordinates ? issue.location.coordinates[1] : null);
                    const lng = issue.lng !== undefined ? issue.lng : (issue.location?.coordinates ? issue.location.coordinates[0] : null);
                    if (lat === null || lng === null) return false;
                    return lat >= south && lat <= north && lng >= west && lng <= east;
                });
            }
        }

        // Return sorted by latest creation date
        const sorted = issues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(sorted);
    } catch (error) {
        console.error("Fetch issues error:", error);
        res.status(500).json({ error: "Failed to fetch issues" });
    }
});

// POST a new issue
app.post('/api/issues', async (req, res) => {
    try {
        const issueData = req.body;
        const newIssueId = 'iss_' + Date.now();

        const createdIssue = {
            id: newIssueId,
            _id: newIssueId,
            title: issueData.title || 'Untitled Issue',
            description: issueData.description || '',
            category: issueData.category || 'General',
            urgency: issueData.urgency || 'Medium',
            status: 'pending',
            lat: Number(issueData.lat) || 0,
            lng: Number(issueData.lng) || 0,
            images: Array.isArray(issueData.images) ? issueData.images : (issueData.images ? [issueData.images] : []),
            reportedBy: issueData.reportedBy || issueData.reporterName || 'Citizen',
            reporterEmail: (issueData.reporterEmail || '').toLowerCase(),
            reporterRole: issueData.reporterRole || 'Citizen',
            yesVotes: [],
            noVotes: [],
            comments: [],
            createdAt: new Date()
        };

        memoryIssues.unshift(createdIssue);

        // Award +50 Karma points to the reporter in memory
        if (createdIssue.reporterEmail && memoryUsers.has(createdIssue.reporterEmail)) {
            const reporter = memoryUsers.get(createdIssue.reporterEmail);
            reporter.karmaPoints = (reporter.karmaPoints || 0) + 50;
            if (!reporter.issuesReported) reporter.issuesReported = [];
            reporter.issuesReported.push(createdIssue.id);
        }

        // Also sync to MongoDB if connected
        if (isMongoConnected) {
            new Issue(createdIssue).save().catch(e => console.log('Mongo issue save notice:', e.message));
        }

        console.log(`📌 Issue Created in Memory: "${createdIssue.title}" by ${createdIssue.reportedBy}`);
        res.status(201).json(createdIssue);
    } catch (error) {
        console.error("Error saving issue:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST vote on issue
app.post('/api/issues/:id/vote', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, voteType } = req.body;

        const issue = memoryIssues.find(iss => iss.id === id || iss._id === id);
        if (!issue) return res.status(404).json({ error: "Issue not found" });

        if (!issue.yesVotes) issue.yesVotes = [];
        if (!issue.noVotes) issue.noVotes = [];

        const normalizedEmail = (email || '').toLowerCase();

        // Check if user already voted
        if (issue.yesVotes.includes(normalizedEmail) || issue.noVotes.includes(normalizedEmail)) {
            return res.status(400).json({ error: "You have already voted on this issue." });
        }

        if (voteType === 'yes') {
            issue.yesVotes.push(normalizedEmail);
        } else if (voteType === 'no') {
            issue.noVotes.push(normalizedEmail);
            if (issue.noVotes.length >= 3) {
                issue.status = "Resolved";
            }
        }

        // Reward the voter with +10 Karma points
        if (normalizedEmail && memoryUsers.has(normalizedEmail)) {
            const voter = memoryUsers.get(normalizedEmail);
            voter.karmaPoints = (voter.karmaPoints || 0) + 10;
        }

        res.json(issue);
    } catch (error) {
        console.error("Vote Error:", error);
        res.status(500).json({ error: "Failed to process vote" });
    }
});

// PUT resolve issue (Governance)
app.put('/api/issues/:id/resolve', upload.single('resolutionImage'), async (req, res) => {
    try {
        const issueId = req.params.id;
        const { resolutionDescription } = req.body;

        const issue = memoryIssues.find(iss => iss.id === issueId || iss._id === issueId);
        if (!issue) {
            return res.status(404).json({ message: "Issue not found in database." });
        }

        issue.status = 'resolved';
        issue.resolutionDescription = resolutionDescription || '';
        if (req.file) {
            issue.resolutionImage = `/uploads/${req.file.filename}`;
        }
        issue.resolvedAt = new Date();

        console.log("✅ Issue Resolved in Memory:", issue.title);
        res.status(200).json(issue);
    } catch (error) {
        console.error("Resolve error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// POST comment on issue
app.post('/api/issues/:id/comment', async (req, res) => {
    try {
        const { id } = req.params;
        const { user, text } = req.body;

        const issue = memoryIssues.find(iss => iss.id === id || iss._id === id);
        if (!issue) return res.status(404).json({ error: "Issue not found" });

        if (!issue.comments) issue.comments = [];
        const commentObj = {
            user: user || 'Anonymous',
            text: text,
            timestamp: new Date()
        };
        issue.comments.push(commentObj);

        res.json(issue);
    } catch (error) {
        console.error("Comment error:", error);
        res.status(500).json({ error: "Failed to add comment" });
    }
});

// GET Clean vector map style (zero temple/restaurant/POI icons, zero name tags)
app.get('/api/map/style.json', (req, res) => {
    try {
        const stylePath = path.join(__dirname, 'public', 'clean-map-style.json');
        if (fs.existsSync(stylePath)) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.sendFile(stylePath);
        }
        res.status(404).json({ error: "Clean style not found" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 6. SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Localoop Dynamic Server running on port ${PORT}`);
    console.log(`📍 Citizen Portal: http://localhost:${PORT}/`);
    console.log(`🏛️ Governance Portal: http://localhost:${PORT}/gov/`);
});
