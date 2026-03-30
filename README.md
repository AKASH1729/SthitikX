# GeoTrack Pro - Employee Tracking & Attendance System

A production-ready, real-time employee tracking and attendance management system.

## 🏗️ Architecture Overview

```
geotrack/
├── backend/          # Node.js + Express REST API + Socket.io
├── frontend/         # React.js Admin Dashboard
├── mobile-pwa/       # Progressive Web App for employees
└── docs/             # API documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6+
- npm or yarn

### Backend Setup
```bash
cd backend
cp .env.example .env     # Fill in your credentials
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
cp .env.example .env
npm install
npm start
```

### Mobile PWA Setup
```bash
cd mobile-pwa
cp .env.example .env
npm install
npm start
```

## 🔑 Default Credentials
- Admin: admin@geotrack.com / Admin@123
- Employee: emp@geotrack.com / Emp@123

## 📡 Real-time Features
- WebSocket-based live location updates
- Instant geo-fence breach alerts
- Live dashboard updates

## 🔒 Security
- JWT-based authentication
- Role-based access control (Admin/Employee)
- Rate limiting on all endpoints
- Helmet.js security headers
- Input sanitization
