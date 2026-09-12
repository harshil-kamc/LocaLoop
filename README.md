# 🏙️ Localoop

> **Hyperlocal Civic Issue Reporting & Municipal Governance Platform**  
> Bridging the gap between active citizens and local authorities through transparent, map-based civic management.

[![Node.js Version](https://img.shields.io/badge/Node.js-16%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20%2F%20In--Memory-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Leaflet Maps](https://img.shields.io/badge/Maps-Leaflet.js-199900?style=flat-square&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=flat-square)](LICENSE)

---

## 📌 Overview

**Localoop** is a full-stack civic engagement platform that empowers residents to report hyperlocal neighborhood issues—such as damaged asphalt, broken streetlights, illegal dumping, and water main breaks—directly onto a shared geospatial map.

Municipal authorities and ward officials are equipped with a dedicated **Government Management Portal** to review complaints, dispatch field crews, update real-time progress, and upload verified photographic proof of resolution.

---

## ✨ Key Features

### 📍 Citizen Portal
- **Interactive Geospatial Map**: View all nearby civic reports with real-time status markers (Pending, In Progress, Resolved).
- **Accidental-Click Proof Reporting**: Dedicated **Report Issue** action button with focused full-screen pin-drop mode and coordinate capture.
- **Multimodal Evidence Submission**: Upload photographic evidence, choose categories, assign urgency levels, and add detailed descriptions.
- **Community Validation & Voting**: Upvote or downvote reports to help authorities prioritize urgent neighborhood problems.
- **Public Discussion Thread**: Comment directly on issue tickets to coordinate with neighbors and municipal inspectors.
- **Civic Karma & Leaderboard**: Earn karma points for verified reporting and constructive community participation.

### 🏛️ Government Portal (`/gov`)
- **Municipal Command Dashboard**: Comprehensive live feed of citywide infrastructure tickets.
- **Status Lifecycle Control**: Seamlessly transition tickets through `Pending` ➔ `In Progress` ➔ `Resolved`.
- **Resolution Verification**: Upload before-and-after resolution photos and dispatch logs visible to all citizens.
- **Filter & Search Engine**: Filter issues by category (Roads, Sanitation, Lighting, Water Supply), urgency, or neighborhood.

### ⚡ Hybrid Persistence Architecture
- **Zero-Setup In-Memory Mode**: Runs instantly out of the box with realistic pre-seeded issues, photo assets, and demo accounts—no external database configuration required for evaluation.
- **Enterprise MongoDB Storage**: Connects automatically to local or cloud-hosted MongoDB instances when `MONGO_URI` is provided.

---

## 🚀 Quick Start

### 1. Prerequisites
Ensure your system has the following installed:
- [Node.js](https://nodejs.org/) (version 16.0 or higher)
- [npm](https://www.npmjs.com/) (bundled with Node.js)
- *(Optional)* [MongoDB](https://www.mongodb.com/) running on port `27017` for persistent database storage.

### 2. Installation

Clone the repository and install project dependencies:

```bash
git clone https://github.com/your-username/localoop.git
cd localoop
npm install
```

### 3. Start the Server

Start the application:

```bash
npm start
```

For development mode:

```bash
npm run dev
```

The application will start on **http://localhost:3000**.

### 4. Access the Portals

| Portal | URL | Description |
| :--- | :--- | :--- |
| **Citizen Portal** | [http://localhost:3000](http://localhost:3000) | Public map, issue submission, community voting & rankings |
| **Government Portal** | [http://localhost:3000/gov/](http://localhost:3000/gov/) | Official inspection dashboard, status controls & resolution logging |

---

## 🔑 Pre-Configured Test Accounts

The platform includes pre-seeded demonstration accounts for immediate testing:

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Citizen** | `citizen@localoop.org` | `password123` | Public reporting, upvoting, comments, karma |
| **Municipal Official** | `official@city.gov` | `password123` | Government dashboard, issue resolution, status updates |

*You can also create new citizen or authority accounts directly through the registration screen.*

---

## ⚙️ Configuration & Environment Variables

Localoop runs without mandatory configuration. To customize ports or connect a persistent database, configure environment variables:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | The network port the HTTP server listens on |
| `MONGO_URI` | `mongodb://localhost:27017/local` | Connection string for MongoDB database instance |

Example using custom variables:

```bash
PORT=8080 MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/localoop npm start
```

---

## 📁 Project Architecture

```text
localoop/
├── public/                       # Citizen frontend assets
│   ├── index.html                # Citizen landing page
│   ├── dashboard.html            # Main map & issue reporting interface
│   ├── dashboard.css             # Dashboard styles, animations, and layouts
│   ├── dashboard.js              # Map controls, report mode, and API integration
│   ├── reports.html              # Filterable list of all community reports
│   ├── leaderboard.html          # Community karma rankings
│   ├── settings.html             # Profile preferences & locality settings
│   ├── auth.html                 # Sign-in & sign-up forms
│   ├── assets/                   # Vector logos, custom icons, and media
│   └── gov/                      # Municipal Government Portal
│       ├── index.html            # Government welcome & navigation hub
│       ├── dashboard.html        # Official incident inspection dashboard
│       ├── dashboard.css         # Government portal theme
│       ├── dashboard.js          # Resolution actions & verification workflow
│       ├── reports.html          # Administrative ticket management
│       ├── leaderboard.html      # Ward and official engagement rankings
│       └── settings.html         # Departmental settings
├── uploads/                      # Uploaded issue photos and resolution evidence
├── server.js                     # Express REST API, auth handlers & database logic
├── package.json                  # Dependencies and execution scripts
└── README.md                     # Project documentation
```

---

## 🔌 REST API Reference

### Authentication
- `POST /api/signup` — Register a new Citizen or Municipal Official account.
- `POST /api/login` — Authenticate user and initialize session.
- `POST /api/logout` — End current session.
- `GET /api/me` — Retrieve the currently authenticated user's profile.

### Issues & Mapping
- `GET /api/issues` — Fetch all reported issues with coordinates, photos, and current statuses.
- `POST /api/issues` — Submit a new issue ticket (supports multipart `FormData` for photo uploads).
- `GET /api/issues/:id` — Retrieve detailed record for a specific issue including comments and audit log.
- `PATCH /api/issues/:id/status` — *(Authority Only)* Update ticket status (`pending`, `in_progress`, `resolved`) and attach resolution proof.
- `POST /api/issues/:id/vote` — Cast an upvote or downvote on a community report.
- `POST /api/issues/:id/comments` — Post a comment to the issue discussion thread.

### Civic Karma & Leaderboard
- `GET /api/leaderboard` — Retrieve ranked users by community contributions and karma points.

---

## 🛠️ Technology Stack

- **Runtime & Backend Framework**: [Node.js](https://nodejs.org/) & [Express 5](https://expressjs.com/)
- **Database & Object Modeling**: [MongoDB](https://www.mongodb.com/) via [Mongoose](https://mongoosejs.com/) (with built-in in-memory fallback)
- **File Upload Pipeline**: [Multer](https://github.com/expressjs/multer)
- **Mapping & Geolocation**: [Leaflet.js](https://leafletjs.com/) & [OpenStreetMap](https://www.openstreetmap.org/)
- **Frontend Architecture**: Modern HTML5, Modular CSS with Custom Properties, Vanilla ES6+ JavaScript
- **Icons & Typography**: FontAwesome 6 & Inter typography

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/improvement`).
3. Commit your changes (`git commit -m 'Add new civic reporting feature'`).
4. Push to the branch (`git push origin feature/improvement`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
