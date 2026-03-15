# FSKTM Symposium ZKP Evaluation System

> **Zero-Knowledge Proof-Based Authentication for Passwordless Login in a Web-Based Evaluation System for UTHM FSKTM Postgraduate Research Symposium**

Complete production-ready system with React frontend, Node.js backend, MongoDB database, and **secp256k1 Elliptic Curve (Schnorr Protocol)** cryptographic authentication.

---

## 📦 System Overview

A modern web-based evaluation system designed specifically for UTHM FSKTM postgraduate research symposiums, featuring passwordless Zero-Knowledge Proof authentication, comprehensive evaluation management, and real-time analytics.

### Key Features

- 🔐 **True Zero-Knowledge Proof** authentication (secp256k1 Elliptic Curve, no passwords)
- 📊 **Complete Evaluation System** with weighted rubric scoring
- 📅 **Session Management** with QR code attendance tracking
- 📈 **Real-time Analytics** for students, panels, and administrators
- 🔍 **Historical Feedback Search** with semester filtering
- 👥 **Multi-device Support** with Hybrid E2EE device trust management
- 📱 **Responsive Design** for desktop and mobile devices

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- MongoDB 6.0+ (local or MongoDB Atlas)

### Installation

#### 1. Clone and Setup

```bash
# Clone repository
git clone [repository-url]
cd fsktm-zkp-system

# Install all dependencies (Monorepo setup)
npm run install:all
2. Configure Environment
Backend (backend/.env):

Code snippet
PORT=5000
MONGODB_URI=mongodb://localhost:27017/fsktm-zkp
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
EMAIL_USER=your_university_email@gmail.com
EMAIL_PASS=your_16_digit_app_password
NODE_ENV=development
Frontend (frontend/.env):

Code snippet
VITE_API_URL=http://localhost:5000/api
3. Initialize Database
Bash
cd backend
npm run seed
This creates:

1 Admin user (ADMIN001)

3 Panel users (PANEL001, PANEL002, PANEL003)

5 Student users (STU001 - STU005)

Sample rubrics and active timetable sessions

4. Start Development Server
From the root folder of the project, run:

Bash
npm run dev
(This starts both the React frontend at http://localhost:5173 and the Node API at http://localhost:5000 simultaneously).

🔐 Zero-Knowledge Proof Authentication
How It Works (Schnorr Protocol)
This system uses the secp256k1 Elliptic Curve (the same cryptography that secures Bitcoin) for mathematically sound, true passwordless authentication:

Plaintext
┌─────────────────────────────────────────────────────────────┐
│                    REGISTRATION PHASE                       │
└─────────────────────────────────────────────────────────────┘

Browser (Client)                          Server
     │                                        │
     │ 1. Enter First-Time Setup Code         │
     │    (e.g., REG-123456)                  │
     │                                        │
     │ 2. Generate secp256k1 Key Pair         │
     │    Private Key (x): Stays in browser   │
     │    Public Key (Y): Send to server      │
     ├───────────────────────────────────────>│
     │                                        │
     │                                    3. Verify REG Code
     │                                    4. Store Public Key
     │                                        │

┌─────────────────────────────────────────────────────────────┐
│                      LOGIN PHASE                            │
└─────────────────────────────────────────────────────────────┘

Browser (Client)                          Server
     │                                        │
     │ 1. Request Challenge                   │
     ├───────────────────────────────────────>│
     │                                        │
     │                                    2. Generate Random
     │                                       Challenge (c)
     │ 3. Receive Challenge (c)               │
     │<───────────────────────────────────────┤
     │                                        │
     │ 4. Generate Proof (Fiat-Shamir)        │
     │    - Pick random nonce (k)             │
     │    - Calc Commitment R = k * G         │
     │    - Calc scalar h = Hash(Y, R, c)     │
     │    - Calc Response s = k + (h * x)     │
     │                                        │
     │ 5. Send Proof { R, s }                 │
     ├───────────────────────────────────────>│
     │                                        │
     │                                    6. Verify Math Eq:
     │                                       s * G == R + (h * Y)
     │                                    7. Generate JWT token
     │                                        │
     │ 8. Receive JWT Token                   │
     │<───────────────────────────────────────┤
     │                                        │
Security Benefits
✅ No passwords stored anywhere (database, logs, memory)

✅ Private keys never transmitted - stay in browser

✅ Phishing-resistant - the proof changes every single login

✅ Device-bound security - keys tied to specific trusted devices

✅ E2EE Device Syncing - transfer keys via AES-GCM + RSA-OAEP bridging

💻 System Architecture
Core Modules
Authentication: ZKP Elliptic Curve Math, JWT, Device Tracking

Evaluations: CRUD, Weighted Scoring, Comments, Privacy Fencing

Rubrics: Dynamic Criteria, Weight Validation

Timetable: Symposium Sessions, QR Generation

Attendance: QR Verification, Manual Override, Co-Panel Validation

Users: Role-Based Access Control (SuperAdmin, Admin, Coordinator, Panel, Student)

Feedback: Search, Historical Archive

Audit Trail: Tamper-proof logging of all system events

🛠️ Technology Stack
Frontend
Framework: React 18.3 with Vite

Styling: Tailwind CSS 3.4

Routing: React Router v6

Cryptography: elliptic (secp256k1), crypto-js (SHA256), Web Crypto API

Charts: Recharts (for analytics)

Backend
Runtime: Node.js 18+

Framework: Express.js 4.21

Database ODM: Mongoose 8.8

Authentication: JWT (jsonwebtoken)

Cryptography: elliptic (secp256k1 Verification)

Email: Nodemailer (Automated setup codes)

Database
System: MongoDB 6.0+

Features: Embedded documents, Map types, strict Indexing

🔒 Security Features
Authentication Security
✅ True Zero-Knowledge Proof (Schnorr secp256k1)

✅ No password storage anywhere

✅ Challenge-response protocol (Replay-attack prevention)

✅ JWT tokens (7-day expiry)

✅ Device tracking and remote revocation

Application Security
✅ Strict Role-based access control (RBAC) at Controller level

✅ Cryptographic Audit Trail logging (ActivityLog)

✅ MongoDB injection prevention

✅ Encrypted E2EE device synchronization

✅ Sensitive data minimization (PDPA compliant)

🤝 Contributing
This is an academic research project for UTHM FSKTM. For improvements or bug fixes:

Fork the repository

Create feature branch (git checkout -b feature/improvement)

Commit changes (git commit -am 'Add improvement')

Push to branch (git push origin feature/improvement)

Open Pull Request

📄 License
MIT License - See LICENSE file for details.

This project is part of academic research at Universiti Tun Hussein Onn Malaysia (UTHM).

👥 Team
Author: Tan Yue Bao (AI230131)

Supervisor: Dr. Nurziadah binti Harun

Institution: Universiti Tun Hussein Onn Malaysia (UTHM)

Faculty: Computer Science and Information Technology (FSKTM)

Program: Bachelor of Computer Science in Information Security

Year: 2026/2027

🎯 Project Objectives (Achieved ✅)
✅ Design web-based evaluation system with Zero-Knowledge Proof

✅ Implement secp256k1 Elliptic Curve passwordless authentication

✅ Develop complete React + Node.js + MongoDB stack

✅ Create enterprise Role-Based Access Control (RBAC) architecture

✅ Implement weighted rubric scoring system

✅ Enable QR code-based attendance tracking & Co-Panel verification

✅ Build real-time analytics dashboards

✅ Support multi-device access with Hybrid E2EE key syncing

✅ Ensure PDPA compliance (data minimization)

✅ Include Automated System Backups and Audit Logging

© 2026 UTHM FSKTM | Built for Academic Excellence 🎓

Advancing Research Evaluation Through Zero-Knowledge Cryptography
```
