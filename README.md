# Phone Access App

A full-featured phone access application with React Native, Supabase, and Discord bot integration.

## Features

### Mobile App (React Native + Expo)
- 📝 **Notes** - Create, edit, delete notes with realtime sync
- 📷 **Camera** - Capture photos and videos, auto-upload to Supabase Storage
- 🎙️ **Microphone** - Record audio, save to gallery and Discord
- 📱 **SMS** - Send/receive SMS messages with Discord notifications
- 📁 **Files** - Upload and manage files from device
- 🔐 **Unified Permissions** - One-click "Allow All" permission manager
- 🔄 **Realtime Sync** - Instant updates via Supabase Realtime

### Discord Bot (Node.js + Express + discord.js)
- 🤖 **24/7 Connection** - Auto-reconnect with exponential backoff
- 📋 **Slash Commands** - `/sync`, `/notes`, `/files`, `/sms`, `/status`, `/upload`, `/note`
- 🔔 **Real-time Notifications** - Instant alerts for new notes, files, SMS
- 🌐 **REST API** - Endpoints for mobile app communication
- ❤️ **Health Monitoring** - Heartbeat and status endpoints

### Backend (Supabase)
- 🗄️ **PostgreSQL Database** - Notes, files, SMS with RLS
- 📦 **Supabase Storage** - Camera photos, videos, audio recordings
- ⚡ **Realtime** - Live updates across all clients
- 🔒 **Row Level Security** - User data isolation

## Quick Start

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for complete setup instructions.

```bash
# 1. Clone and install
git clone <repo>
cd phone-access-app
npm install

# 2. Configure environment
cp server/.env.example server/.env
cp mobile/.env.example mobile/.env
# Edit both .env files with your credentials

# 3. Run database schema in Supabase SQL Editor
# Copy server/database/schema.sql to Supabase

# 4. Start development
cd server && npm run dev      # Terminal 1: Discord bot on :3000
ngrok http 3000               # Terminal 2: Expose for Discord
cd mobile && npx expo start   # Terminal 3: Mobile app
```

## Project Structure

```
phone-access-app/
├── README.md
├── SETUP_GUIDE.md
├── package.json              # Root workspace
├── server/                   # Discord Bot Server
│   ├── src/index.ts         # Main server (Express + Discord.js)
│   ├── database/schema.sql  # Supabase schema
│   ├── railway.json         # Railway deployment
│   └── render.yaml          # Render deployment
├── mobile/                   # React Native App
│   ├── App.tsx              # App entry
│   ├── app.config.ts        # Expo config
│   └── src/
│       ├── context/         # Auth, Permissions, Sync, Supabase
│       ├── screens/         # Home, Notes, Camera, Mic, Files, SMS, Settings
│       ├── components/      # PermissionManager
│       └── navigation/      # Tab + Drawer + Stack navigation
└── shared/                   # Shared types
    └── src/index.ts         # Types, constants, utilities
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native, Expo, TypeScript |
| Navigation | React Navigation v6 |
| State | React Context + TanStack Query |
| Backend | Node.js, Express, TypeScript |
| Discord | discord.js v14 |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Deployment | Railway / Render / Fly.io |

## API Endpoints

### Notes
- `GET /api/notes` - List notes
- `POST /api/notes` - Create note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note

### Files
- `GET /api/files?type=camera` - List files
- `POST /api/files` - Upload file (base64)

### SMS
- `GET /api/sms` - List messages
- `POST /api/sms` - Send SMS

### System
- `GET /health` - Health check
- `GET /api/bot/status` - Bot status

## Discord Commands

| Command | Description |
|---------|-------------|
| `/sync` | Sync notes from Supabase |
| `/notes [limit]` | List notes |
| `/files [type]` | List files by type |
| `/sms [limit]` | List SMS messages |
| `/status` | Bot status |
| `/upload file:[file] type:[type]` | Upload file |
| `/note title:[title] content:[content]` | Create note |
| `/permissions` | Required permissions |

## Permissions

The app requests these permissions (one-click "Allow All"):

| Permission | iOS | Android | Purpose |
|------------|-----|---------|---------|
| Camera | ✅ | ✅ | Photos/videos |
| Microphone | ✅ | ✅ | Audio recording |
| Storage | ✅ | ✅ | File access |
| Files | ✅ | ✅ | Document picker |
| SMS | ✅ | ✅ | Send/receive SMS |
| Photos | ✅ | ✅ | Media library |
| Location | ✅ | ✅ | Location notes |
| Sensors | ✅ | ✅ | Motion data |
| Connectivity | - | ✅ | Background sync |

## Deployment

### Railway (Recommended)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Render
Connect GitHub repo, use `render.yaml` config.

### Fly.io
```bash
fly auth login
fly launch
fly secrets set DISCORD_TOKEN=... SUPABASE_URL=...
fly deploy
```

## License

MIT License