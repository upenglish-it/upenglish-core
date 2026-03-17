<?php
/**
 * AI Handler Logic v22 (Model Variant Support)
 * Features:
 * - CORS Preflight (OPTIONS) Handling for Cross-Origin Requests
 * - Strict Waterfall: Always Try Google Free Key -> Fallback to Paid Key.
 * - Media Guard: Blocks media requests for FREE profile if disabled in .env.
 * - Google Native: Supports Gemini (Chat/Vision/Audio/TTS), Imagen.
 * - Audio Support: Full Gemini Audio (Input & Output)
 * - NEW v22: Model Variant Support (BACKUP, BACKUP_2, BACKUP_3)
 *   Examples:
 *     modelProfile: "STANDARD" => uses STANDARD_MODEL_PRIMARY
 *     modelProfile: "STANDARD_BACKUP" => uses STANDARD_MODEL_BACKUP
 *     modelProfile: "FREE_BACKUP_2" => uses FREE_MODEL_BACKUP_2
 */

// ==========================================
// CORS HEADERS - MUST BE AT THE VERY TOP
// ==========================================
// Allow from any origin
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');    // cache for 1 day
} else {
    header('Access-Control-Allow-Origin: *');
}

// Access-Control headers are received during OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS");         

    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");

    exit(0);
}

// Handle CORS Preflight Request (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204); // No Content
    exit;
}

// ==========================================
// MAIN EXECUTION
// ==========================================
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { 
    echo json_encode(['error' => 'POST required']); 
    exit; 
}

$input = json_decode(file_get_contents('php://input'));
if (!$input) { 
    echo json_encode(['error' => 'Invalid JSON']); 
    exit; 
}

// ==========================================
// SPECIAL ROUTE: Google Translate TTS Proxy
// ==========================================
if (isset($input->action) && $input->action === 'gtts') {
    $text = $input->text ?? '';
    $lang = $input->lang ?? 'en-US';
    
    if (empty($text)) {
        echo json_encode(['error' => 'Text required']);
        exit;
    }
    
    // Build Google Translate TTS URL
    $ttsUrl = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' . urlencode($lang) . '&q=' . urlencode($text);
    
    // Fetch audio from Google
    $ch = curl_init($ttsUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $audioData = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);
    
    if ($httpCode === 200 && $audioData) {
        // Return as base64 encoded audio
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'audio' => base64_encode($audioData),
            'contentType' => $contentType ?: 'audio/mpeg'
        ]);
    } else {
        echo json_encode(['error' => 'Failed to fetch audio from Google TTS', 'httpCode' => $httpCode]);
    }
    exit;
}

ini_set('display_errors', 0);
error_reporting(E_ALL);

class AIService {
    private $env;
    private $currentInput; // Store input for TTS config access

    public function __construct() {
        $this->loadEnv();
    }

    private function loadEnv() {
        $paths = [
            dirname($_SERVER['DOCUMENT_ROOT']) . '/.env',
            $_SERVER['DOCUMENT_ROOT'] . '/../.env',
            __DIR__ . '/.env' // Also check current dir
        ];
        foreach ($paths as $p) {
            if (file_exists($p)) {
                $lines = file($p, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                foreach ($lines as $line) {
                    if (strpos(trim($line), '#') === 0) continue;
                    if (strpos($line, '=') !== false) {
                        list($name, $value) = explode('=', $line, 2);
                        $val = trim($value);
                        if (preg_match('/^"(.*)"$/', $val, $m)) $val = $m[1];
                        elseif (preg_match("/^'(.*)'$/", $val, $m)) $val = $m[1];
                        $this->env[trim($name)] = $val;
                    }
                }
                return;
            }
        }
    }

    /**
     * Parse profile to extract base profile and variant
     * Examples:
     *   "STANDARD" => ["profile" => "STANDARD", "variant" => "PRIMARY"]
     *   "STANDARD_BACKUP" => ["profile" => "STANDARD", "variant" => "BACKUP"]
     *   "FREE_BACKUP_2" => ["profile" => "FREE", "variant" => "BACKUP_2"]
     *   "PREMIUM_BACKUP_3" => ["profile" => "PREMIUM", "variant" => "BACKUP_3"]
     */
    private function parseProfileVariant($profileInput) {
        $profileInput = strtoupper($profileInput);
        
        // Check for BACKUP_3, BACKUP_2, BACKUP suffix (order matters - check longer first)
        if (preg_match('/^(FREE|STANDARD|PREMIUM)_(BACKUP_3)$/', $profileInput, $m)) {
            return ['profile' => $m[1], 'variant' => $m[2]];
        }
        if (preg_match('/^(FREE|STANDARD|PREMIUM)_(BACKUP_2)$/', $profileInput, $m)) {
            return ['profile' => $m[1], 'variant' => $m[2]];
        }
        if (preg_match('/^(FREE|STANDARD|PREMIUM)_(BACKUP)$/', $profileInput, $m)) {
            return ['profile' => $m[1], 'variant' => $m[2]];
        }
        
        // No variant suffix, use PRIMARY
        return ['profile' => $profileInput, 'variant' => 'PRIMARY'];
    }

    /**
     * Lấy config model dựa trên Profile và Mode
     * NEW v22: Supports model variants (BACKUP, BACKUP_2, BACKUP_3)
     */
    public function getModelConfig($profileInput, $mode) {
        // Parse profile and variant
        $parsed = $this->parseProfileVariant($profileInput);
        $profile = $parsed['profile'];
        $variant = $parsed['variant'];
        
        // 1. Kiểm tra quyền Media cho Free Profile
        if ($profile === 'FREE' && $mode !== 'chat') {
            $enabled = $this->env['FREE_MEDIA_ENABLED'] ?? 'false';
            if ($enabled === 'false' || $enabled === false) {
                $this->sendError(403, "Media features (Audio/Vision/Image) are disabled for FREE tier.");
            }
        }

        // 2. Map Mode sang Env Key tương ứng
        $envKey = '';
        switch ($mode) {
            case 'vision':
                $envKey = $profile . '_MEDIA_VISION';
                break;
            case 'tts':
                $envKey = $profile . '_MEDIA_AUDIO';
                break;
            case 'image_generate':
                $envKey = $profile . '_MEDIA_IMAGE';
                break;
            case 'audio':
                $envKey = $profile . '_MEDIA_LISTENING';
                break;
            case 'file_chat':
            case 'chat':
            default:
                // NEW v22: Use variant for chat mode
                // Examples: STANDARD_MODEL_PRIMARY, STANDARD_MODEL_BACKUP, FREE_MODEL_BACKUP_2
                $envKey = $profile . '_MODEL_' . $variant;
                break;
        }

        if (isset($this->env[$envKey])) {
            return $this->env[$envKey];
        }

        // Fallback nhẹ (nếu thiếu config Vision, thử dùng model Chat vì Gemini Flash làm được cả 2)
        if ($mode === 'vision' && isset($this->env[$profile . '_MODEL_PRIMARY'])) {
            return $this->env[$profile . '_MODEL_PRIMARY'];
        }
        
        // Fallback cho Audio: dùng Vision model nếu có (vì Gemini multimodal hỗ trợ cả audio)
        if ($mode === 'audio' && isset($this->env[$profile . '_MEDIA_VISION'])) {
            return $this->env[$profile . '_MEDIA_VISION'];
        }
        if ($mode === 'audio' && isset($this->env[$profile . '_MODEL_PRIMARY'])) {
            return $this->env[$profile . '_MODEL_PRIMARY'];
        }

        return null;
    }

    private function parseConfig($configStr) {
        if (strpos($configStr, ':') === false) return ['provider' => 'openrouter', 'model' => $configStr];
        list($provider, $model) = explode(':', $configStr, 2);
        return ['provider' => strtolower($provider), 'model' => $model];
    }

    private function getApiKey($provider, $usePaid = false) {
        $keyName = strtoupper($provider) . '_API_KEY_' . ($usePaid ? 'PAID' : 'FREE');
        return $this->env[$keyName] ?? '';
    }

    /**
     * Convert PCM to WAV
     */
    private function pcmToWav($pcmData) {
        $sampleRate = 24000; // Gemini default
        $numChannels = 1;
        $bitsPerSample = 16;
        $byteRate = $sampleRate * $numChannels * ($bitsPerSample / 8);
        $blockAlign = $numChannels * ($bitsPerSample / 8);
        $dataLen = strlen($pcmData);
        $totalLen = 36 + $dataLen;

        $header = "RIFF";
        $header .= pack("V", $totalLen); // ChunkSize
        $header .= "WAVE";
        $header .= "fmt ";
        $header .= pack("V", 16); // Subchunk1Size (16 for PCM)
        $header .= pack("v", 1); // AudioFormat (1 for PCM)
        $header .= pack("v", $numChannels);
        $header .= pack("V", $sampleRate);
        $header .= pack("V", $byteRate);
        $header .= pack("v", $blockAlign);
        $header .= pack("v", $bitsPerSample);
        $header .= "data";
        $header .= pack("V", $dataLen);

        return $header . $pcmData;
    }

    /**
     * Core API Call Logic
     */
    private function callApiProvider($provider, $model, $apiKey, $system, $user, $format, $mode, $mediaData = null, $mimeType = null) {
        $url = "";
        $headers = [];
        $data = [];
        
        // =================================================================
        // GOOGLE PROVIDER (NATIVE)
        // =================================================================
        if ($provider === 'google') {
            
            // --- A. GOOGLE TTS (Text-to-Speech) OR GEMINI AUDIO GEN ---
            if ($mode === 'tts') {
                
                // CHECK IF GEMINI MODEL (for Audio Generation)
                if (stripos($model, 'gemini') !== false) {
                    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
                    $headers = ["Content-Type: application/json"];
                    
                    // ============================================
                    // MULTI-SPEAKER SUPPORT (v23)
                    // If client sends speechConfig, use it (multi-speaker)
                    // Otherwise, fall back to single voice selection
                    // ============================================
                    
                    $speechConfig = null;
                    
                    // Check if client sent multi-speaker config
                    if (isset($this->currentInput->speechConfig)) {
                        // Use client-provided multi-speaker config directly
                        $speechConfig = $this->currentInput->speechConfig;
                    } else {
                        // Fall back to single voice selection (original logic)
                        $voiceName = "Charon"; // Default Male
                        
                        $instructions = $this->currentInput->courseConfig->instructions ?? '';
                        $lcInstr = strtolower($instructions);
                        
                        if (strpos($lcInstr, 'female') !== false || 
                            strpos($lcInstr, 'woman') !== false ||
                            strpos($lcInstr, 'girl') !== false) {
                            $voiceName = "Aoede";
                        }
                        elseif (strpos($lcInstr, 'male') !== false || 
                                strpos($lcInstr, 'man') !== false ||
                                strpos($lcInstr, 'boy') !== false) {
                            $voiceName = "Charon";
                        }
                        else {
                            // Fallback mapping based on styles
                            if (strpos($instructions, '7-year-old') !== false) $voiceName = "Aoede";
                            elseif (strpos($instructions, 'Beginner') !== false) $voiceName = "Aoede";
                            elseif (strpos($instructions, 'Intermediate') !== false) $voiceName = "Charon";
                            elseif (strpos($instructions, 'Business') !== false) $voiceName = "Aoede";
                            elseif (strpos($instructions, 'University') !== false) $voiceName = "Aoede";
                            elseif (strpos($instructions, 'Fluent') !== false) $voiceName = "Charon";
                        }
                
                        $speechConfig = [
                            "voiceConfig" => [
                                "prebuiltVoiceConfig" => [
                                    "voiceName" => $voiceName
                                ]
                            ]
                        ];
                    }
                
                    $data = [
                        "contents" => [
                            ["parts" => [["text" => $user]]]
                        ],
                        "generationConfig" => [
                            "responseModalities" => ["AUDIO"],
                            "speechConfig" => $speechConfig
                        ]
                    ];
                }
                else {
                    // LEGACY TTS (STANDARD)
                    $url = "https://texttospeech.googleapis.com/v1/text:synthesize?key={$apiKey}";
                    $headers = ["Content-Type: application/json"];
                    
                    // Get speaking rate from courseConfig (level-based speed)
                    $speakingRate = 1.0;
                    if (isset($this->currentInput->courseConfig->speed)) {
                        $speakingRate = floatval($this->currentInput->courseConfig->speed);
                        $speakingRate = max(0.25, min(4.0, $speakingRate));
                    }
                    
                    // Voice Selection based on Level
                    $voiceParams = ["languageCode" => "en-US", "name" => "en-US-Studio-O"];
                    $instructions = $this->currentInput->courseConfig->instructions ?? '';
                    
                    if (strpos($instructions, '7-year-old') !== false || strpos($instructions, 'children') !== false) {
                        $voiceParams = ["languageCode" => "en-US", "name" => "en-US-Journey-F"];
                    }
                    elseif (strpos($instructions, 'Beginner learners') !== false || strpos($instructions, 'survival English') !== false) {
                        $voiceParams = ["languageCode" => "en-GB", "name" => "en-GB-Neural2-A"];
                    }
                    elseif (strpos($instructions, 'Intermediate learners') !== false || strpos($instructions, 'Narrative') !== false) {
                        $voiceParams = ["languageCode" => "en-GB", "name" => "en-GB-Neural2-B"];
                    }
                    elseif (strpos($instructions, 'Business professionals') !== false || strpos($instructions, 'Professional') !== false) {
                        $voiceParams = ["languageCode" => "en-US", "name" => "en-US-Studio-O"];
                    }
                    elseif (strpos($instructions, 'University students') !== false || strpos($instructions, 'Academic') !== false) {
                        $voiceParams = ["languageCode" => "en-AU", "name" => "en-AU-Neural2-A"];
                    }
                    elseif (strpos($instructions, 'Fluent speakers') !== false || strpos($instructions, 'casual') !== false) {
                        $voiceParams = ["languageCode" => "en-US", "name" => "en-US-Neural2-J"];
                    }
                    elseif (strpos($model, 'journey') !== false) {
                        $voiceParams = ["languageCode" => "en-US", "name" => "en-US-Journey-F"]; 
                    }
    
                    $data = [
                        "input" => ["text" => $user],
                        "voice" => $voiceParams,
                        "audioConfig" => [
                            "audioEncoding" => "MP3",
                            "speakingRate" => $speakingRate
                        ]
                    ];
                }
            } 
            
            // --- B. GOOGLE IMAGEN (Image Generation) ---
            elseif ($mode === 'image_generate') {
                $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:predict?key={$apiKey}";
                $headers = ["Content-Type: application/json"];
                $data = [
                    "instances" => [
                        ["prompt" => $user]
                    ],
                    "parameters" => [
                        "sampleCount" => 1,
                        "aspectRatio" => "1:1"
                    ]
                ];
            } 
            
            // --- C. AUDIO LISTENING MODE (Pronunciation Analysis) ---
            elseif ($mode === 'audio') {
                $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
                $headers = ["Content-Type: application/json"];
                
                // Validate audio data
                if (empty($mediaData)) {
                    throw new Exception("Audio data required for listening mode.");
                }
                
                // Default mime type for audio
                $audioMimeType = $mimeType ?: 'audio/webm';
                
                // Build parts array with system prompt and audio
                $parts = [];
                
                // Add system prompt as text if provided
                if (!empty($system)) {
                    $parts[] = ["text" => $system];
                }
                
                // Add user text if provided
                if (!empty($user)) {
                    $parts[] = ["text" => $user];
                }
                
                // Add audio data as inline_data
                $parts[] = [
                    "inline_data" => [
                        "mime_type" => $audioMimeType,
                        "data" => $mediaData
                    ]
                ];

                $payload = [
                    "contents" => [
                        [
                            "role" => "user",
                            "parts" => $parts
                        ]
                    ]
                ];
                
                // Request JSON response format
                if ($format === 'json_object') {
                    $payload["generationConfig"] = ["responseMimeType" => "application/json"];
                }
                
                $data = $payload;
            }
            
            // --- D. GEMINI (Chat, Vision & File Chat) ---
            else {
                $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
                $headers = ["Content-Type: application/json"];
                
                $parts = [];
                if ($user) $parts[] = ["text" => $user];
                
                // Xử lý ảnh (Vision)
                if ($mode === 'vision' && $mediaData) {
                    $imageMimeType = $mimeType ?: 'image/jpeg';
                    $parts[] = [
                        "inline_data" => [
                            "mime_type" => $imageMimeType,
                            "data" => $mediaData
                        ]
                    ];
                }

                // File Chat: attach file (PDF, image, etc.) as inline_data
                if ($mode === 'file_chat' && $mediaData) {
                    $fileMime = $mimeType ?: 'application/pdf';
                    $parts[] = [
                        "inline_data" => [
                            "mime_type" => $fileMime,
                            "data" => $mediaData
                        ]
                    ];
                }

                $payload = ["contents" => [["role" => "user", "parts" => $parts]]];
                if (!empty($system)) {
                    $payload["system_instruction"] = ["parts" => ["text" => $system]];
                }
                $genConfig = [];
                if ($format === 'json_object') {
                    $genConfig["responseMimeType"] = "application/json";
                }
                // Thinking Mode Support
                $thinkingLevel = $this->currentInput->thinkingLevel ?? null;
                if ($thinkingLevel) {
                    $genConfig["thinkingConfig"] = ["thinkingLevel" => strtoupper($thinkingLevel)];
                }
                if (!empty($genConfig)) {
                    $payload["generationConfig"] = $genConfig;
                }
                $data = $payload;
            }
        } 
        
        // =================================================================
        // OPENROUTER / OPENAI PROVIDER
        // =================================================================
        else { 
            $headers = [
                "Authorization: Bearer " . $apiKey,
                "Content-Type: application/json",
                "HTTP-Referer: " . ($this->env['APP_URL'] ?? 'https://upenglishvietnam.com'),
                "X-Title: UpEnglish AI"
            ];

            // AUDIO MODE NOT SUPPORTED ON OPENROUTER
            if ($mode === 'audio') {
                throw new Exception("Audio listening mode is only supported with Google Gemini. Please configure MEDIA_LISTENING with 'google:' prefix in .env");
            }

            if ($mode === 'tts') {
                $url = "https://openrouter.ai/api/v1/audio/speech";
                
                $speed = 1.0;
                if (isset($this->currentInput->courseConfig->speed)) {
                    $speed = floatval($this->currentInput->courseConfig->speed);
                }
                
                $data = ["model" => $model, "input" => $user, "voice" => "alloy", "speed" => $speed];
            } elseif ($mode === 'image_generate') {
                $url = "https://openrouter.ai/api/v1/images/generations";
                $data = ["model" => $model, "prompt" => $user, "n" => 1, "size" => "1024x1024"];
            } else {
                $url = "https://openrouter.ai/api/v1/chat/completions";
                $userContent = $user;
                if ($mode === 'vision' && $mediaData) {
                    $imageMimeType = $mimeType ?: 'image/jpeg';
                    $userContent = [
                        ["type" => "text", "text" => $user],
                        ["type" => "image_url", "image_url" => ["url" => "data:{$imageMimeType};base64," . $mediaData]]
                    ];
                }
                $messages = [];
                if (!empty($system)) $messages[] = ["role" => "system", "content" => $system];
                $messages[] = ["role" => "user", "content" => $userContent];
                $data = ["model" => $model, "messages" => $messages];
                if ($format === 'json_object') $data["response_format"] = ["type" => "json_object"];
            }
        }

        // --- EXECUTE CURL ---
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 120); // Increased timeout for audio processing
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) throw new Exception("Connection Error: $curlError");

        if ($httpCode !== 200) {
            $jsonResp = json_decode($response, true);
            $msg = isset($jsonResp['error']['message']) ? $jsonResp['error']['message'] : $response;
            if ($httpCode == 429) throw new Exception("QUOTA_EXCEEDED");
            throw new Exception("API Error $httpCode: $msg");
        }

        // --- NORMALIZE OUTPUT ---
        $jsonResp = json_decode($response, true);

        // 1. Audio Output (TTS)
        if ($mode === 'tts') {
            if ($provider === 'google') {
                
                // HANDLE GEMINI AUDIO (PCM)
                if (isset($jsonResp['candidates'][0]['content']['parts'])) {
                     foreach ($jsonResp['candidates'][0]['content']['parts'] as $part) {
                         if (isset($part['inlineData']['data'])) {
                             $pcmReq = base64_decode($part['inlineData']['data']);
                             // Convert Gemini 24kHz PCM to WAV
                             $wavData = $this->pcmToWav($pcmReq);
                             return ['type' => 'audio', 'data' => $wavData, 'contentType' => 'audio/wav'];
                         }
                     }
                }
                
                // HANDLE LEGACY AUDIO (MP3)
                if (isset($jsonResp['audioContent'])) {
                    return ['type' => 'audio', 'data' => base64_decode($jsonResp['audioContent']), 'contentType' => 'audio/mpeg'];
                }
                throw new Exception("Google TTS missing audioContent or inlineData");
            } else {
                return ['type' => 'audio', 'data' => $response, 'contentType' => 'audio/mpeg'];
            }
        }

        // 2. Image Output (Image Gen)
        if ($mode === 'image_generate') {
            if ($provider === 'google') {
                 if (isset($jsonResp['predictions'][0]['bytesBase64Encoded'])) {
                    return ['type' => 'image', 'data' => $jsonResp['predictions'][0]['bytesBase64Encoded'], 'format' => 'base64'];
                }
            } else {
                if (isset($jsonResp['data'][0]['url'])) return ['type' => 'image', 'data' => $jsonResp['data'][0]['url'], 'format' => 'url'];
                if (isset($jsonResp['data'][0]['b64_json'])) return ['type' => 'image', 'data' => $jsonResp['data'][0]['b64_json'], 'format' => 'base64'];
            }
        }

        // 3. Text/Chat/Audio Analysis Output (Standardize to OpenAI structure)
        if ($provider === 'google') {
            // FIXED v23: Handle multi-part responses (Gemini Thinking Mode splits thought/text)
            $text = '';
            if (isset($jsonResp['candidates'][0]['content']['parts'])) {
                foreach ($jsonResp['candidates'][0]['content']['parts'] as $part) {
                    // Skip thinking/thought parts from Gemini 3
                    if (isset($part['thought']) && $part['thought'] === true) continue;
                    $text .= $part['text'] ?? '';
                }
            }
            
            // FIXED v23: Clean Thinking Tags (DeepSeek/Gemini)
            // Removes internal thought process <think>...</think> to return clean answer
            $text = preg_replace('/<think>.*?<\/think>/s', '', $text);

            return ['choices' => [['message' => ['content' => trim($text)]]]];
        }

        // FIXED v23: Clean OpenRouter/DeepSeek Thinking output
        // If the model returns raw <think> tags, strip them for the frontend
        if (isset($jsonResp['choices'][0]['message']['content'])) {
            $content = $jsonResp['choices'][0]['message']['content'];
            if (strpos($content, '<think>') !== false) {
                 $newContent = preg_replace('/<think>.*?<\/think>/s', '', $content);
                 $jsonResp['choices'][0]['message']['content'] = trim($newContent);
            }
        }

        return $jsonResp;
    }

    /**
     * Waterfall Logic: Free -> Paid
     */
    private function attemptGeneration($configStr, $system, $user, $format, $mode, $mediaData, $mimeType = null) {
        $conf = $this->parseConfig($configStr);
        try {
            // STEP 1: Try Free Key
            $keyFree = $this->getApiKey($conf['provider'], false);
            if (empty($keyFree)) throw new Exception("No Free Key configured for {$conf['provider']}");
            
            return $this->callApiProvider($conf['provider'], $conf['model'], $keyFree, $system, $user, $format, $mode, $mediaData, $mimeType);

        } catch (Exception $e) {
            // STEP 2: Check if eligible for Paid Retry
            $shouldRetryPaid = true;
            if ($conf['provider'] === 'openrouter' && strpos($conf['model'], ':free') !== false) $shouldRetryPaid = false;
            
            if ($shouldRetryPaid) {
                $keyPaid = $this->getApiKey($conf['provider'], true);
                if (!empty($keyPaid)) {
                    return $this->callApiProvider($conf['provider'], $conf['model'], $keyPaid, $system, $user, $format, $mode, $mediaData, $mimeType);
                }
            }
            throw $e;
        }
    }

    public function processRequest($input) {
        try {
            // Store input for TTS config access
            $this->currentInput = $input;
            
            $profile = $input->modelProfile ?? 'FREE';
            $mode = $input->mode ?? 'chat'; // chat, vision, tts, image_generate, audio
            
            // 1. Get Model Config from .env based on Mode
            $configStr = $this->getModelConfig($profile, $mode);
            
            if (!$configStr) {
                // Parse to get base profile for better error message
                $parsed = $this->parseProfileVariant($profile);
                if ($parsed['profile'] === 'FREE') throw new Exception("Feature disabled or not configured for FREE tier.");
                throw new Exception("Missing configuration for $profile / $mode");
            }

            $system = $input->systemPrompt ?? '';
            $user = $input->userContent ?? '';
            $format = $input->responseFormat ?? null;
            
            // Media Data Handling (Vision & Audio)
            $mediaData = null;
            $mimeType = null;
            
            if ($mode === 'vision') {
                $mediaData = $input->image ?? null;
                $mimeType = $input->mimeType ?? 'image/jpeg';
                if (empty($mediaData)) throw new Exception("Image data required for vision mode.");
            }
            elseif ($mode === 'audio') {
                $mediaData = $input->audio ?? null;
                $mimeType = $input->mimeType ?? 'audio/webm';
                if (empty($mediaData)) throw new Exception("Audio data required for audio listening mode.");
            }
            elseif ($mode === 'file_chat') {
                $mediaData = $input->fileData ?? null;
                $mimeType = $input->fileMimeType ?? 'application/pdf';
                if (empty($mediaData)) throw new Exception("File data required for file_chat mode.");
            }

            // 2. Execute Waterfall Strategy
            $result = $this->attemptGeneration($configStr, $system, $user, $format, $mode, $mediaData, $mimeType);
            
            // 3. Return Result
            if ($mode === 'tts' && isset($result['type']) && $result['type'] === 'audio') {
                header('Content-Type: ' . ($result['contentType'] ?? 'audio/mpeg'));
                echo $result['data'];
            } elseif ($mode === 'image_generate' && isset($result['type']) && $result['type'] === 'image') {
                echo json_encode($result);
            } else {
                echo json_encode($result);
            }

        } catch (Exception $e) {
            $code = ($e->getMessage() === 'QUOTA_EXCEEDED') ? 429 : 500;
            if (strpos($e->getMessage(), 'disabled') !== false) $code = 403;
            if (strpos($e->getMessage(), 'only supported') !== false) $code = 400;
            $this->sendError($code, $e->getMessage());
        }
    }

    public function sendError($code, $msg) {
        http_response_code($code);
        echo json_encode(['error' => ['message' => $msg]]);
        exit;
    }
}

$service = new AIService();
$service->processRequest($input);
?>
