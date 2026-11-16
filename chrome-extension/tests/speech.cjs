const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../speech.js'), 'utf8');
assert.equal(source, fs.readFileSync(require('node:path').join(__dirname, '../../clients/php/speech.js'), 'utf8'));
function setup(supported = true) {
  const element = () => ({ disabled: false, textContent: '', addEventListener(name, fn) { this[name] = fn; } });
  let current, submitted = 0, canceled = 0;
  class Recognition { constructor() { current = this; } start() { this.onstart(); } abort() { canceled++; this.onend(); } }
  const controls = { input: { value: '', maxLength: 5000, dispatchEvent() {} },
    translate: () => submitted++, microphone: element(), stop: element(), status: element() };
  const context = vm.createContext({ window: { SpeechRecognition: supported ? Recognition : undefined,
    addEventListener() {} }, Event: class {} });
  vm.runInContext(source, context);
  context.controls = controls;
  vm.runInContext('createSpeechControls(controls)', context);
  return { controls, current: () => current, submitted: () => submitted, canceled: () => canceled };
}
const t = setup();
t.controls.microphone.click(); assert.equal(t.current().lang, 'en-US');
t.current().onresult({ results: [[{ transcript: 'Hello' }]] }); t.current().onend();
assert.equal(t.controls.input.value, 'Hello'); assert.equal(t.submitted(), 1);
t.controls.microphone.click(); const old = t.current(); t.controls.stop.click(); old.onresult({ results: [[{ transcript: 'stale' }]] }); old.onend();
assert.equal(t.submitted(), 1);
assert.equal(t.canceled(), 1); assert.equal(t.controls.status.textContent, 'Stopped.');
t.controls.microphone.click(); t.current().onend(); assert.match(t.controls.status.textContent, /No English/);
t.controls.microphone.click(); t.current().onerror({ error: 'not-allowed' }); t.current().onend(); assert.match(t.controls.status.textContent, /not-allowed/);
assert.equal(setup(false).controls.microphone.disabled, true);
t.controls.microphone.click();
t.current().onresult({ results: [[{ transcript: 'x'.repeat(5001) }]] }); t.current().onend();
assert.match(t.controls.status.textContent, /too long/); assert.equal(t.submitted(), 1);
console.log('PASS: shared English recognition, transcription, cancellation, stale events, empty input, permissions, unsupported recognition, length validation.');
