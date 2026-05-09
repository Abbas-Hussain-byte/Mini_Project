# CivicPulse 🏙️
### *Fixing our cities, one AI at a time.*

**CivicPulse** is an AI-driven urban management platform designed to automate the detection, reporting, and resolution of civic issues. By leveraging a **Hybrid AI Pipeline**—combining **YOLOv11** for computer vision and **DistilBERT** for natural language processing—it transforms the traditional, slow complaint process into a real-time, data-driven system.

---

## 🚀 Live Demo
- **Frontend**: [miniproject-civicpulse.vercel.app](https://miniproject-civicpulse.vercel.app)
- **Backend API**: [civicpulse-backend-2unt.onrender.com/api/health](https://civicpulse-backend-2unt.onrender.com/api/health)

---

## ✨ Key Features

- **🤖 Hybrid AI Pipeline**: Combines **YOLOv11** (Computer Vision) to detect physical issues (potholes, parking) and **DistilBERT** (NLP) to analyze complaint descriptions for higher accuracy and intent detection.
- **📍 Automated Routing**: Intelligent categorization ensures complaints are sent to the correct department (Roads, Electricity, Law Enforcement) instantly based on multi-modal AI analysis.
- **📊 Admin Analytics**: A comprehensive dashboard for city officials to track resolution times, heatmap of issues, and department performance.
- **🛠️ Department Workflow**: Specialized portals for department heads to assign workers, update status, and verify resolutions.
- **📱 Responsive Citizen Portal**: Easy-to-use interface for citizens to report issues and track progress in real-time.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, TailwindCSS, Lucide Icons
- **Backend**: Node.js, Express, Supabase (Auth & Database)
- **Machine Learning**: 
    - **Computer Vision**: YOLOv11 (PyTorch)
    - **NLP**: DistilBERT (Hugging Face Transformers)
    - **Inference**: Flask & Gunicorn on Hugging Face Spaces / Render
- **Deployment**: Vercel (Frontend), Render (Backend), Supabase (PostgreSQL)

---

## 🧪 Interviewer Walkthrough (Test Accounts)

To experience the full lifecycle of a civic issue, please follow these steps in order:

### 1. The Citizen Experience (Report an Issue)
- **Action**: Log in as a citizen and report a pothole or illegal parking.
- **Credentials**:
  - **Email**: `abbas23241a0501@grietcollege.com`
  - **Password**: `Abbas@1`
- **What to look for**: Upload an image and watch the **AI model** automatically categorize the issue and extract the location.

### 2. The Department Action (Resolution)
- **Action**: Log in as a Department Head to see the assigned task.
- **Credentials**:
  - **Email**: `vamsikrishna@gmail.com`
  - **Password**: `Vmasi@123`
- **What to look for**: View the "Assigned Tasks," update the status to "In Progress," and eventually "Resolved."

### 3. The Admin Overview (Governance)
- **Action**: Log in as the Super Admin to see the big picture.
- **Credentials**:
  - **Email**: `abbashussain0986@gmail.com`
  - **Password**: `Abbas@123`
- **What to look for**: Explore the **Analytics Heatmap**, monitor department response times, and manage system-wide priorities.

---

## 🔧 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/abbas-hussain-byte/Mini_Project.git
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   # Create a .env file with your Supabase credentials
   npm start
   ```

3. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 📄 License
This project is developed as part of a Mini Project at GRIET. All rights reserved.
