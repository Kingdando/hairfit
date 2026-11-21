<?php
declare(strict_types=1);

$projectRoot = dirname(__DIR__, 3);
foreach ([$projectRoot . DIRECTORY_SEPARATOR . 'php-api' . DIRECTORY_SEPARATOR . '.env', $projectRoot . DIRECTORY_SEPARATOR . 'server' . DIRECTORY_SEPARATOR . '.env'] as $envFile) {
    if (!is_file($envFile) || !is_readable($envFile)) continue;
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$name, $value] = explode('=', $line, 2);
        $name = trim($name);
        $value = trim(trim($value), "\"'");
        if (preg_match('/^[A-Z][A-Z0-9_]*$/', $name) && getenv($name) === false) {
            putenv($name . '=' . $value);
            $_ENV[$name] = $value;
        }
    }
}

header('Content-Type: application/json; charset=utf-8');
header('Vary: Origin');

$allowedOrigins = array_values(array_filter(array_map('trim', explode(',', getenv('CORS_ORIGIN') ?: '*'))));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array('*', $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: *');
} elseif ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function base64url_decode_strict(string $value): string|false
{
    $value = strtr($value, '-_', '+/');
    $value .= str_repeat('=', (4 - strlen($value) % 4) % 4);
    return base64_decode($value, true);
}

function optional_user_id(): ?int
{
    $authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', trim($authorization), $matches)) {
        if ($authorization === '') return null;
        respond(401, ['error' => 'Your session is invalid or expired.']);
    }

    $parts = explode('.', $matches[1]);
    $secret = getenv('JWT_SECRET') ?: '';
    if (count($parts) !== 3 || $secret === '') {
        respond(401, ['error' => 'Your session is invalid or expired.']);
    }

    $header = json_decode((string) base64url_decode_strict($parts[0]), true);
    $claims = json_decode((string) base64url_decode_strict($parts[1]), true);
    $signature = base64url_decode_strict($parts[2]);
    $expected = hash_hmac('sha256', $parts[0] . '.' . $parts[1], $secret, true);
    $now = time();
    if (!is_array($header) || ($header['alg'] ?? null) !== 'HS256' || !is_array($claims) ||
        $signature === false || !hash_equals($expected, $signature) ||
        (isset($claims['exp']) && (int) $claims['exp'] <= $now) ||
        (isset($claims['nbf']) && (int) $claims['nbf'] > $now) ||
        !isset($claims['sub']) || !ctype_digit((string) $claims['sub'])) {
        respond(401, ['error' => 'Your session is invalid or expired.']);
    }
    return (int) $claims['sub'];
}

function record_scan_if_allowed(int $userId, string $shape, float $confidence): void
{
    $baseUrl = rtrim((string) (getenv('SUPABASE_URL') ?: ''), '/');
    $serviceKey = (string) (getenv('SUPABASE_SERVICE_ROLE_KEY') ?: '');
    if ($baseUrl === '' || $serviceKey === '') {
        throw new RuntimeException('Supabase settings are required to save signed-in scan history.');
    }

    $request = static function (string $method, string $path, ?array $body = null) use ($baseUrl, $serviceKey): array {
        $curl = curl_init($baseUrl . '/rest/v1/' . ltrim($path, '/'));
        if ($curl === false) throw new RuntimeException('Unable to initialize Supabase request.');
        $headers = [
            'apikey: ' . $serviceKey,
            'Authorization: Bearer ' . $serviceKey,
            'Content-Type: application/json',
        ];
        if ($body !== null) $headers[] = 'Prefer: return=minimal';
        curl_setopt_array($curl, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body, JSON_UNESCAPED_SLASHES),
        ]);
        $response = curl_exec($curl);
        $error = curl_error($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
        if ($response === false || $error !== '' || $status < 200 || $status >= 300) {
            throw new RuntimeException('Supabase request failed: ' . ($error !== '' ? $error : 'HTTP ' . $status));
        }
        if ($response === '') return [];
        $decoded = json_decode($response, true);
        return is_array($decoded) ? $decoded : [];
    };

    $setting = $request('GET', 'privacy_settings?user_id=eq.' . rawurlencode((string) $userId) . '&select=save_scan_history&limit=1');
    if (isset($setting[0]['save_scan_history']) && !$setting[0]['save_scan_history']) return;
    $request('POST', 'face_analyses', [
        'user_id' => $userId,
        'face_shape' => $shape,
        'confidence' => round($confidence * 100, 2),
    ]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST, OPTIONS');
    respond(405, ['error' => 'Use POST to analyze a face photo.']);
}

$rawRequest = file_get_contents('php://input');
if ($rawRequest === false || strlen($rawRequest) > 6 * 1024 * 1024) {
    respond(413, ['error' => 'A face photo smaller than 4 MB is required.']);
}
$payload = json_decode($rawRequest, true);
if (!is_array($payload) || !isset($payload['imageData']) || !is_string($payload['imageData'])) {
    respond(400, ['error' => 'A face photo is required.']);
}

$imageData = trim($payload['imageData']);
if (!preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+\/=\r\n]+)$/i', $imageData, $imageMatch)) {
    respond(400, ['error' => 'The camera returned an unsupported image format. Use JPG, PNG, or WebP.']);
}
$mime = strtolower($imageMatch[1]);
$mime = $mime === 'jpg' ? 'jpeg' : $mime;
$imageBytes = base64_decode(preg_replace('/\s+/', '', $imageMatch[2]), true);
if ($imageBytes === false || $imageBytes === '' || strlen($imageBytes) > 4 * 1024 * 1024) {
    respond(400, ['error' => 'The image must be smaller than 4 MB and have valid encoding.']);
}
$imageInfo = @getimagesizefromstring($imageBytes);
if ($imageInfo === false || !isset($imageInfo[0], $imageInfo[1])) {
    respond(400, ['error' => 'The uploaded file is not a readable image.']);
}
$detectedMime = strtolower((string) ($imageInfo['mime'] ?? ''));
if (!in_array($detectedMime, ['image/jpeg', 'image/png', 'image/webp'], true) || $detectedMime !== 'image/' . $mime) {
    respond(400, ['error' => 'The image data does not match its declared format.']);
}

$stylePreference = ($payload['stylePreference'] ?? '') === 'women' ? 'women' : 'men';
$hairLength = isset($payload['hairLength']) && is_string($payload['hairLength'])
    ? substr(trim($payload['hairLength']), 0, 50)
    : '';
$userId = optional_user_id();
$apiKey = getenv('GEMINI_API_KEY') ?: '';
$model = getenv('GEMINI_ANALYSIS_MODEL') ?: 'gemini-3.8-flash';
if ($apiKey === '') {
    respond(503, ['error' => 'Face analysis is not configured on the PHP API.']);
}

$pointSchema = [
    'type' => 'OBJECT',
    'properties' => [
        'x' => ['type' => 'INTEGER', 'minimum' => 0, 'maximum' => 1000],
        'y' => ['type' => 'INTEGER', 'minimum' => 0, 'maximum' => 1000],
    ],
    'required' => ['x', 'y'],
    'propertyOrdering' => ['x', 'y'],
];
$schema = [
    'type' => 'OBJECT',
    'properties' => [
        'faceCount' => ['type' => 'INTEGER', 'minimum' => 0, 'maximum' => 2, 'description' => 'Use 2 when two or more faces are visible.'],
        'faceShape' => ['type' => 'STRING', 'enum' => ['oval', 'round', 'square', 'heart', 'oblong', 'diamond']],
        'confidence' => ['type' => 'NUMBER', 'minimum' => 0, 'maximum' => 1],
        'points' => [
            'type' => 'OBJECT',
            'properties' => [
                'foreheadTop' => $pointSchema,
                'chin' => $pointSchema,
                'leftCheek' => $pointSchema,
                'rightCheek' => $pointSchema,
                'leftForehead' => $pointSchema,
                'rightForehead' => $pointSchema,
                'leftJaw' => $pointSchema,
                'rightJaw' => $pointSchema,
            ],
            'required' => ['foreheadTop', 'chin', 'leftCheek', 'rightCheek', 'leftForehead', 'rightForehead', 'leftJaw', 'rightJaw'],
            'propertyOrdering' => ['foreheadTop', 'chin', 'leftCheek', 'rightCheek', 'leftForehead', 'rightForehead', 'leftJaw', 'rightJaw'],
        ],
        'recommendations' => [
            'type' => 'ARRAY',
            'minItems' => 5,
            'maxItems' => 5,
            'items' => [
                'type' => 'OBJECT',
                'properties' => [
                    'name' => ['type' => 'STRING'],
                    'score' => ['type' => 'INTEGER', 'minimum' => 50, 'maximum' => 99],
                    'reason' => ['type' => 'STRING'],
                    'audience' => ['type' => 'STRING', 'enum' => ['men', 'women']],
                ],
                'required' => ['name', 'score', 'reason', 'audience'],
                'propertyOrdering' => ['name', 'score', 'reason', 'audience'],
            ],
        ],
    ],
    'required' => ['faceCount', 'faceShape', 'confidence', 'points', 'recommendations'],
    'propertyOrdering' => ['faceCount', 'faceShape', 'confidence', 'points', 'recommendations'],
];
$prompt = "Analyze the single person's visible face in this image for a hairstyle consultation. " .
    "Estimate one face shape from oval, round, square, heart, oblong, or diamond. " .
    "Return eight approximate facial points as integer coordinates normalized from 0 to 1000, where x=0 is the image's left edge and y=0 is its top edge: foreheadTop is the center of the visible upper forehead near the hairline; chin is the lowest point of the chin; leftCheek and rightCheek are the outer cheekbone edges; leftForehead and rightForehead are the left and right temple/forehead edges; leftJaw and rightJaw are the jaw corners. " .
    "Points must refer to the photographed image (not a mirrored selfie preview). If a point is obscured, estimate its location from visible facial structure. " .
    "Return exactly five distinct hairstyle suggestions that suit the detected face shape and estimated proportions for the {$stylePreference} style audience, with concise reasons and fit scores from 50 to 99. " .
    ($hairLength !== '' ? "The person's current hair length is {$hairLength}; account for it in the rankings and reasons. " : '') .
    "Set faceCount to 0 if no face is visible, 1 for exactly one, or 2 for multiple faces. Do not infer identity, age, ethnicity, health, or other sensitive traits. These are visual estimates, not biometric measurements.";

$requestBody = [
    'contents' => [[
        'parts' => [
            ['text' => $prompt],
            ['inlineData' => ['mimeType' => 'image/' . $mime, 'data' => base64_encode($imageBytes)]],
        ],
    ]],
    'generationConfig' => [
        'responseMimeType' => 'application/json',
        'responseSchema' => $schema,
        'temperature' => 0.2,
    ],
];

$curl = curl_init('https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent');
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $apiKey],
    CURLOPT_POSTFIELDS => json_encode($requestBody, JSON_UNESCAPED_SLASHES),
]);
$geminiBody = curl_exec($curl);
$curlError = curl_error($curl);
$geminiStatus = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
curl_close($curl);
if ($geminiBody === false || $geminiStatus < 200 || $geminiStatus >= 300) {
    error_log('Gemini face analysis request failed: ' . ($curlError !== '' ? $curlError : 'HTTP ' . $geminiStatus));
    respond(502, ['error' => 'Gemini could not analyze this photo. Please try again.']);
}

$geminiResponse = json_decode($geminiBody, true);
$modelText = $geminiResponse['candidates'][0]['content']['parts'][0]['text'] ?? null;
$analysis = is_string($modelText) ? json_decode($modelText, true) : null;
if (!is_array($analysis)) {
    respond(502, ['error' => 'Gemini returned an unreadable face analysis. Please try again.']);
}
if ((int) ($analysis['faceCount'] ?? 0) !== 1) {
    respond(422, ['error' => (int) ($analysis['faceCount'] ?? 0) > 1
        ? 'More than one face was detected. Use a photo containing only you.'
        : 'No face was detected. Face forward in even light and try again.']);
}

$pointNames = ['foreheadTop', 'chin', 'leftCheek', 'rightCheek', 'leftForehead', 'rightForehead', 'leftJaw', 'rightJaw'];
$points = $analysis['points'] ?? null;
if (!is_array($points)) respond(502, ['error' => 'Gemini returned incomplete facial landmarks. Please try again.']);
$landmarks = [];
foreach ($pointNames as $name) {
    $point = $points[$name] ?? null;
    if (!is_array($point) || !isset($point['x'], $point['y']) ||
        !is_numeric($point['x']) || !is_numeric($point['y']) ||
        $point['x'] < 0 || $point['x'] > 1000 || $point['y'] < 0 || $point['y'] > 1000) {
        respond(502, ['error' => 'Gemini returned invalid facial landmarks. Please try again.']);
    }
    $landmarks[] = ['x' => round((float) $point['x'] / 1000, 5), 'y' => round((float) $point['y'] / 1000, 5), 'z' => 0];
}

$width = (int) $imageInfo[0];
$height = (int) $imageInfo[1];
$distance = static function (array $a, array $b) use ($width, $height): float {
    return hypot(((float) $a['x'] - (float) $b['x']) * $width / 1000, ((float) $a['y'] - (float) $b['y']) * $height / 1000);
};
$faceLength = $distance($points['foreheadTop'], $points['chin']);
$cheekWidth = $distance($points['leftCheek'], $points['rightCheek']);
if ($cheekWidth < 1 || $faceLength < 1) respond(422, ['error' => 'The face is too small or unclear in the image. Move closer and try again.']);
$measurements = [
    'lengthToWidth' => round($faceLength / $cheekWidth, 3),
    'jawToCheek' => round($distance($points['leftJaw'], $points['rightJaw']) / $cheekWidth, 3),
    'foreheadToCheek' => round($distance($points['leftForehead'], $points['rightForehead']) / $cheekWidth, 3),
];
$shape = $analysis['faceShape'] ?? null;
$confidence = $analysis['confidence'] ?? null;
if (!in_array($shape, ['oval', 'round', 'square', 'heart', 'oblong', 'diamond'], true) ||
    !is_numeric($confidence) || $confidence < 0 || $confidence > 1 ||
    !is_array($analysis['recommendations'] ?? null) || count($analysis['recommendations']) !== 5) {
    respond(502, ['error' => 'Gemini returned an incomplete face analysis. Please try again.']);
}

$recommendations = [];
foreach ($analysis['recommendations'] as $recommendation) {
    if (!is_array($recommendation) || !is_string($recommendation['name'] ?? null) || trim($recommendation['name']) === '' ||
        !is_numeric($recommendation['score'] ?? null) || $recommendation['score'] < 50 || $recommendation['score'] > 99 ||
        !is_string($recommendation['reason'] ?? null) || trim($recommendation['reason']) === '') {
        respond(502, ['error' => 'Gemini returned invalid hairstyle suggestions. Please try again.']);
    }
    $recommendations[] = [
        'name' => trim($recommendation['name']),
        'score' => (int) $recommendation['score'],
        'reason' => trim($recommendation['reason']),
        'audience' => $stylePreference,
    ];
}
usort($recommendations, static fn(array $a, array $b): int => $b['score'] <=> $a['score']);

if ($userId !== null) {
    try {
        record_scan_if_allowed($userId, $shape, (float) $confidence);
    } catch (Throwable $error) {
        error_log('Could not save face-analysis history: ' . $error->getMessage());
        respond(500, ['error' => 'The analysis finished, but scan history could not be saved. Please try again.']);
    }
}

respond(200, ['data' => [
    'faceShape' => $shape,
    'stylePreference' => $stylePreference,
    'confidence' => round((float) $confidence, 2),
    'imageSize' => ['width' => $width, 'height' => $height],
    'landmarks' => $landmarks,
    'measurements' => $measurements,
    'recommendations' => $recommendations,
]]);
