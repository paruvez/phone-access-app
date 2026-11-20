# Phone Access App - Complete Setup Guide

## Overview
This is a full-featured phone access application with:
- **React Native (Expo) mobile app** - Camera, Microphone, SMS, Files, Notes
- **Discord Bot Server (Node.js/Express)** - 24/7 connection with auto-reconnect
- **Supabase Backend** - Database, Storage, Realtime sync
- **Supabase Storage** - For camera photos, videos, audio recordings

---

## Prerequisites
- Node.js 18+
- npm or yarn
- Git
- Expo CLI: `npm install -g @expo/cli`
- EAS CLI (for builds): `npm install -g eas-cli`

---

## Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose organization, enter project name (e.g., "phone-access")
4. Set database password (save it!)
5. Choose region closest to you
6. Wait for project to be ready (~2 minutes)

### Get Supabase Credentials
1. Go to Settings → API
2. Copy:
   - **Project URL** (e.g., `https://xyz.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`) - **Keep secret!**

### Run Database Schema
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `server/database/schema.sql`
3. Paste and click "Run"
4. Verify tables created: `notes`, `files`, `sms_messages`

### Configure Storage
1. Go to Storage in Supabase Dashboard
2. Verify `uploads` bucket exists (created by schema)
3. Check bucket is public
4. Set file size limit to 100MB

---

## Step 2: Create Discord Bot

1. Go to https://discord.com/developers/applications
2. Click "New Application" → Name it "Phone Access Bot"
3. Go to **Bot** tab → Click "Add Bot"
4. Copy **Token** (save it!)
5. Enable these **Privileged Gateway Intents**:
   - ✅ Message Content Intent
   - ✅ Server Members Intent
   - ✅ Presence Intent
6. Go to **OAuth2** → **URL Generator**
   - Scopes: `bot`, `applications.commands`
   - Permissions: Send Messages, Embed Links, Attach Files, Read Messages, Manage Messages
   - Copy generated URL, open in browser, invite to your server
7. Right-click your server → Copy Server ID (Guild ID)
8. Right-click a channel → Copy Channel ID (for notifications)

---

## Step 3: Configure Environment Variables

### Server (.env)
```bash
cd server
cp .env.example .env
```

Edit `.env`:
```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_guild_id_here
DISCORD_CHANNEL_ID=your_channel_id_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here
PORT=3000
NODE_ENV=development
```

### Mobile (.env)
```bash
cd mobile
cp .env.example .env
```

Edit `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-id
```

---

## Step 4: Install Dependencies

```bash
# Root
cd phone-access-app
npm install

# Server
cd server && npm install

# Mobile
cd ../mobile && npm install

# Shared
cd ../shared && npm install && npm run build
```

---

## Step 5: Run Locally

### Terminal 1: Start Server
```bash
cd server
npm run dev
```
Server runs on http://localhost:3000

### Terminal 2: Expose with ngrok (for Discord webhooks)
```bash
ngrok http 3000
```
Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

Update `mobile/.env`:
```env
API_BASE_URL=https://abc123.ngrok-free.app
```

### Terminal 3: Start Mobile App
```bash
cd mobile
npx expo start
```
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR code with Expo Go app on physical device

---

## Step 6: Deploy to Production

### Option A: Railway (Recommended for Discord Bot)

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init` (select "Empty Project")
4. Link to GitHub repo
5. Add environment variables in Railway dashboard:
   - All variables from `.env`
6. Deploy: `railway up`

### Option B: Render

1. Connect GitHub repo to Render
2. Create new "Web Service"
3. Use `render.yaml` config
4. Add environment variables in Render dashboard
5. Deploy

### Option C: Fly.io

1. Install flyctl: `curl -L https://fly.io/install.sh | sh`
2. Login: `fly auth login`
3. Launch: `fly launch` (select Node.js)
4. Set secrets: `fly secrets set DISCORD_TOKEN=... SUPABASE_URL=...` etc.
5. Deploy: `fly deploy`

### Update Mobile App for Production
Update `mobile/.env`:
```env
API_BASE_URL=https://your-deployed-url.railway.app
```

Build mobile app:
```bash
cd mobile
eas build --platform android  # or ios
```

---

## Step 7: Test Everything

### Test Discord Bot
In your Discord server:
- `/sync` - Sync notes from Supabase
- `/notes` - List notes
- `/files` - List files
- `/sms` - List SMS
- `/status` - Bot status
- `/note title:"Test" content:"Hello"` - Create note
- `/permissions` - Show required permissions

### Test Mobile App
1. Grant all permissions when prompted
2. Create a note → appears in Discord with `/notes`
3. Take a photo → appears in Discord with `/files type:camera`
4. Record audio → appears in Discord with `/files type:microphone`
5. Send SMS → appears in Discord with `/sms`
6. Upload file → appears in Discord with `/files`

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│  Discord Bot     │────▶│   Discord       │
│  (React Native) │     │  (Node.js/Express)│     │   Server        │
└────────┬────────┘     └────────┬─────────┘     └─────────────────┘
         │                       │
         │                       ▼
         │              ┌──────────────────┐
         │              │   Supabase       │
         └─────────────▶│  (PostgreSQL +   │
                        │   Storage +      │
                        │   Realtime)      │
                        └──────────────────┘
```

---

## API Endpoints

### Notes
- `GET /api/notes` - List all notes
- `POST /api/notes` - Create note `{title, content, user_id}`
- `PUT /api/notes/:id` - Update note `{title, content}`
- `DELETE /api/notes/:id` - Delete note

### Files
- `GET /api/files?type=camera` - List files (optional filter)
- `POST /api/files` - Upload file `{filename, type, base64, metadata, user_id}`

### SMS
- `GET /api/sms` - List SMS messages
- `POST /api/sms` - Send SMS `{phone_number, message, direction, user_id}`

### System
- `GET /health` - Health check
- `GET /api/bot/status` - Bot status
- `GET /api/permissions` - Required permissions

---

## Discord Commands

| Command | Description |
|---------|-------------|
| `/sync` | Sync notes from Supabase |
| `/notes [limit]` | List notes |
| `/files [type]` | List files by type |
| `/sms [limit]` | List SMS messages |
| `/status` | Bot and system status |
| `/upload file:[file] type:[type]` | Upload file |
| `/note title:[title] content:[content]` | Create note |
| `/permissions` | Show required permissions |

Legacy commands (prefix `!`):
- `!sync`, `!notes`, `!files`, `!sms`, `!status`, `!help`

---

## Permissions Required

| Permission | Purpose | iOS Key | Android Key |
|------------|---------|---------|-------------|
| Camera | Photos/videos | NSCameraUsageDescription | CAMERA |
| Microphone | Audio recording | NSMicrophoneUsageDescription | RECORD_AUDIO |
| Storage | File access | NSPhotoLibraryUsageDescription | READ_EXTERNAL_STORAGE |
| Files | Document picker | - | READ_MEDIA_* |
| SMS | Send/receive SMS | NSContactsUsageDescription | SEND_SMS, RECEIVE_SMS |
| Photos | Media library | NSPhotoLibraryAddUsageDescription | READ_MEDIA_IMAGES |
| Location | Location notes | NSLocationWhenInUseUsageDescription | ACCESS_FINE_LOCATION |
| Sensors | Motion data | NSMotionUsageDescription | BODY_SENSORS |
| Connectivity | Background sync | - | FOREGROUND_SERVICE_* |

---

## Troubleshooting

### Bot won't connect
- Check DISCORD_TOKEN is correct
- Verify bot is in the server
- Check intents are enabled
- Check logs for error messages

### Mobile app can't connect to API
- Verify API_BASE_URL is correct
- For local: use ngrok HTTPS URL
- For production: use deployed URL
- Check CORS settings in server

### Supabase errors
- Verify SUPABASE_URL and ANON_KEY
- Check RLS policies allow your user_id
- Verify storage bucket exists and is public
- Check database schema ran successfully

### Camera/Mic not working
- Grant permissions in system settings
- Check expo-camera/expo-av versions
- On Android: enable camera2 API
- Test on physical device (not emulator)

### Build failures
- Clear cache: `npx expo start -c`
- Delete node_modules and reinstall
- Check Node.js version (18+)
- Verify all environment variables set

---

## File Structure

```
phone-access-app/
├── package.json              # Root workspace
├── SETUP_GUIDE.md           # This file
├── server/                  # Discord Bot Server
│   ├── package.json
│   ├── tsconfig.json
│   ├── railway.json         # Railway config
│   ├── render.yaml          # Render config
│   ├── .env.example
│   ├── src/
│   │   └── index.ts         # Main server file
│   └── database/
│       └── schema.sql       # Supabase schema
├── mobile/                  # React Native App
│   ├── package.json
│   ├── tsconfig.json
│   ├── app.config.ts        # Expo config
│   ├── App.tsx              # Main app
│   ├── .env.example
│   └── src/
│       ├── context/         # React contexts
│       ├── screens/         # App screens
│       ├── components/      # Reusable components
│       ├── navigation/      # Navigation setup
│       └── hooks/           # Custom hooks
├── shared/                  # Shared types
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts         # Types & utilities
└── worker/                  # Cloudflare Worker (future)
```

---

## Next Steps

1. **Add Push Notifications** - Use Expo Notifications + Discord webhooks
2. **Add Background Sync** - Use expo-background-fetch
3. **Add Encryption** - Encrypt sensitive data before upload
4. **Add Biometric Auth** - Use expo-local-authentication
5. **Add Widgets** - Home screen widgets for quick access
6. **Add Shortcuts** - Siri Shortcuts / Android App Shortcuts

---

## Support

- Check logs: `railway logs` or Render dashboard
- Discord bot logs visible in terminal
- Mobile app logs: `npx expo start --dev-client`
- Supabase logs: Dashboard → Logs

---

## License

MIT License - Feel free to use and modify!