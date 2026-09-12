Localoop - Community Issue Reporting System
Localoop is a full-stack web application that allows citizens to report local issues (like broken street lights or potholes) and enables government officials to resolve them.



live site:https://localoop.onrender.com/



Prerequisites
Before running this project, ensure you have the following installed:

Node.js (v16 or higher)

MongoDB (Running locally on port 27017)

MongoDB Compass (Optional, to view your data)

Installation & Setup
1. Clone the Repository
First, download the code to your local machine:

Bash
git clone https://github.com/your-username/localoop.git
cd localoop
2. Install Dependencies (node_modules)
The project requires several packages (Express, Mongoose, Multer) to function. Run this command in your terminal to create the node_modules folder and install everything listed in package.json:

Bash
npm install
3. Setup the Uploads Directory
The server needs a folder to store images of resolved issues. If it doesn't exist, create it:

Bash
mkdir uploads
How to Run the Application
1. Start MongoDB
Ensure your MongoDB service is running. If you are using MongoDB Community Server, it usually starts automatically.

2. Start the Node.js Server
Run the following command in your terminal:

Bash
npm start
Alternatively, if you don't have a start script defined, use: node server.js

3. Access the App
Open your web browser and go to:

Citizen Portal: http://localhost:3000/index.html

Government Portal: http://localhost:3000/gov/index.html

Project Structure
server.js: The main backend logic and API routes.

/public: Frontend files for Citizens (HTML/CSS/JS).

/gov: Frontend files for Government Officials.

/uploads: Storage for resolution images.

Troubleshooting
Login failing? Ensure you have registered a user in the users collection via the Signup page first.

500 Internal Server Error? Check the terminal where Node.js is running; it will show the specific line of code that is crashing.

Pins not turning green? Ensure the CSS class .marker-resolved is present in your HTML and that the issue status in MongoDB is exactly "resolved".
