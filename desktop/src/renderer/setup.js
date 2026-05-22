const state = {
  step: 1,
  backend: 'firebase',
  web: null,
  android: null,
  ios: null
};

const stepperItems = Array.from(document.querySelectorAll('#stepper li'));
const stepSections = Array.from(document.querySelectorAll('section.step'));
const globalError = document.getElementById('globalError');

function showStep(n) {
  state.step = n;
  stepperItems.forEach((el, idx) => {
    el.classList.toggle('active', idx + 1 === n);
    el.classList.toggle('done', idx + 1 < n);
  });
  stepSections.forEach((section) => {
    section.classList.toggle('hidden', Number(section.dataset.step) !== n);
  });
  hideError();
}

function showError(message) {
  globalError.textContent = message;
  globalError.classList.remove('hidden');
}

function hideError() {
  globalError.textContent = '';
  globalError.classList.add('hidden');
}

function setInlineHint(id, message, kind = 'info') {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `hint ${kind}`;
}

async function parseWebConfig(raw) {
  return window.api.parseWebConfigPaste(raw);
}

function renderExtractedFields(containerId, fields) {
  const dl = document.getElementById(containerId);
  dl.innerHTML = '';
  for (const [label, value] of fields) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    dl.appendChild(dt);
    dl.appendChild(dd);
  }
}

function summariseAndroid(android) {
  renderExtractedFields('androidFields', [
    ['Project', android.projectId],
    ['Application ID', android.applicationId],
    ['API key', `${android.apiKey.slice(0, 12)}...`],
    ['Database URL', android.databaseURL]
  ]);
}

function summariseIos(ios) {
  renderExtractedFields('iosFields', [
    ['Project', ios.projectId],
    ['Bundle ID', ios.bundleId],
    ['Google app ID', ios.googleAppId],
    ['API key', `${ios.apiKey.slice(0, 12)}...`],
    ['Database URL', ios.databaseURL]
  ]);
}

function showAndroidSummary(fileName) {
  document.getElementById('androidPrompt').classList.add('hidden');
  document.getElementById('androidSummary').classList.remove('hidden');
  document.getElementById('androidFileName').textContent = fileName;
}

function showIosSummary(fileName) {
  document.getElementById('iosPrompt').classList.add('hidden');
  document.getElementById('iosSummary').classList.remove('hidden');
  document.getElementById('iosFileName').textContent = fileName;
}

function resetAndroidSummary() {
  document.getElementById('androidPrompt').classList.remove('hidden');
  document.getElementById('androidSummary').classList.add('hidden');
  state.android = null;
}

function resetIosSummary() {
  document.getElementById('iosPrompt').classList.remove('hidden');
  document.getElementById('iosSummary').classList.add('hidden');
  state.ios = null;
}

async function ingestAndroidFile(file) {
  if (!file) return;
  setInlineHint('androidHint', `Reading ${file.name}...`, 'info');
  let content;
  try { content = await file.text(); } catch (err) {
    setInlineHint('androidHint', `Could not read file: ${err.message}`, 'error');
    return;
  }
  const result = await window.api.parseAndroidFile(content, state.web || null);
  if (result.error) {
    setInlineHint('androidHint', result.error, 'error');
    resetAndroidSummary();
    return;
  }
  state.android = result.android;
  summariseAndroid(result.android);
  showAndroidSummary(file.name);
  setInlineHint('androidHint', 'Parsed and validated.', 'ok');
}

async function ingestIosFile(file) {
  if (!file) return;
  setInlineHint('iosHint', `Reading ${file.name}...`, 'info');
  let content;
  try { content = await file.text(); } catch (err) {
    setInlineHint('iosHint', `Could not read file: ${err.message}`, 'error');
    return;
  }
  const result = await window.api.parseIosFile(content, state.web || null);
  if (result.error) {
    setInlineHint('iosHint', result.error, 'error');
    resetIosSummary();
    return;
  }
  state.ios = result.ios;
  summariseIos(result.ios);
  showIosSummary(file.name);
  setInlineHint('iosHint', 'Parsed and validated.', 'ok');
}

function installDropZone(zoneId, fileInputId, onFile) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(fileInputId);
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) onFile(input.files[0]);
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
}

installDropZone('androidDrop', 'androidFile', ingestAndroidFile);
installDropZone('iosDrop', 'iosFile', ingestIosFile);

document.getElementById('androidSkip').addEventListener('change', (e) => {
  if (e.target.checked) resetAndroidSummary();
});
document.getElementById('iosSkip').addEventListener('change', (e) => {
  if (e.target.checked) resetIosSummary();
});

async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) { return false; }
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'next' && state.step === 1) {
    showStep(2);
    return;
  }

  if (action === 'copy-rules') {
    const res = await window.api.getRules();
    if (res.ok) {
      const ok = await copyToClipboard(res.rules);
      target.textContent = ok ? 'Copied!' : 'Copy failed';
      setTimeout(() => { target.textContent = 'Copy rules'; }, 2000);
    } else {
      showError(`Could not load rules file: ${res.error}`);
    }
    return;
  }

  if (action === 'back') {
    if (state.step > 1) showStep(state.step - 1);
    return;
  }

  if (action === 'probe-web') {
    const raw = document.getElementById('webConfigInput').value;
    const parsed = await parseWebConfig(raw);
    if (parsed.error) {
      setInlineHint('webHint', parsed.error, 'error');
      return;
    }
    setInlineHint('webHint', 'Testing sign-in and database write...', 'info');
    target.disabled = true;
    try {
      const result = await window.api.probeWebConfig(parsed.config);
      if (result.ok) {
        state.web = parsed.config;
        setInlineHint('webHint', `Connection works (signed in as ${result.uid.slice(0, 8)}...)`, 'ok');
        document.getElementById('webNextButton').classList.remove('hidden');
      } else {
        setInlineHint('webHint', `Probe failed at "${result.stage}": ${result.error}`, 'error');
      }
    } catch (err) {
      setInlineHint('webHint', `Unexpected error: ${err.message}`, 'error');
    } finally {
      target.disabled = false;
    }
    return;
  }

  if (action === 'next' && state.step === 2) {
    if (!state.web) {
      setInlineHint('webHint', 'Run "Test connection" first.', 'error');
      return;
    }
    showStep(3);
    return;
  }

  if (action === 'pick-android') {
    document.getElementById('androidFile').click();
    return;
  }

  if (action === 'pick-ios') {
    document.getElementById('iosFile').click();
    return;
  }

  if (action === 'next-android') {
    const skip = document.getElementById('androidSkip').checked;
    if (skip) {
      state.android = null;
      showStep(4);
      return;
    }
    if (!state.android) {
      setInlineHint('androidHint', 'Drop google-services.json or check "Skip Android".', 'error');
      return;
    }
    showStep(4);
    return;
  }

  if (action === 'next-ios') {
    const skip = document.getElementById('iosSkip').checked;
    if (skip) {
      state.ios = null;
    } else if (!state.ios) {
      setInlineHint('iosHint', 'Drop GoogleService-Info.plist or check "Skip iOS".', 'error');
      return;
    }
    if (!state.android && !state.ios) {
      setInlineHint('iosHint', 'You need to configure Android, iOS, or both before you can finish.', 'error');
      return;
    }
    showStep(5);
    await renderQr();
    return;
  }

  if (action === 'finish') {
    const fullConfig = {
      backend: state.backend,
      web: state.web,
      android: state.android,
      ios: state.ios
    };
    const saveResult = await window.api.saveConfig(fullConfig);
    if (!saveResult.ok) {
      showError(`Save failed: ${saveResult.error}`);
      return;
    }
    await window.api.enterSession();
    return;
  }
});

async function renderQr() {
  const fullConfig = {
    backend: state.backend,
    web: state.web,
    android: state.android,
    ios: state.ios
  };
  const result = await window.api.generateQr(fullConfig);
  if (!result.ok) {
    showError(`QR generation failed: ${result.error}`);
    return;
  }
  const img = document.getElementById('qrImage');
  img.src = result.dataUrl;
}

showStep(1);
