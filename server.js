const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// --- DATABASE CONNECTION ---
const MONGO_URI = 'mongodb://localhost:27017/local';

// We are adding { family: 4 } to force Node.js to use standard IPv4
mongoose.connect(MONGO_URI, { 
    family: 4 
})
    .then(() => console.log('✅ Connected to MongoDB successfully!'))
    .catch(err => console.error('❌ MongoDB connection error:', err));
// --- MONGODB SCHEMAS & MODELS ---
// --- UPDATED USER SCHEMA ---
const multer = require('multer');
const fs = require('fs');

// Create 'uploads' folder automatically if it's missing
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Configure how files are saved
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// Make the uploads folder accessible to the website
app.use('/uploads', express.static('uploads'));
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "Resident" },
    
    // NEW FIELDS FOR MONGODB
    karmaPoints: { type: Number, default: 0 },
    profilePic: { type: String, default: "" },
    issuesReported: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Issue' }]
});

const User = mongoose.model('User', userSchema);


// Ensure this Schema is the ONLY one used for the Issue model
// --- UPDATE IN server.js ---
// --- server.js ---

// 1. Ensure your Schema includes all fields
const issueSchema = new mongoose.Schema({
    title: String,
    description: String,
    category: String,
    urgency: String,
    status: { type: String, default: "pending" },
    lat: Number,
    lng: Number,
    images: [String], // Array to store image URLs or Base64
    reportedBy: String,
    reporterEmail: String,
    reporterRole: String,
    yesVotes: { type: [String], default: [] },
    noVotes: { type: [String], default: [] },
    comments: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});

const Issue = mongoose.model('Issue', issueSchema);

// 2. The POST Route to save data
app.post('/api/issues', async (req, res) => {
    try {
        const newIssue = new Issue(req.body);
        const savedIssue = await newIssue.save();
        
        // Optional: Award 50 Karma points to the reporter
        await User.findOneAndUpdate(
            { email: req.body.reporterEmail },
            { $inc: { karmaPoints: 50 } }
        );

        res.status(201).json(savedIssue);
    } catch (error) {
        console.error("Error saving issue:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// --- server.js ---
app.get('/api/users/leaderboard', async (req, res) => {
    try {
        // Get all users, but only send back Name, Role, and Karma for privacy
        const topUsers = await User.find({}, 'name role karmaPoints profilePic email').sort({ karmaPoints: -1 });
        res.json(topUsers);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
});

// --- AUTH API ---
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // 1. Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email already registered!" });
        }

        // 2. Create new user (Citizen is default if role is missing)
        const newUser = new User({
            name,
            email,
            password, 
            role: role || 'Citizen',
            karmaPoints: 0
        });

        await newUser.save();
        console.log(`👤 New User Registered: ${name} as ${newUser.role}`);
        
        res.status(201).json({ 
            message: "Signup successful", 
            user: { name, email, role: newUser.role } 
        });
    } catch (err) {
        console.error("Signup Error:", err);
        res.status(500).json({ error: "Registration failed. Try again." });
    }
});
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log("Login attempt:", email);

        // 1. Find user by email
        const user = await User.findOne({ email });

        // 2. Check if user exists AND password matches
        if (!user || user.password !== password) {
            console.log("❌ Login failed: Invalid credentials");
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // 3. Determine the correct Redirect URL
        let redirectUrl = '/dashboard.html'; // Default for Citizens
        const govRoles = ['Gov Official', 'Authority', 'Official'];

        if (govRoles.includes(user.role)) {
            redirectUrl = '/gov/dashboard.html';
        }

        console.log(`✅ Login Success: ${user.name} (${user.role}) -> ${redirectUrl}`);

        res.json({
            message: "Success",
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                karmaPoints: user.karmaPoints || 0
            },
            redirectUrl: redirectUrl
        });

    } catch (error) {
        console.error("❌ Login Crash:", error);
        res.status(500).json({ error: "Server error during login" });
    }
});
app.get('/api/users/leaderboard', async (req, res) => {
    try {
        // Fetch top 10 users based on Karma
        const users = await User.find({}, 'name email role karmaPoints profilePic issuesReported')
            .sort({ karmaPoints: -1 })
            .limit(10);
            
        // Map data to include the count of issues
        const formattedData = users.map(user => ({
            name: user.name,
            email: user.email,
            role: user.role,
            points: user.karmaPoints,
            pic: user.profilePic,
            reportCount: user.issuesReported.length
        }));

        res.json(formattedData);
    } catch (err) {
        res.status(500).json({ error: "Leaderboard fetch failed" });
    }
});
// --- ISSUES API ---
// FETCH: Gets all pins straight from MongoDB
app.get('/api/issues', async (req, res) => {
    try {
        const issues = await Issue.find().sort({ createdAt: -1 });
        const formattedIssues = issues.map(issue => ({
            ...issue._doc,
            id: issue._id.toString() 
        }));
        res.json(formattedIssues);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch issues" });
    }
});

// SAVE: Puts a new pin straight into MongoDB
app.post('/api/issues', async (req, res) => {
    try {
        const { reportedBy, ...issueData } = req.body; 
        // reportedBy should be the user's EMAIL or NAME from the frontend

        const newIssue = new Issue({ ...issueData, reportedBy });
        const savedIssue = await newIssue.save();

        // Find user and update their stats
        await User.findOneAndUpdate(
            { email: req.body.reporterEmail }, // Use email as it's unique
            { 
                $push: { issuesReported: savedIssue._id },
                $inc: { karmaPoints: 50 } // +50 points for every report
            }
        );

        res.status(201).json(savedIssue);
    } catch (error) {
        console.error("Submission Error:", error);
        res.status(500).json({ error: "Failed to save issue" });
    }
});
// --- UPDATED ISSUE SUBMISSION API ---
app.post('/api/issues', async (req, res) => {
    try {
        // Create and save the new issue
        const newIssue = new Issue(req.body);
        const savedIssue = await newIssue.save();

        // 1. Find the reporting user by email
        // 2. Add the issue ID to their 'issuesReported' array
        // 3. Add 50 points to their 'karmaPoints'
        await User.findOneAndUpdate(
            { email: req.body.reporterEmail },
            { 
                $push: { issuesReported: savedIssue._id },
                $inc: { karmaPoints: 50 } 
            }
        );

        res.status(201).json(savedIssue);
    } catch (error) {
        console.error("Submission Error:", error);
        res.status(500).json({ error: "Failed to submit report" });
    }
});
// --- UPDATED VOTE API ---
app.post('/api/issues/:id/vote', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, voteType } = req.body;
        
        const issue = await Issue.findById(id);
        if (!issue) return res.status(404).json({ error: "Issue not found" });

        // Check if user already voted
        if (issue.yesVotes.includes(email) || issue.noVotes.includes(email)) {
            return res.status(400).json({ error: "You have already voted on this issue." });
        }

        // Apply the vote
        if (voteType === 'yes') {
            issue.yesVotes.push(email);
        } else if (voteType === 'no') {
            issue.noVotes.push(email);
            // Threshold for auto-resolution
            if (issue.noVotes.length >= 3) issue.status = "Resolved";
        }
        
        await issue.save();

        // REWARD THE USER: Increment karmaPoints by 10 for voting
        await User.findOneAndUpdate(
            { email: email },
            { $inc: { karmaPoints: 10 } }
        );
        
        res.json({ ...issue._doc, id: issue._id.toString() });
    } catch (error) {
        console.error("Vote Error:", error);
        res.status(500).json({ error: "Failed to process vote" });
    }
});
// PUT /api/issues/:id/resolve
// 'resolutionImage' must match the key used in formData.append() on the frontend
app.put('/api/issues/:id/resolve', upload.single('resolutionImage'), async (req, res) => {
    try {
        const issueId = req.params.id;
        const { resolutionDescription } = req.body;

        // 1. Log to your terminal so you can see if the ID is correct
        console.log("Attempting to resolve issue ID:", issueId);

        // 2. The actual MongoDB Update command
        const updatedIssue = await Issue.findByIdAndUpdate(
            issueId,
            {
                $set: {
                    status: 'resolved',
                    resolutionDescription: resolutionDescription,
                    resolutionImage: req.file ? `/uploads/${req.file.filename}` : null,
                    resolvedAt: new Date()
                }
            },
            { new: true } // This returns the fixed document to the frontend
        );

        // 3. Check if MongoDB actually found the document
        if (!updatedIssue) {
            console.log("❌ Error: Issue ID not found in MongoDB.");
            return res.status(404).json({ message: "Issue not found in database." });
        }

        console.log("✅ MongoDB Update Successful:", updatedIssue.title);
        res.status(200).json(updatedIssue);

    } catch (error) {
        console.error("❌ Backend Crash:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
// --- COMMENT API ---
app.post('/api/issues/:id/comment', async (req, res) => {
    try {
        const { id } = req.params;
        const { user, text } = req.body;
        
        const issue = await Issue.findById(id);
        if (!issue) return res.status(404).json({ error: "Issue not found" });

        issue.comments.push({ user, text });
        await issue.save(); 
        res.json({ ...issue._doc, id: issue._id.toString() });
    } catch (error) {
        res.status(500).json({ error: "Failed to add comment" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Localoop Server running at http://localhost:${PORT}`));