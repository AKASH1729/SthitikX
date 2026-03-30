# GeoTrack Pro — API Documentation

**Base URL:** `http://localhost:5000/api`  
**Auth:** Bearer JWT token in `Authorization` header  
**Content-Type:** `application/json`

---

## Authentication

### POST `/auth/login`
Login and receive JWT tokens.

**Request:**
```json
{ "email": "admin@geotrack.com", "password": "Admin@123" }
```

**Response `200`:**
```json
{
  "success": true,
  "token": "<access_token>",
  "refreshToken": "<refresh_token>",
  "user": {
    "id": "abc123",
    "name": "Super Admin",
    "email": "admin@geotrack.com",
    "role": "admin",
    "employeeId": null
  }
}
```

---

### POST `/auth/refresh`
Get a new access token using refresh token.

**Request:**
```json
{ "refreshToken": "<refresh_token>" }
```

**Response `200`:**
```json
{ "success": true, "token": "<new_access_token>" }
```

---

### GET `/auth/me`
Get the currently authenticated user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**
```json
{
  "success": true,
  "user": {
    "_id": "abc123",
    "name": "Rahul Sharma",
    "email": "rahul@geotrack.com",
    "role": "employee",
    "employeeId": "EMP0001",
    "department": "Engineering",
    "assignedGeofence": {
      "_id": "geo123",
      "name": "HQ Office",
      "center": { "lat": 28.6139, "lng": 77.2090 },
      "radius": 300
    }
  }
}
```

---

### POST `/auth/logout`
Invalidate refresh token and sign out.

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**
```json
{ "success": true, "message": "Logged out successfully." }
```

---

## Users (Admin only)

### GET `/users`
Get all employees with optional filters.

**Query params:**
| Param        | Type    | Description                      |
|--------------|---------|----------------------------------|
| `search`     | string  | Name, email, or employee ID      |
| `department` | string  | Filter by department             |
| `isActive`   | boolean | Filter active/inactive           |
| `page`       | number  | Page number (default: 1)         |
| `limit`      | number  | Records per page (default: 20)   |

**Response `200`:**
```json
{
  "success": true,
  "users": [ { "_id": "...", "name": "...", "employeeId": "EMP0001", ... } ],
  "total": 7,
  "page": 1,
  "pages": 1
}
```

---

### POST `/users`
Create a new employee account.

**Request:**
```json
{
  "name": "Ananya Iyer",
  "email": "ananya@company.com",
  "password": "Secure@123",
  "department": "Engineering",
  "phone": "+91-9876543210",
  "assignedGeofence": "<geofence_id>"
}
```

**Response `201`:**
```json
{
  "success": true,
  "user": { "id": "...", "name": "Ananya Iyer", "employeeId": "EMP0008" },
  "message": "Employee created successfully."
}
```

---

### PUT `/users/:id`
Update employee details. Allowed fields: `name`, `department`, `phone`, `isActive`, `assignedGeofence`.

---

### DELETE `/users/:id`
Soft-delete (deactivate) an employee.

---

## Attendance

### POST `/attendance/clock-in`
Employee clocks in for the day.

**Request:**
```json
{
  "lat": 28.6139,
  "lng": 77.2090,
  "address": "Connaught Place, New Delhi"
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Clocked in successfully.",
  "isWithinGeofence": true,
  "attendance": {
    "_id": "att123",
    "date": "2026-03-28",
    "clockIn": {
      "timestamp": "2026-03-28T03:30:00.000Z",
      "location": { "lat": 28.6139, "lng": 77.2090 },
      "isWithinGeofence": true
    },
    "status": "present"
  }
}
```

---

### POST `/attendance/clock-out`
Employee clocks out.

**Request:**
```json
{ "lat": 28.6139, "lng": 77.2090, "address": "Connaught Place, New Delhi" }
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Clocked out successfully.",
  "attendance": {
    "_id": "att123",
    "totalHours": 8.5,
    "status": "present",
    "clockOut": { "timestamp": "2026-03-28T12:00:00.000Z" }
  }
}
```

---

### GET `/attendance/today`
Get today's attendance record for the logged-in employee.

**Response `200`:**
```json
{
  "success": true,
  "attendance": { ... } // null if not clocked in yet
}
```

---

### GET `/attendance`
Get attendance records with filters.

**Query params:**
| Param        | Type   | Description                          |
|--------------|--------|--------------------------------------|
| `startDate`  | string | Start date `YYYY-MM-DD`              |
| `endDate`    | string | End date `YYYY-MM-DD`                |
| `employeeId` | string | Filter by employee (admin only)      |
| `page`       | number | Page number                          |
| `limit`      | number | Records per page (default: 30)       |

> **Note:** Employees can only access their own records.

---

## Location

### POST `/locations/update`
Send a GPS location ping (employee only).

**Request:**
```json
{
  "lat": 28.6139,
  "lng": 77.2090,
  "accuracy": 8.5,
  "speed": 1.2,
  "heading": 180,
  "attendanceId": "<attendance_id>"
}
```

**Response `200`:**
```json
{
  "success": true,
  "isInsideGeofence": true,
  "log": { "_id": "loc123", "lat": 28.6139, "lng": 77.2090, "timestamp": "..." }
}
```

> **Side effects:** If employee exits geofence, creates an Alert and emits `alert:geofence-exit` via Socket.io.

---

### GET `/locations/live`
Get all employees' last known locations. **Admin only.**

**Response `200`:**
```json
{
  "success": true,
  "employees": [
    {
      "_id": "emp123",
      "name": "Rahul Sharma",
      "employeeId": "EMP0001",
      "isTracking": true,
      "lastLocation": { "lat": 28.6139, "lng": 77.2090, "timestamp": "..." },
      "assignedGeofence": { "name": "HQ Office", "center": {...}, "radius": 300 }
    }
  ]
}
```

---

### GET `/locations/history/:employeeId`
Get movement history (breadcrumbs) for an employee on a specific date.

**Query params:**
| Param  | Type   | Description              |
|--------|--------|--------------------------|
| `date` | string | Date `YYYY-MM-DD`        |

**Response `200`:**
```json
{
  "success": true,
  "locations": [
    { "lat": 28.6139, "lng": 77.2090, "timestamp": "...", "isInsideGeofence": true, "speed": 1.2 }
  ],
  "stats": {
    "totalPoints": 142,
    "distanceKm": 3.7,
    "date": "2026-03-28"
  }
}
```

---

## Geofences

### GET `/geofences`
Get all active geofences.

**Response `200`:**
```json
{
  "success": true,
  "geofences": [
    {
      "_id": "geo123",
      "name": "HQ Office",
      "center": { "lat": 28.6139, "lng": 77.2090 },
      "radius": 300,
      "address": "Connaught Place, New Delhi",
      "color": "#3B82F6",
      "employeeCount": 4
    }
  ]
}
```

---

### POST `/geofences`
Create a geofence zone. **Admin only.**

**Request:**
```json
{
  "name": "Branch Office",
  "center": { "lat": 19.0760, "lng": 72.8777 },
  "radius": 250,
  "address": "BKC, Mumbai",
  "color": "#10B981"
}
```

---

### PUT `/geofences/:id`
Update a geofence. **Admin only.**

---

### DELETE `/geofences/:id`
Deactivate a geofence. **Admin only.**

---

## Dashboard (Admin only)

### GET `/dashboard/stats`
Get overview statistics for the admin dashboard.

**Response `200`:**
```json
{
  "success": true,
  "stats": {
    "totalEmployees": 7,
    "activeNow": 3,
    "todayPresent": 6,
    "todayAbsent": 1,
    "unreadAlerts": 2,
    "recentAlerts": [ { "_id": "...", "type": "geofence_exit", "message": "...", ... } ],
    "weeklyAttendance": [
      { "date": "2026-03-22", "count": 5 },
      { "date": "2026-03-23", "count": 7 }
    ]
  }
}
```

---

### GET `/dashboard/alerts`
Get system alerts.

**Query params:** `isRead` (boolean), `page`, `limit`

---

### PUT `/dashboard/alerts/:id/read`
Mark an alert as read.

---

## WebSocket Events (Socket.io)

**Connection:** `ws://localhost:5000`  
**Auth:** Pass JWT in handshake: `{ auth: { token: "<jwt>" } }`

### Client → Server Events

| Event                         | Payload                                    | Description                           |
|-------------------------------|--------------------------------------------|---------------------------------------|
| `location:ping`               | `{ lat, lng, accuracy, speed }`            | Employee sends live location          |
| `admin:request-live-locations`| —                                          | Admin requests snapshot of all locs   |
| `admin:send-alert`            | `{ employeeId, message }`                  | Admin sends message to employee       |

### Server → Client Events

| Event                        | Payload                                         | Who receives      |
|------------------------------|-------------------------------------------------|-------------------|
| `location:update`            | `{ employeeId, name, lat, lng, isInsideGeofence, timestamp }` | Admins |
| `alert:geofence-exit`        | `{ alert, employee, geofence }`                 | Admins            |
| `employee:clocked-in`        | `{ employeeId, name, time, location }`          | Admins            |
| `employee:clocked-out`       | `{ employeeId, name, time, totalHours }`        | Admins            |
| `system:employee-online`     | `{ employeeId, name, connectedAt }`             | Admins            |
| `system:employee-offline`    | `{ employeeId, name, disconnectedAt }`          | Admins            |
| `admin:live-locations`       | `{ employees: [...] }`                          | Requesting admin  |
| `alert:received`             | `{ message, from, timestamp }`                  | Target employee   |

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

| Status | Meaning                            |
|--------|------------------------------------|
| `400`  | Bad request / validation error     |
| `401`  | Unauthorized (invalid/expired JWT) |
| `403`  | Forbidden (insufficient role)      |
| `404`  | Resource not found                 |
| `429`  | Too many requests (rate limited)   |
| `500`  | Internal server error              |

---

## Rate Limits

| Endpoint group | Window    | Max requests |
|----------------|-----------|--------------|
| `/api/*`       | 15 min    | 100          |
| `/api/auth/*`  | 15 min    | 10           |

---

## Security Notes

1. **JWT expiry:** Access tokens expire in 7 days; refresh tokens in 30 days.
2. **Password hashing:** bcrypt with 12 salt rounds.
3. **Role guards:** All admin routes reject `employee` role with `403`.
4. **Soft deletes:** Employees are deactivated, not permanently deleted.
5. **Input validation:** `express-validator` on all mutation endpoints.
6. **Geofence formula:** Haversine algorithm for accurate spherical distance.
