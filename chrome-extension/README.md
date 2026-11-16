# Darija Translator Chrome extension

Requires Chrome 116+ and the existing WildFly application. Set `ENDPOINT` in
`sidepanel.js` to the full translation URL, such as
`http://<YOUR_LAN_IP>:8080/DarijaTranslator/api/translator/translate`.
Keep `manifest.json` host permissions aligned with that host and reload the
extension after editing. See the root README for backend setup.

## Load and test

1. Start WildFly with the working Gemini configuration and deploy the backend WAR.
   Create an **ApplicationRealm application user** with group `translator-user`.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**,
   and select this `chrome-extension` folder. Pin its toolbar action if desired.
3. On a normal webpage, select English text, right-click, and choose
   **Translate to Darija**. The panel should open with that text populated.
4. Enter the WildFly application username and password. Submitting should translate
   immediately. Confirm Arabic displays right-to-left, then test **Copy translation**.
5. Select different text with the panel open: it should translate automatically.
   Also close the panel and select again to check the panel-loading path. Click the
   toolbar icon to open the panel without a selection. Edit the field and translate.
6. Use **Change account** to test an incorrect password (401), then an application
   user without `translator-user` (403). Stop WildFly to test the network error.
   Empty text should show a local validation message. Restore the valid account.
7. In side-panel DevTools, inspect Network requests: POST JSON and the Basic
   Authorization header must reach the existing endpoint. Do not share credentials
   or screenshots containing the header. Check extension errors in `chrome://extensions`.

Credentials are held only in the panel's JavaScript memory, never extension storage.
Chrome controls the lifetime of the panel document; a document reload clears them.
Session storage holds only the latest selected text per window, until the window
closes, the extension reloads, or the browser session ends. The clipboard is used
only by the explicit **Copy translation** button, never for selection transfer.

Only `sidePanel`, `contextMenus`, `storage`, and explicit localhost/configured LAN
host access are requested. Do not add all-host or wildcard-subdomain access.
Chrome host match patterns cannot restrict access by port; the current endpoint
uses port 8080. No content scripts or Gemini keys are needed.

## Automated checks

Run `node tests/verify.cjs` and `node tests/speech.cjs` from this folder. This validates the manifest, referenced
files, JavaScript syntax, and panel behavior with mocked Chrome/HTTP APIs, including
selection loading, authentication, errors, and stale-response cancellation.

These checks do not run Chrome, the real clipboard, Elytron, or Gemini. Verify
those integrations manually using the steps above. Real 400/502/503 and malformed
responses require the corresponding server condition; they are covered by mocks.

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
