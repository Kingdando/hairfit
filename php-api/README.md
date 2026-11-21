    # FaceFit PHP face-analysis API

This PHP endpoint replaces the former Python face-analysis service. It accepts the same photo from the app, sends it to Gemini, validates the returned JSON, calculates ratios from Gemini's eight estimated facial points, and returns the `FaceAnalysis` response consumed by the app.

It does not save the uploaded photo. For signed-in users, it verifies the existing HS256 bearer token and saves only face shape and confidence when scan history is enabled. Guest scans do not require database configuration.

## Requirements

- PHP 8.1 or newer with cURL enabled
- A Gemini API key with access to the configured model
- A Supabase project URL and server-only service role key if signed-in scan history should be saved

## Configure and run locally

Copy `.env.example` to `.env`, set `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET`. Keep this file private.

From this directory, run:

```powershell
php -S 0.0.0.0:8000 -t public
```

The endpoint is `POST /api/face-analysis.php`. Set `EXPO_PUBLIC_FACE_ANALYSIS_API_URL` to the deployed HTTPS URL of this service. The existing Node API remains responsible for the app's other routes.

## Response and precision

The endpoint returns face shape, confidence, image dimensions, eight named estimated facial landmark coordinates, proportions calculated from those points, and five ranked hairstyle recommendations. Gemini's coordinates are approximate and are not a 478-point biometric mesh.
