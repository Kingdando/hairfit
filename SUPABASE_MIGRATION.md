# Supabase migration

The API keeps the existing `/api/*` contract and uses Supabase Postgres exclusively through `SUPABASE_DB_URL`. The runtime no longer has a local MySQL fallback. The Expo app exposes one public API URL; Node proxies face analysis to the PHP service.

## One-time migration

1. In Supabase, copy the Postgres connection string from Project Settings → Database. Use the transaction pooler string for Render.
2. In `server/.env`, set `SUPABASE_DB_URL` and optionally `SUPABASE_DB_SSL=true`.
3. For the one-time import only, copy `server/.env.migration.example` to a private migration environment and set the old MySQL source credentials there.
4. Run:

   ```sh
   cd server
   npm ci
   npm run db:migrate:supabase
   ```

The migration creates the Supabase schema, copies all application tables while preserving IDs and foreign-key relationships, and advances identity sequences. It does not delete the MySQL source.

For an empty Supabase project without legacy data, run `npm run db:init`. Then run the existing salon import/seed scripts if starter data is needed.

## Deployment

Set `SUPABASE_DB_URL`, `SUPABASE_DB_SSL=true`, `CORS_ORIGIN`, `JWT_SECRET`, and the Gemini variables in the API service. Set the Expo `EXPO_PUBLIC_API_URL` to the deployed API URL; the client should not receive the database connection string.

The public Expo variables must remain `EXPO_PUBLIC_*` and contain no database password or Supabase secret key. Expo's SDK 54 guidance also requires public variables to be referenced statically as `process.env.EXPO_PUBLIC_NAME` and warns that database/security rules must protect anything exposed to the client.
