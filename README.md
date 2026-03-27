# Location Notifier

A real-time geo-fence notification system that tracks user location and sends push notifications when entering or exiting defined geographic boundaries. Built with React (frontend) and Node.js/Express (backend).

## Features

- 🗺️ **Interactive Map**: Real-time location tracking with Leaflet maps
- 📍 **Geo-fence Management**: Create circular or polygonal boundaries with custom messages
- 🔔 **Push Notifications**: Browser push notifications via Web Push API
- 📊 **Event Logging**: Complete history of geo-fence transitions
- 🔄 **Offline Support**: Queued location updates when offline
- 🎯 **Smart Tracking**: Intelligent location pinging with accuracy-based radius adjustment
- ⏱️ **Dwell Time**: Prevents false triggers by requiring stable state before transitions

## Tech Stack

- **Frontend**: React 18, Leaflet, Axios, Service Workers
- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Libraries**: Turf.js (polygon calculations), web-push (notifications)

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- Modern browser with Geolocation and Push Notification support

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/location-notifier.git
cd location-notifier
```

### 2. Setup Server

```bash
cd server
npm install
```

Generate VAPID keys for push notifications:
```bash
node generate-vapid.js
```

Create a `.env` file in the `server` directory:
```env
MONGO_URI=mongodb://127.0.0.1:27017/geofence_demo
VAPID_PUBLIC=your_public_key_here
VAPID_PRIVATE=your_private_key_here
VAPID_SUBJECT=mailto:your-email@example.com
PORT=4000
# Optional: JWT_SECRET=your_jwt_secret_here
```

Start the server:
```bash
npm run dev
```

### 3. Setup Client

```bash
cd client
npm install
```

Create a `.env` file in the `client` directory (optional):
```env
REACT_APP_API_URL=http://localhost:4000
```

Start the client:
```bash
npm start
```

The application will open at `http://localhost:3000`

## Usage

1. **Grant Permissions**: Allow location access and notification permissions when prompted
2. **Register Push**: The app fetches the VAPID public key from the backend automatically
3. **Create Geo-fences**: 
   - Use the control panel to create fences from current map view
   - Or create a fence at your current location
   - Customize name and notification message
4. **View Timeline**: Toggle the timeline to see all geo-fence events
5. **Test Notifications**: Use the test button on any fence to send a test notification

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/fences` - List all geo-fences
- `POST /api/fences` - Create a new geo-fence
- `DELETE /api/fences/:id` - Delete a geo-fence
- `POST /api/fences/:id/test` - Test notification for a fence
- `POST /api/location` - Submit location update
- `POST /api/push/subscribe` - Subscribe device for push notifications
- `GET /api/push/public-key` - Get VAPID public key for client subscription
- `GET /api/events` - Get all events
- `GET /api/events/device/:deviceId` - Get events for a device
- `GET /api/metrics` - Get system metrics

## Project Structure

```
location-notifier/
├── client/                 # React frontend
│   ├── public/            # Static files and service worker
│   └── src/               # React components and services
├── server/                # Node.js backend
│   ├── config/           # Database and VAPID configuration
│   ├── models/           # Mongoose schemas
│   ├── routes/           # API route handlers
│   └── utils/            # Utility functions
└── README.md
```

## Configuration

### Environment Variables

**Server (.env)**
- `MONGO_URI`: MongoDB connection string
- `VAPID_PUBLIC`: Public VAPID key for push notifications
- `VAPID_PRIVATE`: Private VAPID key for push notifications
- `VAPID_SUBJECT`: VAPID subject (usually an email)
- `PORT`: Server port (default: 4000)
- `JWT_SECRET`: Optional JWT secret for authentication
- `CORS_ORIGIN`: Comma-separated allowed origins in production (example: `https://your-app.vercel.app`)

**Client (.env)**
- `REACT_APP_API_URL`: Backend API URL (default: http://localhost:4000)

## Development

The server uses nodemon for auto-reloading during development. The client uses Create React App's development server with hot reloading.

## Deployment Checklist (Vercel + Render + Atlas)

1. **Prepare MongoDB Atlas**
   - Create an Atlas cluster and database user.
   - Add network access for your Render outbound IP policy (or temporary `0.0.0.0/0` while testing).
   - Copy the Atlas connection string into `MONGO_URI`.

2. **Deploy Backend on Render**
   - Connect repository and create a Web Service with root directory `server` (or use `render.yaml`).
   - Build command: `npm install`
   - Start command: `npm start`
   - Set env vars:
     - `MONGO_URI`
     - `VAPID_PUBLIC`
     - `VAPID_PRIVATE`
     - `VAPID_SUBJECT`
     - `CORS_ORIGIN` (your Vercel URL)
   - Verify: `https://<render-service>.onrender.com/api/health` returns `{ "ok": true }`.

3. **Deploy Frontend on Vercel**
   - Import repository and set project root to `client`.
   - Set env var `REACT_APP_API_URL=https://<render-service>.onrender.com`
   - Deploy and open the Vercel URL.

4. **Validate Push Notifications in Production**
   - Open your deployed site and allow notifications and location.
   - Create or test a fence from the UI.
   - If notifications do not appear, clear site data and unregister service worker once, then reload and allow notifications again.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
