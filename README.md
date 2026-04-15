# FirstResponders App

Cross-platform incident logging for volunteer first responders.
Mobile (iOS + Android via Expo) + Web (React PWA) + Backend (Node.js + PostgreSQL).

---

## Production Deployment

| Service | URL |
|---|---|
| Backend API | `https://firstresponders-api.onrender.com` |
| Web App | Render static site (same account) |
| Database | Render PostgreSQL |
| Photo Storage | Cloudflare R2 object storage |

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally (or connection string to remote)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) for mobile development
- (Optional) [EAS CLI](https://docs.expo.dev/eas/) for building mobile binaries

---

## Quick Start

### 1. Install all dependencies

```bash
cd firstresponders
npm install
```

### 2. Configure the backend environment

```bash
cp packages/backend/.env.example packages/backend/.env
# Edit .env and set:
#   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/firstresponders"
#   JWT_SECRET="your-long-random-secret"
#   R2_ENDPOINT="https://<account>.r2.cloudflarestorage.com"
#   R2_ACCESS_KEY_ID="..."
#   R2_SECRET_ACCESS_KEY="..."
#   R2_BUCKET_NAME="..."
```

### 3. Create database + run migrations + seed data

```bash
cd packages/backend
npx prisma generate
DATABASE_URL="postgresql://USER@localhost:5432/firstresponders" ts-node prisma/seed.ts
```

### 4. Start the backend API

```bash
# from firstresponders root:
npm run dev:backend
# API available at http://localhost:3001
```

### 5. Start the web app

```bash
# from firstresponders root:
npm run dev:web
# Web app at http://localhost:5173
```

### 6. Start the mobile app

```bash
cd packages/mobile
npx expo start --clear
# Scan QR code with Expo Go (iOS/Android)
# Or press 'i' for iOS simulator / 'a' for Android emulator
```

Set the API URL for mobile:
```bash
# packages/mobile/.env (create this file)
EXPO_PUBLIC_API_URL=https://firstresponders-api.onrender.com
# For local dev use your machine's local IP (not localhost):
# EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3001
```

> **Note:** Always start Expo with `--clear` after changing `.env` variables — Metro caches `EXPO_PUBLIC_*` values.

---

## Authentication

### Mobile & Web Responder Login
Responders sign in with **username + 4-digit PIN**.
- Username is auto-generated: `last3(firstName+surname) + isoCode + last3(mobileDigits)` (e.g. `elszaf774`)
- PIN = last 4 digits of the responder's mobile number (never stored)
- Usernames are assigned by GROUP_SYSADMIN when adding a responder (generated automatically)

### Admin Login (Web)
Group admins (GROUP_SYSADMIN, GROUP_ADMIN) and system admins sign in at `/admin-login` with **email + password**.

| Role | Description |
|---|---|
| `SUPER_ADMIN` | Full system access; manages countries, provinces, admin users |
| `COUNTRY_SYSADMIN` | Country-level admin; approves org registrations, sees all groups in country |
| `GROUP_SYSADMIN` | Group system admin; manages own group's responders and LOV data |
| `GROUP_ADMIN` | Group admin; can add responders and LOV values |
| `RESPONDER` | Field user; logs incidents via mobile app |

### Default Seed Credentials
```
SuperAdmin:       superadmin@firstresponders.app  /  SuperAdmin@2025!
CountrySysAdmin:  sysadmin.za@firstresponders.app /  CountryAdmin@2025!
```

---

## Environment Variables

### Backend (`packages/backend/.env`)
| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:pw@localhost:5432/firstresponders` |
| `JWT_SECRET` | Secret for signing JWT tokens | Any long random string |
| `PORT` | API port | `3001` |
| `NODE_ENV` | Environment | `development` or `production` |
| `R2_ENDPOINT` | Cloudflare R2 endpoint URL | `https://<account>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | R2 access key | — |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | — |
| `R2_BUCKET_NAME` | R2 bucket name | — |

### Web (`packages/web/.env` — optional)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Override API URL (defaults to same-origin via Vite proxy) |

### Mobile (`packages/mobile/.env`)
| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend API URL (must be reachable from device/simulator) |

---

## Project Structure

```
firstresponders/
├── packages/
│   ├── shared/          TypeScript types, Zod validation, constants
│   ├── backend/         Express API, Prisma ORM, PostgreSQL
│   │   ├── prisma/      Schema, seed, prisma.config.ts
│   │   └── src/
│   │       ├── lib/     r2.ts, prisma.ts, username.ts
│   │       ├── routes/  auth, lovs, incidents, admin, hierarchy, photos
│   │       └── scripts/ backfill-usernames.ts
│   ├── mobile/          Expo (React Native) iOS + Android app
│   │   └── app/
│   │       ├── (auth)/  select-responder.tsx
│   │       ├── (tabs)/  new-incident, history, admin
│   │       └── incident/[id].tsx  (read-only detail view)
│   └── web/             React + Vite PWA (desktop + browser)
├── docs/
│   ├── FirstResponders_BRS.docx          Business Requirements Specification
│   └── FirstResponders_Development_Log.docx  Development Log
```

---

## Key Features

| Feature | Mobile | Web |
|---|---|---|
| Username + PIN login | ✓ | ✓ |
| Incident capture (all 17 fields) | ✓ | ✓ |
| 5-step wizard | ✓ | Single-page form |
| Colour triage code picker | ✓ | ✓ |
| BP dual-input | ✓ | ✓ |
| Multi-patient support | ✓ | ✓ |
| Drug compound entry | ✓ | ✓ |
| Inline LOV add | ✓ | ✓ |
| Photo capture + GPS tag | ✓ | — |
| Offline save + sync | ✓ | — |
| Incident history list | ✓ | ✓ |
| Incident detail view | ✓ (read-only, with photos) | ✓ |
| Photo display (authenticated) | ✓ | ✓ |
| CSV export | — | ✓ |
| LOV admin (CRUD) | — | ✓ |
| Location hierarchy manager | — | ✓ |
| Audit log | — | ✓ |
| Stats dashboard | — | ✓ |
| Org self-registration | — | ✓ (public) |
| Org approval workflow | — | ✓ (CountrySysAdmin) |
| User management (roles + mobile) | — | ✓ |
| Country / Province filters | — | ✓ (admin roles) |

---

## Multi-Tenancy Hierarchy

```
Country  (e.g. South Africa, ZAF, dialCode +27)
  └── Province  (e.g. Western Cape)
        └── District  (e.g. Cape Winelands)
              └── Organisation  (e.g. FHK First Responders)
                    └── LovResponder  (firstName, surname, username, mobile, role)
```

---

## Username System

Usernames are auto-generated when a responder with a mobile number is created:

```
Formula:  last3(firstName+surname, padded to 3) + isoCode.lower() + last3(mobileDigits)
Example:  Bianca Engels, ZAF, +27829401774  →  elszaf774
```

- Collisions resolved with suffix: `elszaf774`, `elszaf774_2`, etc.
- Username is fixed once assigned
- Visible only to SUPER_ADMIN and COUNTRY_SYSADMIN

---

## Photo Storage (Cloudflare R2)

Photos are stored in Cloudflare R2 under the key `photos/<filename>`.

**Serving photos:**
- Web (non-mobile): bytes streamed directly from R2 via `GET /api/photos/:id`
- Mobile: `expo-file-system/legacy` downloads the photo with auth header to the device cache; local file URI used for display. Cached on first load.

**Uploading photos:**
- `POST /api/incidents/:id/photos` — multipart/form-data with lat/lng/alt fields
- Stored in R2; path saved in `IncidentPhoto.storagePath`

**R2 client config (`packages/backend/src/lib/r2.ts`):**
```typescript
new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: { accessKeyId, secretAccessKey },
})
```

---

## Mobile Photo Display Notes

React Native `Image` quirks encountered and resolved:
- `width: '%'` inside `flexWrap: 'wrap'` renders with zero visible size — use explicit pixel dimensions calculated from `Dimensions.get('window').width`
- `expo-file-system` v19: import from `expo-file-system/legacy` for `getInfoAsync`/`downloadAsync`
- Photo loading state must live in the parent component, not child components — navigation state updates (e.g. `setOptions`) can remount children and cancel in-flight downloads

---

## API Reference

Base URL: `https://firstresponders-api.onrender.com` (production) or `http://localhost:3001` (dev)

All endpoints except `POST /api/auth/session`, `POST /api/auth/admin-login`, and `POST /api/hierarchy/org-registrations` require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/session` | Username + PIN → JWT (responder) |
| `POST` | `/api/auth/admin-login` | Email + password → JWT (admin/group admin) |
| `GET` | `/api/auth/organisations` | List active organisations (public) |
| `GET` | `/api/lovs/:table` | List LOV values |
| `POST` | `/api/lovs/:table` | Add new LOV value |
| `PUT` | `/api/lovs/:table/:id` | Edit LOV value (admin only) |
| `PATCH` | `/api/lovs/:table/:id/deactivate` | Deactivate LOV value (admin only) |
| `GET` | `/api/incidents` | List incidents (paginated) |
| `POST` | `/api/incidents` | Create incident |
| `GET` | `/api/incidents/:id` | Get incident detail |
| `PUT` | `/api/incidents/:id` | Update incident |
| `GET` | `/api/incidents/export/csv` | CSV export |
| `POST` | `/api/incidents/:id/photos` | Upload geotagged photo |
| `GET` | `/api/photos/:id` | Serve photo (streams bytes or presigned URL) |
| `DELETE` | `/api/photos/:id` | Delete photo |
| `GET` | `/api/admin/audit-log` | LOV change history (admin) |
| `GET` | `/api/admin/stats` | Monthly summary stats |
| `GET` | `/api/admin/users` | List responders (SysAdmin) |
| `PATCH` | `/api/admin/users/:id/role` | Update responder role/mobile/email (SysAdmin) |
| `GET` | `/api/hierarchy/countries` | Countries |
| `GET` | `/api/hierarchy/provinces` | Provinces |
| `GET` | `/api/hierarchy/districts` | Districts |
| `GET` | `/api/hierarchy/organisations` | Organisations |
| `POST` | `/api/hierarchy/org-registrations` | Submit org registration (public) |
| `GET` | `/api/hierarchy/org-registrations` | Pending registrations (CountrySysAdmin) |
| `PUT` | `/api/hierarchy/org-registrations/:id` | Approve/reject registration |
| `GET` | `/api/health` | Health check |

LOV tables: `call_types`, `reasons`, `areas`, `locations`, `transports`, `hospitals`, `responders`, `medical_history_presets`, `drugs`

---

## Database Migration Notes

`prisma migrate dev` doesn't work with `prisma.config.ts`. Apply schema changes via raw SQL then regenerate:

```bash
psql "$DATABASE_URL" -c "ALTER TABLE lov_responders ADD COLUMN ..."
npx prisma generate
```

Backfill script for usernames:
```bash
DATABASE_URL="postgresql://Admin@localhost:5432/firstresponders" \
  npx ts-node src/scripts/backfill-usernames.ts
```

---

## Future Work

- Email infrastructure for temp password delivery to new GROUP_SYSADMIN accounts
- Province and District administration panels
- PDF incident report generation
- Push notifications for new incident assignments
- Offline sync (WatermelonDB) for mobile
