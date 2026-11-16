function createSpeechControls({ input, translate, microphone, stop, status }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  const say = message => { status.textContent = message; };
  function cancel() {
    if (recognition) { const old = recognition; recognition = null; old.abort(); }
    microphone.disabled = !Recognition; say('Stopped.');
  }
  microphone.disabled = !Recognition;
  if (!Recognition) say('Speech recognition unavailable. Type English instead.');
  microphone.addEventListener('click', () => {
    cancel(); if (!Recognition) return;
    const current = new Recognition(); recognition = current;
    current.lang = 'en-US'; current.interimResults = false; current.continuous = false;
    microphone.disabled = true;
    let transcript = '', failed = false;
    current.onstart = () => { if (recognition === current) say('Listening in English? Select Stop to cancel.'); };
    current.onresult = e => { if (recognition === current) transcript = Array.from(e.results).map(r => r[0].transcript).join(' ').trim(); };
    current.onerror = e => { if (recognition === current) { failed = true; say(`Microphone error (${e.error}). Check permission and connection, or type English.`); } };
    current.onend = () => {
      if (recognition !== current) return;
      recognition = null; microphone.disabled = false;
      if (failed) return;
      if (!transcript) return say('No English speech recognized. Try again.');
      if (input.maxLength > 0 && transcript.length > input.maxLength) return say('Speech is too long. Use a shorter phrase.');
      input.value = transcript; input.dispatchEvent(new Event('input', { bubbles: true }));
      say('English recognized. Translating?'); translate();
    };
    try { current.start(); } catch { cancel(); say('Cannot start microphone. Check permissions; use HTTPS or localhost.'); }
  });
  stop.addEventListener('click', cancel);
  window.addEventListener('pagehide', cancel);
  return { cancel };
}
