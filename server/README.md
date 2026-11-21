# FaceFit API

Express API backed by Supabase PostgreSQL. It is isolated from the Expo package so mobile and web builds keep the existing API contract.

## Setup

1. Create a Supabase project and copy its Postgres connection string.
2. Copy `.env.example` to `.env` and set `SUPABASE_DB_URL` plus the other server secrets.
3. Install packages with `npm install`.
4. Create the Supabase tables with `npm run db:init`.
5. Start the API with `npm run dev`.

## Import real Nasugbu salons

After initializing the database, import currently mapped salons with:

```powershell
npm run salons:preview
npm run salons:import
```

The importer fetches hairdresser and beauty-salon map features inside the Nasugbu administrative boundary from OpenStreetMap. It stores coordinates and source links and safely updates previously imported records. Public map coverage is community-maintained, so this cannot guarantee every operating salon is listed. Display `© OpenStreetMap contributors` anywhere this data appears in the app.

For an existing deployment, use the one-time migration guide in the repository root to copy all legacy records. Fresh deployments can import salon data with the existing importer.

The API runs on the configured `PORT`. Test the deployed service with `GET /api/health`.

## Starter endpoints

- `GET /api/health`
- `GET /api/salons?search=makati`
- `GET /api/salons/:salonId/services`
- `POST /api/bookings`

Example booking body:

```json
{
  "userId": 1,
  "serviceId": 1,
  "stylistId": 1,
  "appointmentAt": "2026-07-16 13:00:00",
  "notes": "Soft layered lob"
}
```

For a physical phone, use your computer's LAN address instead of `localhost`, such as `http://192.168.1.10:4000`.

## Connect the Expo app

Create `FaceFit/.env` (outside this server folder) and set the deployed API URL:

```env
EXPO_PUBLIC_API_URL=https://your-facefit-api.example.com
EXPO_PUBLIC_FACE_ANALYSIS_API_URL=https://your-face-analysis-api.example.com
```

Restart Expo after changing these values. The salon list and profile screens request their records from this API.
