const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("manifest.json"));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ["sidePanel", "contextMenus", "storage"]);
for (const file of [manifest.background.service_worker, manifest.side_panel.default_path,
  ...Array.from(read("sidepanel.html").matchAll(/(?:src|href)="([^"]+)"/g), (m) => m[1])]) {
  assert.ok(fs.existsSync(path.join(root, file)), `Missing reference: ${file}`);
}
for (const file of ["service-worker.js", "sidepanel.js"]) new vm.Script(read(file));

const elements = Object.fromEntries(Array.from(read("sidepanel.html").matchAll(/id="([^"]+)"/g), (m) =>
  [m[1], { value: "", textContent: "", hidden: false, disabled: false, handlers: {},
    addEventListener(type, handler) { this.handlers[type] = handler; }, focus() {} }]));
let storageListener;
let response = { ok: true, json: async () => ({ translation: "سلام" }) };
const requests = [];
const context = vm.createContext({
  createSpeechControls: () => ({ cancel() {} }),
  document: { getElementById: (id) => elements[id] },
  chrome: {
    windows: { getCurrent: async () => ({ id: 1 }) },
    storage: {
      onChanged: { addListener: (listener) => { storageListener = listener; } },
      session: { get: async () => ({ "selection-1": { id: "initial", text: "Hello" } }) }
    }
  },
  fetch: async (url, options) => { requests.push({ url, options }); return response; },
  navigator: { clipboard: { writeText: async () => {} } },
  TextEncoder, AbortController, TypeError, URL, setTimeout, clearTimeout,
  btoa: (value) => Buffer.from(value, "binary").toString("base64")
});
const tick = () => new Promise((resolve) => setImmediate(resolve));
const event = { preventDefault() {} };
const submitCredentials = async () => {
  elements.username.value = "student";
  elements.password.value = "test-only-password";
  elements.credentials.handlers.submit(event);
  await tick();
};

(async () => {
  vm.runInContext(read("sidepanel.js"), context);
  const endpoint = vm.runInContext("ENDPOINT", context);
  const backend = new URL(endpoint);
  assert.ok(["http:", "https:"].includes(backend.protocol));
  assert.equal(backend.username, "");
  assert.equal(backend.password, "");
  assert.equal(backend.pathname, "/DarijaTranslator/api/translator/translate");
  const requiredHosts = new Set(["http://localhost/*", `${backend.protocol}//${backend.hostname}/*`]);
  assert.ok(Array.isArray(manifest.host_permissions), "Host permissions must be an array");
  for (const host of requiredHosts) {
    assert.ok(manifest.host_permissions.includes(host), `Missing required host permission: ${host}`);
  }
  for (const host of manifest.host_permissions) {
    assert.ok(requiredHosts.has(host), `Unexpected or overly broad host permission: ${host}`);
  }
  await tick();
  assert.equal(elements.english.value, "Hello");
  assert.equal(requests.length, 0, "Must request credentials before fetching");
  await submitCredentials();
  assert.equal(elements.result.textContent, "سلام");
  assert.equal(elements.password.value, "");
  const request = requests[0];
  assert.equal(request.url, endpoint);
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.credentials, "omit");
  assert.equal(JSON.parse(request.options.body).text, "Hello");
  assert.equal(request.options.headers.Authorization,
    `Basic ${Buffer.from("student:test-only-password").toString("base64")}`);
  storageListener({ "selection-1": { newValue: { id: "next", text: "Good morning" } } }, "session");
  await tick();
  assert.equal(JSON.parse(requests.at(-1).options.body).text, "Good morning");
  const count = requests.length;
  storageListener({ "selection-1": { newValue: { id: "next", text: "Good morning" } } }, "session");
  await tick();
  assert.equal(requests.length, count, "Duplicate selection must not translate twice");

  for (const status of [400, 403, 502, 503, 504, 401]) {
    response = { ok: false, status };
    await vm.runInContext("translate()", context);
    assert.equal(elements.error.hidden, false, `HTTP ${status} needs an error`);
    assert.equal(elements.result.textContent, "");
    assert.equal(elements.loading.hidden, true);
  }
  assert.equal(elements.credentials.hidden, false);
  assert.equal(vm.runInContext("credentials", context), null);

  for (const json of [async () => { throw new SyntaxError(); }, async () => ({}),
    async () => ({ translation: "" })]) {
    response = { ok: true, json };
    await submitCredentials();
    assert.match(elements.error.textContent, /malformed|valid translation/);
  }
  response = { ok: true, json: async () => { throw new TypeError("network"); } };
  // Simulate a transport failure independently of JSON parsing.
  context.fetch = async () => { throw new TypeError("offline"); };
  await vm.runInContext("translate()", context);
  assert.match(elements.error.textContent, /Cannot reach WildFly/);
  assert.ok(elements.error.textContent.includes(backend.origin), "Network error must identify the configured backend");

  let release;
  context.fetch = () => new Promise((resolve) => { release = resolve; });
  const pending = vm.runInContext("translate()", context);
  elements.english.value = "Edited while loading";
  elements.english.handlers.input();
  release({ ok: true, json: async () => ({ translation: "stale" }) });
  await pending;
  assert.equal(elements.result.textContent, "", "Stale requests must not replace edited text");
  console.log("PASS: manifest, references, syntax, selection transfer, Basic auth, HTTP errors, malformed responses, network failure, stale responses.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
