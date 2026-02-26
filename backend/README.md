# FSKTM ZKP Evaluation System - Backend

Zero-Knowledge Proof based authentication system for UTHM FSKTM Postgraduate Research Symposium evaluation.

## 🚀 Features

- **Zero-Knowledge Proof Authentication**: Passwordless login using zk-SNARK cryptographic proofs
- **Role-Based Access Control**: Admin, Panel Member, and Student roles
- **Evaluation Management**: Complete CRUD operations for symposium evaluations
- **Historical Feedback Search**: Full-text search across all past evaluations
- **Rubric Management**: Customizable evaluation criteria
- **Timetable Scheduling**: Manage presentation sessions
- **Attendance Tracking**: QR code-based check-in system
- **Analytics Dashboard**: Performance trends and statistics

## 📋 Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 6.0 (local or MongoDB Atlas)
- npm or yarn

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd fsktm-zkp-system/backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/fsktm_symposium

# JWT
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRE=7d

# Frontend
FRONTEND_URL=http://localhost:5173

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 4. Start MongoDB

**Local MongoDB:**
```bash
mongod --dbpath /path/to/data
```

**Or use MongoDB Atlas** (recommended for production):
- Create free cluster at https://mongodb.com/cloud/atlas
- Get connection string and update `MONGODB_URI`

### 5. Seed Database (Optional)

```bash
npm run seed
```

This creates:
- Admin account
- Sample panel members
- Sample students
- Default evaluation rubrics

### 6. Start Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server will start on `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── models/
│   │   ├── User.js               # User model (Admin/Panel/Student)
│   │   ├── Evaluation.js         # Evaluation model
│   │   └── index.js              # Rubric, Feedback, Timetable, Attendance
│   ├── controllers/
│   │   ├── authController.js     # Authentication logic
│   │   └── evaluationController.js # Evaluation CRUD
│   ├── routes/
│   │   ├── auth.js               # Auth routes
│   │   ├── evaluation.js         # Evaluation routes
│   │   ├── feedback.js           # Feedback search routes
│   │   ├── rubric.js             # Rubric management
│   │   ├── timetable.js          # Schedule management
│   │   ├── attendance.js         # Attendance tracking
│   │   ├── user.js               # User management
│   │   └── analytics.js          # Analytics & statistics
│   ├── middleware/
│   │   ├── auth.js               # JWT authentication
│   │   └── errorHandler.js       # Global error handler
│   ├── services/
│   │   └── zkpService.js         # ZKP proof generation/verification
│   ├── circuits/                 # ZKP circuit files (circom)
│   └── server.js                 # Express app entry point
├── package.json
└── .env.example
```

## 🔐 API Endpoints

### Authentication

```
POST   /api/auth/challenge       # Get ZKP challenge
POST   /api/auth/login           # Login with ZKP proof
GET    /api/auth/me              # Get current user
POST   /api/auth/logout          # Logout
POST   /api/auth/register        # Register new user (admin only)
```

### Evaluations

```
GET    /api/evaluations          # Get all evaluations (with filters)
POST   /api/evaluations          # Create evaluation
GET    /api/evaluations/:id      # Get single evaluation
PUT    /api/evaluations/:id      # Update evaluation
DELETE /api/evaluations/:id      # Delete evaluation
GET    /api/evaluations/student/:id  # Get student's evaluations
GET    /api/evaluations/stats    # Get statistics
```

### Feedback

```
GET    /api/feedback/search      # Full-text search
GET    /api/feedback/my-feedback # Get my feedback
```

### Rubrics

```
GET    /api/rubrics              # Get all rubrics
POST   /api/rubrics              # Create rubric
PUT    /api/rubrics/:id          # Update rubric
```

### Timetable

```
GET    /api/timetable            # Get schedule
POST   /api/timetable            # Create session
```

### Attendance

```
POST   /api/attendance/checkin   # Check in
GET    /api/attendance/student/:id  # Get attendance history
POST   /api/attendance/qr-generate  # Generate QR code
```

### Users

```
GET    /api/users                # Get all users (admin)
PUT    /api/users/:id            # Update user (admin)
```

### Analytics

```
GET    /api/analytics/overview   # Dashboard stats
GET    /api/analytics/trends     # Score trends
```

## 🔒 Authentication Flow

### 1. Request Challenge

```bash
curl -X POST http://localhost:5000/api/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"userId": "PANEL001"}'
```

Response:
```json
{
  "success": true,
  "challenge": "abc123...",
  "expiresAt": "2024-12-16T10:00:00.000Z"
}
```

### 2. Generate Proof (Client-side)

Client generates ZKP proof using the challenge and secret phrase.

### 3. Login with Proof

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "PANEL001",
    "proof": "{...}",
    "publicKey": "xyz789..."
  }'
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "...",
    "userId": "PANEL001",
    "name": "Dr. Rahman",
    "role": "panel"
  }
}
```

### 4. Use Token

Include token in Authorization header:
```bash
curl http://localhost:5000/api/evaluations \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

## 🧪 Testing

Run tests:
```bash
npm test
```

Test coverage:
```bash
npm test -- --coverage
```

## 📊 Database Models

### User Model
```javascript
{
  userId: String,           // PANEL001, STU001
  name: String,
  email: String,
  role: String,             // 'admin', 'panel', 'student'
  matricNumber: String,     // Students only
  program: String,
  researchTitle: String,
  zkpPublicKey: String,
  isActive: Boolean
}
```

### Evaluation Model
```javascript
{
  studentId: ObjectId,
  evaluatorId: ObjectId,
  semester: String,
  sessionType: String,
  date: Date,
  rubricId: ObjectId,
  criteria: [{
    name: String,
    weight: Number,
    score: Number,
    comments: String
  }],
  overallScore: Number,
  overallComments: String,
  recommendations: String,
  zkpSignature: String
}
```

## 🔧 Development

### Adding New Routes

1. Create controller in `src/controllers/`
2. Create routes in `src/routes/`
3. Import in `src/server.js`

### Database Indexes

Indexes are automatically created on startup. See `src/config/database.js`

### ZKP Circuit Development

1. Install circom: https://docs.circom.io/getting-started/installation/
2. Edit circuit in `src/circuits/auth.circom`
3. Compile circuit
4. Generate trusted setup
5. Update verification key

## 🚀 Deployment

### Heroku

```bash
heroku create fsktm-zkp-backend
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=<your-atlas-uri>
heroku config:set JWT_SECRET=<your-secret>
git push heroku main
```

### Render

1. Connect GitHub repository
2. Select "Web Service"
3. Build Command: `npm install`
4. Start Command: `node src/server.js`
5. Add environment variables

### Docker

```bash
docker build -t fsktm-zkp-backend .
docker run -p 5000:5000 --env-file .env fsktm-zkp-backend
```

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| NODE_ENV | Environment | development |
| MONGODB_URI | MongoDB connection string | localhost |
| JWT_SECRET | JWT signing secret | (required) |
| JWT_EXPIRE | Token expiry | 7d |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:5173 |
| SMTP_HOST | Email server host | smtp.gmail.com |
| SMTP_PORT | Email server port | 587 |
| SMTP_USER | Email username | (required) |
| SMTP_PASS | Email password | (required) |

## 🐛 Troubleshooting

### MongoDB Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

Solution: Ensure MongoDB is running or check MONGODB_URI

### JWT Token Errors

```
Error: jwt malformed
```

Solution: Ensure JWT_SECRET is set in .env

### ZKP Verification Fails

```
Error: Invalid proof
```

Solution:
- Check client and server use same circuit
- Verify challenge hasn't expired
- Ensure public key matches

## 📚 Resources

- [Express.js Documentation](https://expressjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [snarkjs Documentation](https://github.com/iden3/snarkjs)
- [Circom Documentation](https://docs.circom.io/)

## 👥 Support

For issues and questions:
- Email: fsktm.symposium@uthm.edu.my
- GitHub Issues: [Create an issue]

## 📄 License

MIT License - See LICENSE file for details

---

**Developed by FSKTM Development Team**
