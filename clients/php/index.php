<?php
declare(strict_types=1);

header('Content-Type: text/html; charset=UTF-8');

$translation = '';
$error = '';
$text = isset($_POST['text']) && is_string($_POST['text']) ? $_POST['text'] : '';
$username = isset($_POST['username']) && is_string($_POST['username']) ? trim($_POST['username']) : '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Password is used only for this server-side request, never rendered into HTML.
    $password = isset($_POST['password']) && is_string($_POST['password']) ? $_POST['password'] : '';

    if (trim($text) === '' || $username === '' || $password === '') {
        $error = 'Please enter some text and your WildFly credentials.';
    } elseif (preg_match_all('/./us', $text) > 5000) {
        $error = 'Please keep your text under 5,000 characters.';
    } else {
        $url = 'http://192.168.1.4:8080/DarijaTranslator/api/translator/translate';
        $payload = json_encode(['text' => $text], JSON_UNESCAPED_UNICODE);

        if ($payload === false) {
            $error = 'Unable to prepare the request.';
        } else {
            $context = stream_context_create([
                'http' => [
                    'method' => 'POST',
                    'header' => [
                        'Content-Type: application/json; charset=UTF-8',
                        'Accept: application/json',
                        'Authorization: Basic ' . base64_encode($username . ':' . $password),
                    ],
                    'content' => $payload,
                    'timeout' => 180,
                    'ignore_errors' => true,
                ],
            ]);

            $response = @file_get_contents($url, false, $context);
            $status = 0;
            if (isset($http_response_header[0]) &&
                preg_match('/HTTP\/\S+\s+(\d{3})/', $http_response_header[0], $matches)) {
                $status = (int) $matches[1];
            }

            if ($response === false) {
                $error = 'Unable to reach WildFly. Check that the Java server is running.';
            } elseif ($status === 401) {
                $error = 'Invalid WildFly username or password.';
            } elseif ($status === 403) {
                $error = 'Your WildFly account does not have the translator-user role.';
            } elseif ($status === 502 || $status === 503 || $status === 504) {
                $error = 'The translation service is temporarily unavailable. Please try again.';
            } elseif ($status !== 200) {
                $error = 'Translation failed (HTTP ' . $status . ').';
            } else {
                $result = json_decode($response, true);
                if (is_array($result) && isset($result['translation']) &&
                    is_string($result['translation']) && trim($result['translation']) !== '') {
                    $translation = $result['translation'];
                } else {
                    $error = 'The server returned an invalid translation response.';
                }
            }
        }
    }
}

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#0f172a">
    <title>Darija Translator · English to Moroccan Arabic</title>
    <style>
        :root {
            color-scheme: light;
            --ink: #101a32;
            --muted: #69748b;
            --line: #e7eaf1;
            --blue: #315df5;
            --blue-hover: #254bd0;
            --bg: #f6f8fc;
        }
        .speech-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
        button:disabled { opacity: .5; cursor: default; }
        #speech-status { font-size: 13px; line-height: 1.5; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
            color: var(--ink);
            background: radial-gradient(circle at 85% 1%, #e8edff 0, transparent 30%), var(--bg);
        }
        .topbar {
            background: #101a32;
            color: #fff;
            padding: 17px 24px;
        }
        .topbar-inner {
            max-width: 1110px;
            margin: auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }
        .brand { display: flex; gap: 12px; align-items: center; font-weight: 800; letter-spacing: -.5px; }
        .brand-icon {
            width: 36px; height: 36px;
            display: grid; place-items: center;
            border-radius: 11px;
            background: #5575ff;
            color: white;
            font-size: 22px;
        }
        .top-tag { color: #bfc9e3; font-size: 12px; font-weight: 600; }
        main { max-width: 1110px; margin: 0 auto; padding: 55px 24px 36px; }
        .eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 12px;
            border: 1px solid #d9e1ff;
            background: #edf1ff;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 750;
            color: #3455b3;
        }
        .eyebrow-dot { width: 7px; height: 7px; background: #4e71ff; border-radius: 50%; }
        h1 { margin: 17px 0 10px; font-size: clamp(30px, 4.5vw, 46px); letter-spacing: -1.8px; line-height: 1.16; }
        .hero-accent { color: var(--blue); }
        .lead { margin: 0 0 30px; color: var(--muted); font-size: 15px; line-height: 1.7; }
        .workspace {
            background: white;
            border: 1px solid var(--line);
            border-radius: 22px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(21, 34, 72, .07);
            display: grid;
            grid-template-columns: 1fr 1fr;
        }
        .pane { min-width: 0; padding: 28px; }
        .pane + .pane { border-left: 1px solid var(--line); background: #fcfdff; }
        .pane-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
        .pane-title { font-size: 15px; font-weight: 800; margin: 0; }
        .lang-chip {
            padding: 6px 10px;
            background: #f1f4fa;
            border: 1px solid var(--line);
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            color: #55627b;
        }
        label { display: block; font-size: 12px; font-weight: 750; margin: 0 0 8px; color: #45516a; }
        textarea, input {
            display: block;
            width: 100%;
            border: 1px solid #dae0eb;
            border-radius: 12px;
            background: #fff;
            color: var(--ink);
            font: inherit;
            font-size: 14px;
            outline: none;
            transition: border-color .15s, box-shadow .15s;
        }
        textarea:focus, input:focus { border-color: #6787ff; box-shadow: 0 0 0 4px #eef2ff; }
        textarea { min-height: 188px; padding: 15px; resize: vertical; line-height: 1.6; }
        textarea::placeholder, input::placeholder { color: #98a3b6; }
        input { height: 44px; padding: 0 13px; }
        .input-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin: 10px 0 24px; }
        .muted { color: #8993a7; font-size: 12px; }
        .text-button {
            font: inherit; font-size: 12px; font-weight: 750;
            border: none; color: var(--blue); background: transparent;
            cursor: pointer; padding: 5px 0;
        }
        .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; }
        .security-note { display: flex; gap: 7px; align-items: center; font-size: 12px; color: #79849b; margin: 13px 0 22px; }
        .actions { display: flex; gap: 12px; }
        button { cursor: pointer; font: inherit; }
        .primary {
            flex: 1; min-height: 48px; border: none; border-radius: 12px;
            color: white; background: var(--blue); font-size: 14px; font-weight: 800;
            box-shadow: 0 7px 18px rgba(49, 93, 245, .2);
        }
        .primary:hover { background: var(--blue-hover); }
        .secondary {
            min-height: 48px; padding: 0 18px; border: 1px solid #dfe4ee;
            border-radius: 12px; background: white; color: #58637b; font-weight: 750;
        }
        .secondary:hover { background: #f6f8fc; }
        .result-box {
            min-height: 320px;
            border: 1px dashed #d9e0ed;
            border-radius: 14px;
            background: linear-gradient(150deg, #fff, #f6f8ff);
            padding: 23px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .result-output {
            font-family: Tahoma, "Segoe UI", Arial, sans-serif;
            font-size: clamp(20px, 2.8vw, 27px);
            line-height: 1.95;
            color: #18264a;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            text-align: right;
        }
        .result-label { color: #6580c7; font-size: 11px; text-transform: uppercase; letter-spacing: 1.3px; font-weight: 850; margin-bottom: 15px; }
        .empty-state { text-align: center; align-items: center; gap: 12px; }
        .empty-icon { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 18px; background: #eaf0ff; color: var(--blue); font-size: 30px; }
        .empty-title { font-weight: 800; font-size: 16px; }
        .empty-desc { color: #8590a3; font-size: 13px; line-height: 1.65; max-width: 230px; }
        .result-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 17px; gap: 8px; min-height: 44px; }
        .success { font-size: 12px; font-weight: 750; color: #237c54; }
        .copy-button { min-height: 38px; padding: 0 14px; }
        .alert {
            margin-top: 16px; padding: 13px 15px; border-radius: 12px;
            background: #fff0ef; border: 1px solid #ffd4ce;
            color: #a12c2c; font-size: 13px; line-height: 1.55;
        }
        .bottom-note { text-align: center; margin-top: 25px; font-size: 12px; color: #8b97ab; line-height: 1.65; }
        @media (max-width: 780px) {
            main { padding: 30px 16px; }
            .workspace { grid-template-columns: 1fr; }
            .pane { padding: 22px; }
            .pane + .pane { border-left: 0; border-top: 1px solid var(--line); }
            .result-box { min-height: 200px; }
            .fields { grid-template-columns: 1fr; }
            .top-tag { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
            textarea, input { transition: none; }
        }
    </style>
</head>
<body>
<header class="topbar">
    <div class="topbar-inner">
        <div class="brand"><span class="brand-icon" aria-hidden="true">ع</span> DarijaTranslator</div>
        <span class="top-tag">LLM-powered translation · Java REST API</span>
    </div>
</header>

<main>
    <div class="eyebrow"><span class="eyebrow-dot"></span> English → Moroccan Darija</div>
    <h1>Translate naturally.<br><span class="hero-accent">Speak locally.</span></h1>
    <p class="lead">Turn everyday English into Moroccan Darija, powered by your secure Java REST service and Gemini.</p>

    <div class="workspace">
        <section class="pane" aria-labelledby="source-title">
            <div class="pane-head">
                <h2 class="pane-title" id="source-title">Your text</h2>
                <span class="lang-chip">English</span>
            </div>
            <form id="translator-form" method="post" autocomplete="off">
                <label for="source-text">What would you like to translate?</label>
                <textarea id="source-text" name="text" maxlength="5000" required placeholder="Type something in English..."><?= e($text) ?></textarea>
                <div class="input-footer">
                    <button class="text-button" id="example-button" type="button">Try an example</button>
                    <span class="muted" id="char-count">0 / 5000</span>
                </div>

                <div class="fields">
                    <div>
                        <label for="username">WildFly username</label>
                        <input type="text" id="username" name="username" required
                               value="<?= e($username) ?>" placeholder="Application username" autocomplete="off">
                    </div>
                    <div>
                        <label for="password">WildFly password</label>
                        <input type="password" id="password" name="password" required
                               placeholder="Your password" autocomplete="off">
                    </div>
                </div>
                <p class="security-note">♧ &nbsp;Your password is used for this request and is not displayed or stored by this page.</p>
                <div class="actions">
                    <button class="primary" type="submit">Translate to Darija &nbsp; →</button>
                    <button class="secondary" type="button" id="clear-button">Clear</button>
                </div>
            </form>
            <div class="speech-actions" role="group" aria-label="Speech controls">
<button type="button" class="secondary" id="microphone" aria-label="Translate English speech">Microphone</button>
<button type="button" class="secondary" id="stop-speech" aria-label="Stop listening">Stop</button>
</div><p id="speech-status" role="status" aria-live="polite"></p>
            <?php if ($error !== ''): ?>
                <div class="alert" role="alert"><?= e($error) ?></div>
            <?php endif; ?>
        </section>

        <section class="pane" aria-labelledby="result-title">
            <div class="pane-head">
                <h2 class="pane-title" id="result-title">Your translation</h2>
                <span class="lang-chip">الدارجة المغربية</span>
            </div>
            <?php if ($translation !== ''): ?>
                <div class="result-box">
                    <div class="result-label">Translated into Darija</div>
                    <div class="result-output" id="translation-text" dir="rtl" lang="ar"><?= e($translation) ?></div>
                </div>
                <div class="result-footer">
                    <span class="success">✓ Translation ready</span>
                    <button type="button" class="secondary copy-button" id="copy-button">Copy translation</button>
                </div>
            <?php else: ?>
                <div class="result-box empty-state">
                    <div class="empty-icon" aria-hidden="true">ع</div>
                    <div class="empty-title">Your translation appears here</div>
                    <div class="empty-desc">Enter English text, then select Translate to see it in Moroccan Darija.</div>
                </div>
                <div class="result-footer"><span class="muted">Ready whenever you are.</span></div>
            <?php endif; ?>
        </section>
    </div>
</main>
<script src="speech.js"></script>
<script>
(() => {
    const input = document.getElementById('source-text');
    const form = document.getElementById('translator-form');
    const speech = createSpeechControls({ input,
      microphone: document.getElementById('microphone'),
      stop: document.getElementById('stop-speech'), status: document.getElementById('speech-status'),
      translate: () => {
        if (form.reportValidity()) form.requestSubmit();
        else document.getElementById('speech-status').textContent = 'English recognized. Enter credentials, then Translate.';
      } });
    form.addEventListener('submit', () => speech.cancel());
    document.getElementById('clear-button').addEventListener('click', () => speech.cancel());
    const count = document.getElementById('char-count');
    const updateCount = () => { count.textContent = `${input.value.length} / 5000`; };
    input.addEventListener('input', updateCount);
    updateCount();

    document.getElementById('example-button').addEventListener('click', () => {
        input.value = 'Hello, my name is Kenza. How are you today?';
        updateCount();
        input.focus();
    });
    document.getElementById('clear-button').addEventListener('click', () => {
        input.value = '';
        updateCount();
        input.focus();
        document.getElementById('password').value = '';
    });

    const copy = document.getElementById('copy-button');
    if (copy) {
        copy.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(document.getElementById('translation-text').textContent);
                const oldText = copy.textContent;
                copy.textContent = 'Copied ✓';
                setTimeout(() => { copy.textContent = oldText; }, 1700);
            } catch {
                copy.textContent = 'Copy unavailable';
            }
        });
    }
})();
</script>
</body>
</html>
