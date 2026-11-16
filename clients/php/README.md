# PHP client

Serve this folder with PHP (for example `php -S localhost:8000 -t clients/php`
from the project root). Open http://localhost:8000 and enter your WildFly account.
The existing server-side Basic-authenticated REST request and endpoint are unchanged.
The password is never rendered into the response. No browser storage is used.
Microphone recognition fills the English input and submits the same form; the
response is written Darija only.

Check syntax: `php -l clients/php/index.php`; `node --check clients/php/speech.js`.

## Speech

Use Microphone to recognize English (en-US), populate the existing input, and
translate through the existing authenticated endpoint. Enter credentials first.
Stop cancels microphone recognition. Typed translation continues to work without
speech recognition support. There is no Read Aloud, speech synthesis, or automatic
spoken output.

Recognition requires browser support, microphone permission, and usually HTTPS or
localhost. Chrome extension side panels may deny recognition depending on Chrome,
profile and platform policy; if denied, use typed input or the PHP page served on
localhost/HTTPS. No extra extension permissions or audio recording are added.
Browser recognition may send speech to the browser vendor's recognition service;
this client never records/stores raw audio or persists credentials.

Manual checks: translate typed English; speak English with valid credentials;
confirm transcription and written translation. Test Stop during listening, rapid
clicks, denied permission, silence, offline recognition, and an unsupported browser.
Verify keyboard access, status messages, and that translation produces no audio.
