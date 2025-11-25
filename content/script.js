// script.js - Fluxo "Next Page Prompt"

const AUTOFILL_STORAGE_KEY = 'autofillPausedSites';
const AUTO_LOGIN_STORAGE_KEY = 'autoLoginPausedSites';
const PM_ICON_URL = chrome.runtime.getURL('icons/logo.png');
const AUTO_LOGIN_DELAY = 250;

let autoLoginTimeout = null;
let hasTriggeredAutoLogin = false;

// --- INICIALIZAÇÃO ---
(async () => {
  const hostname = window.location.hostname;

  const autofillPaused = await isAutofillPaused(hostname);
  const autoLoginPaused = await isAutoLoginPaused(hostname);


  if (autofillPaused) return;

  injectIconsInFields();
  setupFormDetection();

  // 1. Tenta preenchimento (Autofill)
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_LOGIN', url: window.location.href });
    if (response) {
      fillForm(response, { autoSubmit: !autoLoginPaused });
    }
  } catch (e) {}

  // 2. Verifica se há credenciais PENDENTES de salvamento (vindas da página anterior)
  try {
    const pending = await chrome.runtime.sendMessage({ type: 'CHECK_PENDING_TO_SAVE', url: window.location.href });
    if (pending) {
       // Verifica mais uma vez se já existe (caso o usuário tenha salvo em outra aba)
       const exists = await chrome.runtime.sendMessage({ 
          type: 'CHECK_CREDENTIALS_EXIST', 
          url: pending.url, 
          username: pending.username 
       });

       if (!exists) {
         showSavePrompt(pending.username, pending.password);
       }
    }
  } catch (e) {
    console.log('PM: Erro ao checar pendências');
  }

  // Observer
  const observer = new MutationObserver((mutations) => {
    if (mutations.some(m => m.addedNodes.length > 0)) {
        injectIconsInFields();
        setupFormDetection();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();


// --- UI: POPUP DE SALVAMENTO (SHADOW DOM) ---
function showSavePrompt(username, password) {
  const existing = document.getElementById('pm-shadow-host');
  if (existing) existing.remove();

  const host = document.createElement('div');
  host.id = 'pm-shadow-host';
  host.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 2147483647;'; 
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = `
    <style>
      .pm-card {
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        font-family: sans-serif;
        width: 300px;
        padding: 16px;
        color: #333;
        border: 1px solid #e0e0e0;
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      .pm-header { display: flex; align-items: center; margin-bottom: 10px; }
      .pm-logo { width: 24px; height: 24px; margin-right: 10px; }
      .pm-title { font-weight: 600; font-size: 16px; margin: 0; color: #1a73e8; }
      .pm-text { font-size: 14px; margin-bottom: 15px; color: #5f6368; }
      .pm-user { font-weight: bold; color: #202124; }
      .pm-actions { display: flex; justify-content: flex-end; gap: 10px; }
      button { border: none; padding: 8px 16px; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer; }
      .btn-cancel { background: transparent; color: #5f6368; }
      .btn-cancel:hover { background: #f1f3f4; }
      .btn-save { background: #1a73e8; color: white; }
      .btn-save:hover { background: #1557b0; }
    </style>
  `;

  shadow.innerHTML = `
    ${style}
    <div class="pm-card">
      <div class="pm-header">
        <img src="${PM_ICON_URL}" class="pm-logo" />
        <h3 class="pm-title">Salvar Senha?</h3>
      </div>
      <p class="pm-text">Deseja salvar o login de <span class="pm-user">${username}</span>?</p>
      <div class="pm-actions">
        <button id="btn-cancel" class="btn-cancel">Não</button>
        <button id="btn-save" class="btn-save">Salvar</button>
      </div>
    </div>
  `;

  shadow.getElementById('btn-save').addEventListener('click', () => {
    chrome.runtime.sendMessage({ 
      type: 'SAVE_CREDENTIALS', 
      url: window.location.href, 
      username: username, 
      password: password 
    });
    host.remove();
  });

  shadow.getElementById('btn-cancel').addEventListener('click', () => host.remove());
  setTimeout(() => { if (document.body.contains(host)) host.remove(); }, 15000); // 15s para dar tempo
}


// --- UI: INPUT ICONS ---
function wrapInputAndInjectIcon(input) {
  if (input.dataset.pmWrapped) return;
  const parent = input.parentElement;
  if (!parent) return;
  
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:relative; display:${window.getComputedStyle(input).display}; width:${input.offsetWidth}px;`;
  
  input.dataset.pmWrapped = 'true';
  parent.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const icon = document.createElement('img');
  icon.src = PM_ICON_URL;
  icon.style.cssText = 'position:absolute; width:20px; height:20px; top:50%; right:8px; transform:translateY(-50%); z-index:1000; cursor:pointer;';
  icon.title = "Preencher senha";
  wrapper.appendChild(icon);

  icon.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const response = await chrome.runtime.sendMessage({ type: 'GET_LOGIN', url: window.location.href });
    response ? fillForm(response) : alert("Nenhuma senha salva.");
  });
}

function injectIconsInFields() {
  const selectors = ['input[type="password"]', 'input[name*="user"]', 'input[name*="login"]'];
  document.querySelectorAll(selectors.join(',')).forEach(input => {
    if (input.dataset.pmWrapped || input.type === 'hidden' || !input.offsetParent) return;
    if (input.type === 'password' || input.name.includes('user') || input.name.includes('login')) {
        wrapInputAndInjectIcon(input);
    }
  });
}

// --- PREENCHIMENTO ---
function fillForm(credentials = {}, options = {}) {
  const { autoSubmit = false } = options;
  const { username = '', password = '' } = credentials;
  let passInput = document.querySelector('input[type="password"]');
  let userInput = document.querySelector('input[autocomplete="username"], input[name*="user"], input[name*="login"]');

  if (passInput && passInput.form && !userInput) {
      const inputs = Array.from(passInput.form.querySelectorAll('input:not([type="hidden"])'));
      const idx = inputs.indexOf(passInput);
      if (idx > 0) userInput = inputs[idx - 1];
  } else if (passInput && !userInput) {
      const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"])'));
      const idx = allInputs.indexOf(passInput);
      if (idx > 0) userInput = allInputs[idx - 1];
  }

  if (passInput && password) { passInput.value = password; triggerEvents(passInput); }
  if (userInput && username) { userInput.value = username; triggerEvents(userInput); }

  const targetForm = findLoginForm(passInput, userInput);
  const hasDataToSubmit = Boolean(password || username);
  const hasTargetFields = Boolean(passInput || userInput);

  if (autoSubmit && hasDataToSubmit && hasTargetFields) {
    scheduleAutoLogin({ form: targetForm, passwordInput: passInput, usernameInput: userInput });
  }
}

function triggerEvents(el) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

function findLoginForm(passInput, userInput) {
  if (passInput?.form) return passInput.form;
  if (userInput?.form) return userInput.form;
  if (passInput) {
    const closest = passInput.closest('form');
    if (closest) return closest;
  }
  if (userInput) {
    const closest = userInput.closest('form');
    if (closest) return closest;
  }
  const explicitForm = document.querySelector('form[action*="login" i], form[action*="signin" i], form[action*="entrar" i], form');
  return explicitForm || null;
}

function scheduleAutoLogin(context) {
  if (hasTriggeredAutoLogin) return;
  hasTriggeredAutoLogin = true;
  if (autoLoginTimeout) clearTimeout(autoLoginTimeout);
  autoLoginTimeout = setTimeout(() => {
    autoLoginTimeout = null;
    autoLogin(context);
  }, AUTO_LOGIN_DELAY);
}

function autoLogin({ form, passwordInput, usernameInput }) {
  const targetForm = form || passwordInput?.form || usernameInput?.form || passwordInput?.closest('form') || usernameInput?.closest('form');
  if (targetForm) {
    if (typeof targetForm.requestSubmit === 'function') {
      targetForm.requestSubmit();
      return;
    }
    if (typeof targetForm.submit === 'function') {
      targetForm.submit();
      return;
    }
    targetForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return;
  }

  const submitButton = findSubmitButton();
  if (submitButton) {
    submitButton.click();
  }
}

function findSubmitButton() {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[data-action*="login"]',
    'button[data-testid*="login"]',
    'button[name*="login"]',
    'button[id*="login"]'
  ];
  const primary = document.querySelector(selectors.join(','));
  if (primary) return primary;

  return Array.from(document.querySelectorAll('button, input[type="button"], div[role="button"]')).find((el) => {
    const label = (el.textContent || el.value || '').toLowerCase();
    return /entrar|acessar|login|sign in|continuar/.test(label);
  }) || null;
}

// --- DETECÇÃO DE LOGIN (ATUALIZADA) ---
function setupFormDetection() {
  document.querySelectorAll('form').forEach(form => {
    if (form.dataset.pmListener) return;
    form.dataset.pmListener = 'true';
    form.addEventListener('submit', handleSubmissionAttempt, true);
    
    form.querySelectorAll('button, input[type="submit"], input[type="button"]').forEach(btn => {
        btn.addEventListener('click', handleSubmissionAttempt);
    });
  });

  document.querySelectorAll('input[type="password"]').forEach(input => {
      if(input.dataset.pmEnterListener) return;
      input.dataset.pmEnterListener = 'true';
      input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') handleSubmissionAttempt(e);
      });
  });
}

async function handleSubmissionAttempt(event) {
  // Executa imediatamente para garantir captura antes do unload
  let target = event.target;
  let form = target.form || target.closest('form');
  let user, pass;

  if (form) {
    const creds = findCredentialsFromForm(form);
    user = creds.username;
    pass = creds.password;
  } else {
    const passInput = document.querySelector('input[type="password"]');
    if (passInput) {
      pass = passInput.value;
      const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"])'));
      const idx = allInputs.indexOf(passInput);
      if (idx > 0) user = allInputs[idx-1].value;
    }
  }

  if (!user || !pass) return;

  // Verifica se já existe
  const exists = await chrome.runtime.sendMessage({ 
    type: 'CHECK_CREDENTIALS_EXIST', 
    url: window.location.href, 
    username: user 
  });

  if (!exists) {
    // NÃO exibe popup aqui. Manda para o background guardar ("Cache")
    // e espera a próxima página carregar para perguntar.
    chrome.runtime.sendMessage({
      type: 'CACHE_TEMP_CREDENTIALS',
      url: window.location.href,
      username: user,
      password: pass
    });
  }
}

function findCredentialsFromForm(form) {
  const passInput = form.querySelector('input[type="password"]');
  if (!passInput) return { username: '', password: '' };
  let userInput = form.querySelector('input[autocomplete="username"], input[name*="user"], input[name*="login"], input[type="email"]');
  if (!userInput) {
    const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"])'));
    const idx = inputs.indexOf(passInput);
    if (idx > 0) userInput = inputs[idx - 1];
  }
  return { username: userInput ? userInput.value : '', password: passInput.value };
}

async function isAutofillPaused(domain) {
  return isFeaturePaused(domain, AUTOFILL_STORAGE_KEY);
}

async function isAutoLoginPaused(domain) {
  return isFeaturePaused(domain, AUTO_LOGIN_STORAGE_KEY);
}

async function isFeaturePaused(domain, storageKey) {
  try {
    const data = await chrome.storage.local.get([storageKey]);
    const pausedList = Array.isArray(data[storageKey]) ? data[storageKey] : [];
    const normalizedTarget = normalizeDomain(domain);
    return pausedList.some(saved => {
      const normalizedSaved = normalizeDomain(saved);
      return normalizedTarget === normalizedSaved || normalizedTarget.endsWith(`.${normalizedSaved}`);
    });
  } catch (error) { return false; }
}

function normalizeDomain(domain = '') {
  return domain.toLowerCase().replace(/^www\./, '');
}