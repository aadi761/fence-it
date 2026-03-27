# Location Notifier - Complete Project Encyclopedia

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture & Workflow](#architecture--workflow)
4. [File Structure & Purpose](#file-structure--purpose)
5. [Data Models](#data-models)
6. [API Endpoints](#api-endpoints)
7. [Client-Side Components](#client-side-components)
8. [Key Workflows](#key-workflows)
9. [Setup & Configuration](#setup--configuration)

---

## Project Overview

**Location Notifier** is a real-time geofencing notification system that:
- Tracks user location via GPS
- Defines virtual geographic boundaries (geofences) on a map
- Sends push notifications when users enter or exit these boundaries
- Supports both circular and polygon-shaped geofences
- Logs all geofence events for review

**Use Case**: Monitor user location and send alerts when they cross predefined geographic boundaries (e.g., "High pollution area detected", "Entered restricted zone", etc.)

---

## Tech Stack

### Backend (Server)
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database (via Mongoose)
- **Web Push** - Push notification service (VAPID protocol)
- **@turf/turf** - Geospatial calculations
- **jsonwebtoken** - Optional authentication
- **dotenv** - Environment configuration

### Frontend (Client)
- **React** - UI framework
- **React Leaflet** - Map component library
- **Leaflet** - Interactive maps
- **Axios** - HTTP client
- **Service Workers** - Push notifications & offline support

### Development Tools
- **Nodemon** - Auto-restart server during development
- **Create React App (PWA template)** - React scaffolding

---

## Architecture & Workflow

```
┌─────────────────┐
│   React Client  │
│  (Browser App)  │
└────────┬────────┘
         │
         │ 1. Requests location permission
         │ 2. Registers push subscription
         │ 3. Sends location updates (POST /api/location)
         │
         ▼
┌─────────────────┐
│  Express Server │
│   (Port 4000)   │
└────────┬────────┘
         │
         │ 4. Checks location against all geofences
         │ 5. Detects enter/exit transitions
         │ 6. Creates event log
         │ 7. Sends push notification
         │
         ▼
┌─────────────────┐
│    MongoDB      │
│  (3 Collections)│
└─────────────────┘
```

### Complete Flow:

1. **Initialization**
   - Client requests location & notification permissions
   - Service worker registers for push notifications
   - Client subscribes with VAPID public key
   - Server stores subscription in database

2. **Location Tracking**
   - Browser GPS sends location updates every ~8 seconds or when movement >25m
   - Client sends location to `/api/location` endpoint
   - Server checks location against all active geofences

3. **Geofence Detection**
   - Server calculates distance (for circles) or uses point-in-polygon (for polygons)
   - Implements **dwell time** (5 seconds) to prevent false triggers
   - Tracks state transitions (enter/exit) with deduplication (60s cooldown)

4. **Notification**
   - On valid transition, server creates EventLog entry
   - Sends push notification via Web Push API
   - Client displays notification via service worker

---

## File Structure & Purpose

### Root Directory
```
location-notifier/
├── README.md                    # Quick setup instructions
├── package.json                 # Root package (meta only)
└── PROJECT_DOCUMENTATION.md     # This file
```

### Server Directory (`/server`)

#### **server.js** (Entry Point)
- **Purpose**: Main Express server setup
- **Key Functions**:
  - Connects to MongoDB
  - Configures CORS & body parser
  - Sets up optional JWT authentication middleware
  - Registers all route handlers
  - Seeds demo "Delhi" geofence if database is empty
  - Tracks metrics (pings, alerts)
- **Port**: 4000 (default)

#### Configuration (`/server/config`)

**db.js**
- **Purpose**: MongoDB connection handler
- **Function**: `connectDB()` - Connects to MongoDB using `MONGO_URI` env var
- **Default DB**: `mongodb://127.0.0.1:27017/geofence_demo`

**vapidKeys.js**
- **Purpose**: VAPID keys configuration for push notifications
- **Exports**: `VAPID` object with `publicKey`, `privateKey`, `subject`
- **Source**: Environment variables (`VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT`)

**generate-vapid.js**
- **Purpose**: Generates VAPID keys (run once)
- **Output**: Keys printed to console, paste into `.env` file

#### Models (`/server/models`)

**GeoFence.js**
- **Purpose**: Mongoose schema for geofences
- **Fields**:
  - `name` (String) - Fence name
  - `message` (String) - Notification message
  - `type` (Enum: 'circle' | 'polygon') - Fence shape type
  - `center` (GeoJSON Point) - Center coordinates [lon, lat] for circles
  - `radius` (Number) - Radius in meters (for circles)
  - `polygon` (GeoJSON Polygon) - Polygon coordinates (for polygons)
  - `activeFrom` (Date) - Activation start time
  - `activeTo` (Date) - Activation end time
  - `segments` ([String]) - User targeting segments
  - `priority` (Number) - Priority level
  - `createdAt` (Date) - Creation timestamp
- **Index**: `center` field indexed as 2dsphere for geospatial queries

**Subscription.js**
- **Purpose**: Stores push notification subscriptions
- **Fields**:
  - `deviceId` (String) - Unique device identifier
  - `subscription` (Object) - Web Push subscription object
- **Usage**: One subscription per device

**EventLog.js**
- **Purpose**: Logs all geofence transition events
- **Fields**:
  - `deviceId` (String) - Device that triggered event
  - `fenceId` (ObjectId) - Reference to GeoFence
  - `transition` (String) - 'enter' or 'exit'
  - `location` (GeoJSON Point) - Location where event occurred
  - `accuracy` (Number) - GPS accuracy in meters
  - `ts` (Date) - Event timestamp
- **Index**: `location` field indexed as 2dsphere

#### Routes (`/server/routes`)

**fenceRoutes.js**
- **POST `/api/fences`** - Create new geofence
  - Body: `{ name, message, type, lat, lon, radius, polygon, activeFrom, activeTo, segments, priority, demo, deviceId, currentLat, currentLon }`
  - If `demo=true` and user is inside, immediately triggers notification
  - Returns: `{ fence, insideNow, demoTriggerId }`
- **GET `/api/fences`** - List all geofences (sorted by creation date)
- **DELETE `/api/fences/:id`** - Delete geofence
- **POST `/api/fences/:id/test`** - Send test notification for a fence

**pushRoutes.js**
- **POST `/api/push/subscribe`** - Register push subscription
  - Body: `{ deviceId, subscription }`
  - Upserts subscription (creates or updates)
- **POST `/api/push/custom`** - Send custom push notification
  - Body: `{ deviceId, title, body, data }`

**locationRoutes.js** (Core Logic)
- **POST `/api/location`** - Process location update
  - Body: `{ deviceId, lat, lon, accuracy, ts, segments }`
  - **Algorithm**:
    1. Validates required fields
    2. Fetches all active geofences (respects `activeFrom`/`activeTo`)
    3. Filters by user segments if provided
    4. For each fence:
       - Calculates if location is inside (circle: distance check, polygon: point-in-polygon)
       - Applies dynamic radius expansion based on GPS accuracy
       - Tracks state transitions with in-memory `lastState` object
       - Implements 5-second dwell time to prevent false triggers
       - Implements 60-second deduplication window
    5. Creates EventLog entry for valid transitions
    6. Sends push notification if subscription exists
    7. Increments metrics
  - Returns: `{ ok: true, events: count }`

**eventRoutes.js**
- **GET `/api/events`** - Get all events (last 100, sorted by time)
- **GET `/api/events/device/:deviceId`** - Get events for specific device
- **DELETE `/api/events/device/:deviceId`** - Delete all events for device

#### Utils (`/server/utils`)

**geoUtils.js**
- **Function**: `distanceMeters(lat1, lon1, lat2, lon2)`
- **Purpose**: Calculates distance between two coordinates using Haversine formula
- **Returns**: Distance in meters

**pushUtils.js**
- **Function**: `sendPush(subscription, payload)`
- **Purpose**: Sends push notification via Web Push API
- **Parameters**:
  - `subscription`: Web Push subscription object
  - `payload`: `{ title, body, data }`
- **Returns**: `true` on success, `false` on error

### Client Directory (`/client`)

#### Entry Points

**public/index.html**
- **Purpose**: HTML template for React app
- **Note**: Standard CRA template

**public/service-worker.js**
- **Purpose**: Service worker for push notifications
- **Events**:
  - `push`: Handles incoming push notifications, displays notification
  - `notificationclick`: Opens app when notification is clicked

**src/index.js**
- **Purpose**: React app entry point
- **Function**: Renders `<App />` component into DOM

**src/App.js**
- **Purpose**: Root React component
- **Function**: Generates random `deviceId` and renders `<MapView />`

#### Components (`/client/src/components`)

**MapView.js** (Main Component)
- **Purpose**: Main map interface with geofence management
- **Features**:
  - Interactive Leaflet map
  - Displays user location (purple marker)
  - Displays all geofences as circles
  - Control panel for creating fences
  - Auto-centers map on user location
  - Timeline view for events
- **State**:
  - `fences`: Array of geofences
  - `me`: Current user location `{ lat, lon, ts }`
  - `tracking`: Boolean for location tracking on/off
  - `showTimeline`: Boolean for timeline visibility
- **Functions**:
  - `loadFences()`: Fetches all geofences from API
  - `createFence(body)`: Creates new geofence
  - `deleteFence(id)`: Deletes geofence
- **Sub-components**:
  - `AutoCenter`: Auto-centers map when location is received
  - `ControlPanel`: UI for creating fences and managing tracking
  - `FenceFromViewButton`: Button to create fence from current map view

**GeoFenceForm.js**
- **Purpose**: Form component for creating geofences (currently unused, replaced by ControlPanel)
- **Fields**: Name, latitude, longitude, radius

**NotificationTimeline.js**
- **Purpose**: Displays event log timeline
- **Features**:
  - Fetches events every 3 seconds
  - Shows transition type, fence name, timestamp
  - Supports device-specific filtering
- **Props**: `deviceId` (optional)

#### Services (`/client/src/services`)

**api.js**
- **Purpose**: Axios instance configured with base URL
- **Default URL**: `http://localhost:4000`
- **Usage**: `API.get('/api/fences')`, `API.post('/api/location', data)`, etc.

**pushSubscription.js**
- **Purpose**: Push notification & location tracking utilities
- **Functions**:
  - `registerPush(deviceId)`: 
    - Registers service worker
    - Requests notification permission
    - Prompts for VAPID public key
    - Subscribes to push notifications
    - Sends subscription to server
  - `useLocationPing(deviceId, onUpdate, enabled)`:
    - React hook for location tracking
    - Uses `navigator.geolocation.watchPosition`
    - Sends location to server when:
       - Movement >25 meters, OR
       - Time elapsed >8 seconds
    - Queues failed requests for retry when online
    - Calls `onUpdate` callback with location
  - `showLocalNotification({ title, body, data })`:
    - Displays local notification via service worker
    - Used for demo/test notifications

**serviceWorker.js**
- **Purpose**: Service worker registration (CRA standard)

#### Styles

**src/styles.css**
- **Purpose**: Global CSS styles for the application

---

## Data Models

### GeoFence Document
```javascript
{
  _id: ObjectId,
  name: "Delhi",
  message: "You entered Delhi — High pollution area detected (AQI 312)",
  type: "circle",  // or "polygon"
  center: {
    type: "Point",
    coordinates: [77.2090, 28.6139]  // [longitude, latitude]
  },
  radius: 1500,  // meters (for circles)
  polygon: null,  // GeoJSON Polygon (for polygons)
  activeFrom: null,  // Date or null
  activeTo: null,  // Date or null
  segments: [],  // Array of strings
  priority: 0,
  createdAt: Date
}
```

### Subscription Document
```javascript
{
  _id: ObjectId,
  deviceId: "device-abc123",
  subscription: {
    endpoint: "https://fcm.googleapis.com/...",
    keys: {
      p256dh: "...",
      auth: "..."
    }
  }
}
```

### EventLog Document
```javascript
{
  _id: ObjectId,
  deviceId: "device-abc123",
  fenceId: ObjectId("..."),
  transition: "enter",  // or "exit"
  location: {
    type: "Point",
    coordinates: [77.2090, 28.6139]  // [longitude, latitude]
  },
  accuracy: 30,  // meters
  ts: Date
}
```

---

## API Endpoints

### Health Check
- **GET `/api/health`** → `{ ok: true }`

### Geofences
- **POST `/api/fences`** - Create geofence
- **GET `/api/fences`** - List all geofences
- **DELETE `/api/fences/:id`** - Delete geofence
- **POST `/api/fences/:id/test`** - Test notification

### Push Notifications
- **POST `/api/push/subscribe`** - Register subscription
- **POST `/api/push/custom`** - Send custom notification

### Location
- **POST `/api/location`** - Process location update (main endpoint)

### Events
- **GET `/api/events`** - Get all events (last 100)
- **GET `/api/events/device/:deviceId`** - Get device events
- **DELETE `/api/events/device/:deviceId`** - Delete device events

### Metrics
- **GET `/api/metrics`** → `{ pings: number, alerts: number }`

---

## Key Workflows

### 1. Initial Setup Flow
```
User opens app
  → Browser requests location permission
  → Browser requests notification permission
  → User pastes VAPID public key
  → Service worker registers
  → Push subscription created
  → Subscription sent to server
  → Server stores subscription
```

### 2. Location Tracking Flow
```
Browser GPS updates location
  → useLocationPing hook detects change
  → Checks if movement >25m OR time >8s
  → POST /api/location with { deviceId, lat, lon, accuracy, ts }
  → Server processes location
  → Server checks all geofences
  → Server detects enter/exit
  → Server creates EventLog
  → Server sends push notification
  → Client receives notification
```

### 3. Geofence Creation Flow
```
User clicks map or uses control panel
  → User enters name, message, radius
  → POST /api/fences with fence data
  → Server creates GeoFence document
  → If demo=true, server checks if user is inside
  → If inside, server immediately triggers notification
  → Client refreshes fence list
  → Map displays new fence as circle
```

### 4. Geofence Detection Algorithm
```
For each location update:
  1. Fetch all active geofences (respects activeFrom/activeTo)
  2. Filter by user segments if provided
  3. For each fence:
     a. Calculate if inside:
        - Circle: distance from center <= (radius + accuracy)
        - Polygon: point-in-polygon check
     b. Compare with previous state (from lastState memory)
     c. If state changed:
        - Start dwell timer (5 seconds)
        - If dwell time elapsed AND no duplicate (60s cooldown):
          - Create EventLog
          - Send push notification
          - Update lastState
```

### 5. Notification Flow
```
Server detects valid transition
  → Creates EventLog document
  → Fetches subscription for deviceId
  → Calls sendPush() with subscription & payload
  → Web Push API sends notification
  → Service worker receives push event
  → Service worker displays notification
  → User clicks notification
  → Service worker opens app
```

---

## Setup & Configuration

### Prerequisites
- Node.js (v14+)
- MongoDB (local or remote)
- Modern browser with GPS & push notification support

### Server Setup
```bash
cd server
npm install
node generate-vapid.js  # Generate VAPID keys
# Create server/.env file with:
#   MONGO_URI=mongodb://127.0.0.1:27017/geofence_demo
#   VAPID_PUBLIC=<from generate-vapid.js>
#   VAPID_PRIVATE=<from generate-vapid.js>
#   VAPID_SUBJECT=mailto:you@example.com
#   PORT=4000 (optional)
#   JWT_SECRET=... (optional, for auth)
npm run dev
```

### Client Setup
```bash
cd client
npm install
npm start
# Opens http://localhost:3000
```

### Environment Variables (Server)
- `MONGO_URI` - MongoDB connection string
- `VAPID_PUBLIC` - VAPID public key
- `VAPID_PRIVATE` - VAPID private key
- `VAPID_SUBJECT` - VAPID subject (email)
- `PORT` - Server port (default: 4000)
- `JWT_SECRET` - Optional JWT secret for authentication

### Environment Variables (Client)
- `REACT_APP_API_URL` - Server URL (default: http://localhost:4000)

---

## Key Features

### 1. Dwell Time
- Requires 5 seconds of stable state before triggering transition
- Prevents false triggers from GPS jitter

### 2. Deduplication
- 60-second cooldown between same transitions
- Prevents duplicate notifications for same fence

### 3. Dynamic Radius
- Expands fence radius based on GPS accuracy
- Minimum threshold: 10 meters
- Ignores location updates with accuracy >50 meters

### 4. Activation Windows
- Geofences can have `activeFrom` and `activeTo` dates
- Only active geofences are checked

### 5. Segment Targeting
- Geofences can target specific user segments
- Only checks geofences matching user's segments

### 6. Offline Queue
- Failed location updates are queued
- Automatically retried when connection restored

### 7. Demo Mode
- Immediate notification when creating fence if user is inside
- Useful for testing

---

## Code Highlights

### Location Update Logic (locationRoutes.js)
- In-memory state tracking: `lastState` object stores per-device-per-fence state
- Dwell time implementation: Tracks `pendingSince` timestamp
- Deduplication: Checks `lastTransitionAt` to prevent duplicates

### Geofence Detection
- Circle: Uses Haversine formula via `distanceMeters()`
- Polygon: Uses Turf.js `booleanPointInPolygon()`
- Accuracy handling: Expands radius by GPS accuracy amount

### Push Notification
- Web Push standard (VAPID protocol)
- Service worker handles display
- Supports custom data payload

---

## Testing

### Manual Testing
1. Open app, grant permissions
2. Create fence at current location (should trigger immediately)
3. Move outside fence boundary
4. Move back inside (should trigger after 5s dwell)
5. Check timeline for events
6. Test notification button on fence

### API Testing (cURL)
```bash
# Simulate location update
curl -X POST http://localhost:4000/api/location \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-device","lat":28.6139,"lon":77.2090,"accuracy":20}'

# Create fence
curl -X POST http://localhost:4000/api/fences \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","lat":28.6139,"lon":77.2090,"radius":100}'
```

---

## Architecture Decisions

1. **In-memory state tracking**: `lastState` object in `locationRoutes.js` - Simple, fast, but lost on server restart
2. **Dwell time**: 5 seconds prevents false triggers from GPS noise
3. **Deduplication window**: 60 seconds prevents spam
4. **Queue system**: Failed requests queued for retry when online
5. **Optional JWT**: Authentication is optional, can be enabled via `JWT_SECRET`
6. **Service worker**: Handles push notifications and offline support

---

## Future Enhancements

Potential improvements:
- Persistent state storage (Redis) instead of in-memory
- Polygon fence editing UI
- Real-time fence updates via WebSockets
- User authentication & multi-user support
- Fence analytics dashboard
- Historical location replay
- Multiple device support per user

---

## Conclusion

This is a **production-ready geofencing notification system** with:
- ✅ Real-time location tracking
- ✅ Push notifications
- ✅ Multiple fence types (circle, polygon)
- ✅ Event logging
- ✅ Interactive map UI
- ✅ Offline support
- ✅ Error handling & retry logic

The codebase is clean, well-structured, and follows best practices for MERN stack development.

