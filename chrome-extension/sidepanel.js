const ENDPOINT = "http://192.168.1.4:8080/DarijaTranslator/api/translator/translate";
const byId = (id) => document.getElementById(id);
const english = byId("english");
const result = byId("result");
const error = byId("error");
const credentialsForm = byId("credentials");
let credentials = null;
let activeRequest = null;
let lastSelectionId = null;
const speech = createSpeechControls({ input: english,
  microphone: byId('microphone'), stop: byId('stop-speech'), status: byId('speech-status'),
  translate: () => { void translate(); } });

byId('microphone').addEventListener('click', () => cancelTranslation());

function showError(message) {
  error.textContent = message;
  error.hidden = !message;
}

function cancelTranslation() {
  activeRequest?.abort();
  activeRequest = null;
  byId("loading").hidden = true;
  byId("translate").disabled = false;
}

function requestCredentials() {
  credentialsForm.hidden = false;
  byId("username").focus();
  showError("Enter your WildFly application credentials to translate.");
}

function basicAuthorization() {
  const bytes = new TextEncoder().encode(`${credentials.username}:${credentials.password}`);
  return `Basic ${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))}`;
}

async function translate() {
  speech.cancel();
  cancelTranslation();
  showError("");
  result.textContent = "";
  byId("copy").disabled = true;
  byId("copy-status").textContent = "";
  const text = english.value.trim();
  if (!text) return showError("Enter English text to translate.");
  if (!credentials) return requestCredentials();

  const controller = new AbortController();
  activeRequest = controller;
  // Backend may make three 60-second attempts plus backoff.
  const timeout = setTimeout(() => controller.abort(), 200000);
  byId("loading").hidden = false;
  byId("translate").disabled = true;
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8", Authorization: basicAuthorization() },
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({ text })
    });
    if (activeRequest !== controller) return;
    if (!response.ok) {
      const messages = {
        400: "The server rejected the text. Check your input and try again.",
        401: "Authentication failed. Re-enter your application username and password.",
        403: "Access denied. Your application account needs the translator-user role.",
        502: "Gemini could not complete the translation. Try again shortly.",
        503: "Translation is temporarily unavailable. Try again shortly.",
        504: "The translation service timed out. Try again."
      };
      if (response.status === 401) {
        credentials = null;
        credentialsForm.hidden = false;
        byId("password").focus();
      }
      throw new Error(messages[response.status] || `Translation failed (HTTP ${response.status}).`);
    }
    let data;
    try { data = await response.json(); }
    catch { throw new Error("The server returned malformed JSON."); }
    if (!data || typeof data.translation !== "string" || !data.translation.trim()) {
      throw new Error("The server response does not contain a valid translation.");
    }
    if (activeRequest !== controller) return;
    result.textContent = data.translation;
    byId("copy").disabled = false;
  } catch (failure) {
    if (activeRequest !== controller) return;
    showError(failure.name === "AbortError" ? "The request timed out. Try again."
      : failure instanceof TypeError ? `Cannot reach WildFly. Check the configured backend at ${new URL(ENDPOINT).origin}.`
        : failure.message);
  } finally {
    clearTimeout(timeout);
    if (activeRequest === controller) cancelTranslation();
  }
}

credentialsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = byId("username").value.trim();
  if (username.includes(":")) return showError("A Basic Authentication username cannot contain a colon.");
  credentials = { username, password: byId("password").value };
  byId("password").value = "";
  credentialsForm.hidden = true;
  byId("change-account").hidden = false;
  void translate();
});

byId("change-account").addEventListener("click", () => {
  speech.cancel();
  cancelTranslation();
  credentials = null;
  byId("change-account").hidden = true;
  requestCredentials();
});

byId("translation-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void translate();
});

english.addEventListener("input", () => {
  speech.cancel();
  cancelTranslation();
  result.textContent = "";
  byId("copy").disabled = true;
  byId("copy-status").textContent = "";
});

byId("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(result.textContent);
    byId("copy-status").textContent = "Translation copied.";
  } catch {
    showError("Could not copy. Select the translation and copy it manually.");
  }
});

function applySelection(selection) {
  if (!selection || typeof selection.text !== "string" || selection.id === lastSelectionId) return;
  lastSelectionId = selection.id;
  english.value = selection.text;
  void translate();
}

async function initializeSelection() {
  const currentWindow = await chrome.windows.getCurrent();
  const key = `selection-${currentWindow.id}`;
  let receivedChange = false;
  // Subscribe before reading so a selection cannot be lost while the panel loads.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && changes[key]?.newValue) {
      receivedChange = true;
      applySelection(changes[key].newValue);
    }
  });
  const stored = await chrome.storage.session.get(key);
  if (!receivedChange) applySelection(stored[key]);
}

void initializeSelection().catch(() => showError("Could not load selected text. Enter it manually."));
