# GeoTrack Pro — Architecture Documentation

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          GeoTrack Pro System                            │
│                                                                         │
│   ┌──────────────────────┐         ┌──────────────────────────────┐    │
│   │    EMPLOYEE MOBILE   │         │      ADMIN DASHBOARD         │    │
│   │      PWA (React)     │         │        (React.js)            │    │
│   │                      │         │                              │    │
│   │  • Clock In/Out      │         │  • Live Map (Google Maps)    │    │
│   │  • GPS Tracking      │         │  • Employee Management       │    │
│   │  • Offline Support   │         │  • Attendance Reports        │    │
│   │  • Installable App   │         │  • Alerts & Geofences        │    │
│   └──────────┬───────────┘         └──────────────┬───────────────┘    │
│              │                                    │                     │
│              │  REST API (HTTPS)                  │  REST API (HTTPS)   │
│              │  WebSocket (WSS)                   │  WebSocket (WSS)    │
│              │                                    │                     │
│   ┌──────────▼────────────────────────────────────▼───────────────┐    │
│   │                    Node.js / Express.js                        │    │
│   │                     API Server :5000                           │    │
│   │                                                                │    │
│   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │    │
│   │   │  REST Routes │  │  Socket.io   │  │   Middleware      │   │    │
│   │   │              │  │  Manager     │  │                   │   │    │
│   │   │  /auth       │  │              │  │  • JWT Auth       │   │    │
│   │   │  /users      │  │  • Rooms:    │  │  • Rate Limiting  │   │    │
│   │   │  /attendance │  │    admins    │  │  • Helmet (CSP)   │   │    │
│   │   │  /locations  │  │    employee  │  │  • CORS           │   │    │
│   │   │  /geofences  │  │    :id       │  │  • Input Sanitize │   │    │
│   │   │  /dashboard  │  │              │  │                   │   │    │
│   │   └──────────────┘  └──────────────┘  └──────────────────┘   │    │
│   │                                                                │    │
│   └────────────────────────────┬───────────────────────────────────┘    │
│                                │                                        │
│                    ┌───────────▼──────────┐                            │
│                    │    MongoDB Atlas     │                            │
│                    │                      │                            │
│                    │  Collections:        │                            │
│                    │  • users             │                            │
│                    │  • attendances       │                            │
│                    │  • locationlogs      │                            │
│                    │  • geofences         │                            │
│                    │  • alerts            │                            │
│                    └──────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Real-Time Location Tracking

```
Employee Device                  API Server               Admin Dashboard
     │                               │                          │
     │  1. GET /auth/me              │                          │
     │──────────────────────────────►│                          │
     │  ← JWT verified               │                          │
     │                               │                          │
     │  2. WebSocket connect         │                          │
     │  { auth: { token } }          │                          │
     │──────────────────────────────►│                          │
     │                               │  Socket joins            │
     │                               │  room: employee:<id>     │
     │                               │                          │
     │  3. POST /attendance/clock-in │                          │
     │  { lat, lng }                 │                          │
     │──────────────────────────────►│                          │
     │                               │  Validate vs geofence    │
     │                               │  Save to MongoDB         │
     │                               │──── emit(employee:clocked-in) ──►│
     │  ← { attendance, inZone }     │                          │
     │                               │                          │
     │  4. Every 15 seconds:         │                          │
     │  WS: location:ping            │                          │
     │  { lat, lng, accuracy }       │                          │
     │──────────────────────────────►│                          │
     │                               │  Check geofence          │
     │                               │  Save LocationLog        │
     │                               │──── emit(location:update) ──────►│
     │                               │                          │  Updates map marker
     │                               │                          │
     │  5. [If exits geofence]        │                         │
     │                               │  Create Alert            │
     │                               │──── emit(alert:geofence-exit) ──►│
     │                               │                          │  Show alert banner
     │                               │                          │
     │  6. POST /attendance/clock-out│                          │
     │──────────────────────────────►│                          │
     │                               │  Calculate total hours   │
     │                               │──── emit(employee:clocked-out) ─►│
     │  ← { totalHours: 8.5 }        │                          │
```

---

## Database Schema Design

### users
```
{
  _id:              ObjectId
  name:             String
  email:            String (unique, indexed)
  password:         String (bcrypt, select: false)
  role:             "admin" | "employee"
  employeeId:       String (auto: "EMP0001", unique)
  department:       String
  phone:            String
  assignedGeofence: ObjectId → geofences
  isActive:         Boolean
  isTracking:       Boolean (live flag)
  lastLocation:     { lat, lng, timestamp }
  refreshToken:     String (select: false)
  createdAt, updatedAt
}
```

### attendances
```
{
  _id:      ObjectId
  employee: ObjectId → users
  date:     String "YYYY-MM-DD"  ← indexed for fast date queries
  clockIn:  {
    timestamp:        Date
    location:         { lat, lng, address }
    isWithinGeofence: Boolean
  }
  clockOut: {
    timestamp:        Date
    location:         { lat, lng, address }
    isWithinGeofence: Boolean
  }
  totalHours: Number
  status:     "present" | "late" | "half-day" | "absent" | "on-leave"
  geofence:   ObjectId → geofences
  
  INDEX: { employee, date } UNIQUE  ← one record per employee per day
}
```

### locationlogs
```
{
  _id:       ObjectId
  employee:  ObjectId → users  ← indexed
  location:  GeoJSON Point { coordinates: [lng, lat] }  ← 2dsphere index
  lat, lng:  Number (denormalized for easy access)
  accuracy:  Number (meters)
  speed:     Number (m/s)
  heading:   Number (degrees)
  date:      String "YYYY-MM-DD"  ← indexed
  isInsideGeofence: Boolean
  attendance: ObjectId → attendances
  timestamp: Date  ← indexed
  
  COMPOUND INDEX: { employee, date, timestamp }
  GEO INDEX:      { location: "2dsphere" }
}
```

### geofences
```
{
  _id:         ObjectId
  name:        String
  description: String
  center:      { lat: Number, lng: Number }
  radius:      Number (meters, 50–10000)
  address:     String
  color:       String (hex)
  isActive:    Boolean
  createdBy:   ObjectId → users
  createdAt, updatedAt
  
  VIRTUAL: employeeCount (populated from users.assignedGeofence)
}
```

### alerts
```
{
  _id:      ObjectId
  employee: ObjectId → users
  type:     "geofence_exit" | "geofence_entry" | "late_clockin" | "no_clockin" | "unusual_movement"
  message:  String
  location: { lat, lng }
  geofence: ObjectId → geofences
  severity: "low" | "medium" | "high"
  isRead:   Boolean (default: false)
  timestamp: Date
  
  INDEX: { employee, isRead }
  INDEX: { timestamp: -1 }
}
```

---

## Security Architecture

```
Request Flow:
─────────────────────────────────────────────────────
HTTP Request
    │
    ▼
Helmet.js ──── Sets: X-Frame-Options, CSP, HSTS
    │
    ▼
CORS ─────────── Allows only CLIENT_URL & MOBILE_URL
    │
    ▼
Rate Limiter ─── 100 req/15min global; 10 req/15min auth
    │
    ▼
JWT Middleware ── Validates Bearer token; attaches req.user
    │
    ▼
Role Guard ────── authorize('admin') blocks employees
    │
    ▼
express-validator ─ Validates + sanitizes request body
    │
    ▼
Controller ─────── Business logic
    │
    ▼
Mongoose ──────── Schema validation; password never returned
    │
    ▼
MongoDB ─────────── Encrypted at rest (Atlas)
```

---

## Geofence Algorithm (Haversine)

```javascript
// Checks if employee coordinates are within the circular zone
function isInsideGeofence(empLat, empLng, zoneLat, zoneLng, radiusMeters) {
  const R = 6371000;  // Earth radius in meters
  const φ1 = toRad(empLat),  φ2 = toRad(zoneLat);
  const Δφ = toRad(zoneLat - empLat);
  const Δλ = toRad(zoneLng - empLng);

  const a = sin²(Δφ/2) + cos(φ1)·cos(φ2)·sin²(Δλ/2);
  const distance = R · 2 · atan2(√a, √(1−a));

  return distance <= radiusMeters;
}
// Accuracy: ~0.5m error — sufficient for 50m+ geofences
```

---

## Deployment Architecture (Production)

```
Internet
    │
    ▼
Cloudflare (DDoS protection + CDN)
    │
    ├──► Static Files ──► AWS S3 + CloudFront
    │       (React builds: frontend + mobile-pwa)
    │
    └──► API Requests ──► AWS Application Load Balancer
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
              EC2 Instance 1       EC2 Instance 2
              (Node.js + PM2)      (Node.js + PM2)
                    │                     │
                    └──────────┬──────────┘
                               │
                               ▼
                    MongoDB Atlas (M10+ cluster)
                    3-node replica set, encrypted
```

---

## Key Design Decisions

| Decision                    | Choice                    | Rationale                                              |
|-----------------------------|---------------------------|--------------------------------------------------------|
| Real-time transport         | Socket.io                 | Automatic fallback to long-polling; handles reconnects |
| Location storage            | MongoDB + 2dsphere index  | Enables geospatial queries; handles high write volume  |
| GPS throttle                | 15-second intervals       | Balances battery life vs. tracking resolution          |
| Geofence shape              | Circle (radius-based)     | Simple, accurate, low compute; covers 90% of use cases |
| Auth                        | JWT + Refresh tokens      | Stateless scaling; 7d access / 30d refresh             |
| Password hashing            | bcrypt (12 rounds)        | Industry standard; ~250ms hash time prevents brute force |
| Soft deletes                | `isActive: false`         | Preserves attendance history; audit trail              |
| Attendance uniqueness       | Compound index `{employee, date}` | One record/day enforced at DB level            |
| Distance calculation        | Haversine formula         | Accurate for small distances without geo libraries     |
