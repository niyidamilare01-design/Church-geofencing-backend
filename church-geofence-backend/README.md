# Church Geofence Backend API

Automatic attendance tracking for churches using GPS geofencing.
Members are logged when they arrive and leave the church campus - no manual check-in needed.

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/signup` | None | Register with church invite code |
| POST | `/api/auth/login` | None | Login, get JWT token |
| GET | `/api/auth/me` | Member | Get current member profile |
| GET | `/api/geofences` | Member | List church geofence zones |
| POST | `/api/geofences` | Admin | Create a new geofence zone |
| DELETE | `/api/geofences/:id` | Admin | Remove a geofence zone |
| POST | `/api/location/ping` | Member | Send GPS coordinates (called every 60s) |
| GET | `/api/attendance/today` | Admin | Live view + today's attendance |
| GET | `/api/attendance/history` | Member | Personal attendance history |
| GET | `/api/attendance/report` | Admin | Date-range attendance report |
| GET | `/health` | None | Health check |

---

## Deploy to Railway (Step by Step)

### 1. Create Railway Account
Go to [railway.app](https://railway.app) and sign up with GitHub.

### 2. Create a New Project
- Click **New Project**
- Select **Deploy from GitHub repo**
- Connect this repo

### 3. Add PostgreSQL Database
- In your Railway project, click **+ New**
- Select **Database -> PostgreSQL**
- Railway will auto-create and link it

### 4. Enable PostGIS
In Railway's PostgreSQL shell, run:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 5. Set Environment Variables
In your Railway service -> **Variables**, add:
```
DATABASE_URL        = (Railway auto-fills this from the linked PostgreSQL)
JWT_SECRET          = (any long random string, e.g. use: openssl rand -base64 32)
CHURCH_INVITE_CODE  = GRACE2024 (change to your church's code)
NODE_ENV            = production
PORT                = 3000
```

### 6. Run Database Setup
In Railway shell or locally with DATABASE_URL set:
```bash
npm run db:setup
```

### 7. Deploy
Railway auto-deploys on every push to main. Your API will be live at:
```
https://your-project.up.railway.app
```

---

## Local Development

```bash
# Install dependencies
npm install

# Copy env file and fill in values
cp .env.example .env

# Set up database tables
npm run db:setup

# Start development server
npm run dev
```

---

## Testing with Postman

### 1. Sign Up
```json
POST /api/auth/signup
{
  "name": "Adeniyi Johnson",
  "email": "adeniyi@church.com",
  "password": "password123",
  "inviteCode": "GRACE2024",
  "phone": "+2348012345678"
}
```

### 2. Create Geofence (Admin)
`radiusMiles` is the geofence radius in miles.

```json
POST /api/geofences
Authorization: Bearer <token>
{
  "name": "Main Campus",
  "centerLat": 6.5244,
  "centerLng": 3.3792,
  "radiusMiles": 0.1
}
```

### 3. Send Location Ping
```json
POST /api/location/ping
Authorization: Bearer <token>
{
  "latitude": 6.5244,
  "longitude": 3.3792
}
```
Response when entering:
```json
{ "isInsideGeofence": true, "event": "ENTERED", "geofenceName": "Main Campus" }
```

### 4. View Today's Attendance (Admin)
```
GET /api/attendance/today
Authorization: Bearer <token>
```

---

## How Geofence Detection Works

1. Mobile app pings `/api/location/ping` every 60 seconds
2. Backend calculates distance in miles from the member to each geofence center (Haversine formula)
3. If member crosses into a zone -> **ENTRY** logged, attendance record created
4. If member leaves the zone -> **EXIT** logged, duration calculated
5. State is tracked per member so events only fire **once** per entry/exit

---

## Project Structure

```
src/
|-- index.js                    # Express app entry point
|-- db/
|   |-- pool.js                 # PostgreSQL connection
|   `-- setup.js                # Database table creation
|-- middleware/
|   `-- auth.js                 # JWT authentication
|-- controllers/
|   |-- authController.js       # Signup, login, profile
|   |-- geofenceController.js   # Zone management
|   |-- locationController.js   # GPS ping + detection
|   `-- attendanceController.js # Reports + live view
`-- routes/
    |-- auth.js
    |-- geofences.js
    `-- location.js
```
