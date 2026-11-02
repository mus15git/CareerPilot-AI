# CareerPilot AI

An AI-powered interview preparation platform that helps candidates prepare for job opportunities using their resume and target job description.

## Features
- User registration and login
- Resume upload and job description input
- AI-generated interview preparation reports
- Technical and behavioral interview questions
- Skill-gap insights and preparation roadmap
- Saved interview reports
- PDF generation

## Tech Stack
- **Frontend:** React, Vite, React Router, Axios, SCSS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB, Mongoose
- **Authentication:** JWT, bcryptjs
- **AI:** Google Gemini API
- **File/PDF processing:** Multer, PDF parsing, Puppeteer

## How It Works
1. Register or log in.
2. Upload your resume and enter a job description.
3. CareerPilot AI processes the information and generates a personalized preparation report.
4. Review interview questions, skill gaps, and preparation guidance.
5. Access saved reports and generate a PDF when available.

## Project Structure
```text
CareerPilot-AI/
├── Backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   └── server.js
├── Frontend/
│   └── src/
└── README.md
```

## Getting Started

### Prerequisites
- Node.js and npm
- MongoDB or MongoDB Atlas
- Google Gemini API key

### 1. Clone the repository
```bash
git clone https://github.com/mus15git/CareerPilot-AI.git
cd CareerPilot-AI
```

### 2. Install and run the backend
```bash
cd Backend
npm install
```

Create `Backend/.env` and add the environment variables required by your backend code, such as the MongoDB connection string, JWT secret, Gemini API key, and server port.

Start the backend using the script in `Backend/package.json`. If no start script is defined, run:
```bash
node server.js
```

### 3. Install and run the frontend
In a separate terminal:
```bash
cd Frontend
npm install
npm run dev
```

Open the local URL shown by Vite. Make sure the frontend API configuration points to your backend URL.

> Keep real `.env` files, API keys, passwords, and personal resumes out of GitHub. Check your source code for the exact environment variable names before running the application.

## Author
**Muskan Yadav** · [GitHub](https://github.com/mus15git)
