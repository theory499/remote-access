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

function parseWebConfig(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return { error: 'Paste the config object first.' };
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { error: 'That is not valid JSON. Make sure quotes are doubled (use double quotes) and there is no leading "const firebaseConfig =".' };
  }
  if (parsed && typeof parsed === 'object' && parsed.firebaseConfig) parsed = parsed.firebaseConfig;
  return { config: parsed };
}

function readAndroidForm() {
  return {
    apiKey: document.getElementById('androidApiKey').value,
    applicationId: document.getElementById('androidApplicationId').value,
    projectId: document.getElementById('androidProjectId').value,
    databaseURL: document.getElementById('androidDatabaseUrl').value
  };
}

function readIosForm() {
  return {
    apiKey: document.getElementById('iosApiKey').value,
    googleAppId: document.getElementById('iosGoogleAppId').value,
    projectId: document.getElementById('iosProjectId').value,
    databaseURL: document.getElementById('iosDatabaseUrl').value,
    bundleId: document.getElementById('iosBundleId').value
  };
}

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
    const parsed = parseWebConfig(raw);
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

  if (action === 'next-android') {
    const skip = document.getElementById('androidSkip').checked;
    if (skip) {
      state.android = null;
      showStep(4);
      return;
    }
    const result = await window.api.validateAndroidConfig(readAndroidForm());
    if (!result.ok) {
      setInlineHint('androidHint', 'All four fields are required, or check "Skip Android".', 'error');
      return;
    }
    state.android = result.value;
    setInlineHint('androidHint', 'Looks good.', 'ok');
    showStep(4);
    return;
  }

  if (action === 'next-ios') {
    const skip = document.getElementById('iosSkip').checked;
    if (skip) {
      state.ios = null;
    } else {
      const result = await window.api.validateIosConfig(readIosForm());
      if (!result.ok) {
        setInlineHint('iosHint', 'All five fields are required, or check "Skip iOS".', 'error');
        return;
      }
      state.ios = result.value;
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
