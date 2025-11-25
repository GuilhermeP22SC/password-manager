import { initGeneratorModule } from './modules/generator.js';
import { createVaultModule } from './modules/vault.js';
import { createAutofillModule } from './modules/autofill.js';

const views = {
  main: document.getElementById('view-main'),
  autofill: document.getElementById('view-autofill'),
  generator: document.getElementById('view-generator')
};

const navButtons = {
  main: document.getElementById('nav-vault'),
  autofill: document.getElementById('nav-autofill'),
  generator: document.getElementById('nav-gen')
};

// --- Inicialização dos Módulos ---

const generatorModule = initGeneratorModule({
  resultContainer: document.getElementById('gen-result-html'),
  lengthSlider: document.getElementById('opt-length'),
  lengthValueLabel: document.getElementById('len-val'),
  letterCheckbox: document.getElementById('opt-letters'),
  digitCheckbox: document.getElementById('opt-digits'),
  symbolCheckbox: document.getElementById('opt-symbols'),
  regenerateButton: document.getElementById('btn-regenerate'),
  copyButton: document.getElementById('btn-copy-gen')
});

const vaultModule = createVaultModule({
  listEl: document.getElementById('password-list'),
  countLabel: document.getElementById('item-count'),
  emptyState: document.getElementById('empty-state'),
  templateEl: document.getElementById('tpl-vault-item'),
  searchInput: document.getElementById('search-input'),
  addButton: document.getElementById('btn-add-hero'),
  overlayEl: document.getElementById('view-edit'),
  formEl: document.getElementById('form-entry'),
  deleteButton: document.getElementById('btn-delete'),
  saveButton: document.getElementById('btn-save-form'),
  closeButtons: document.querySelectorAll('.btn-close'),
  inputs: {
    site: document.getElementById('entry-site'),
    username: document.getElementById('entry-username'),
    password: document.getElementById('entry-password')
  },
  passwordToggleButton: document.getElementById('btn-toggle-pass'),
  passwordIcon: document.getElementById('icon-eye')
});

const autofillModule = createAutofillModule({
  domainEl: document.getElementById('current-domain'),
  faviconEl: document.getElementById('current-favicon'),
  autofillStatusEl: document.getElementById('site-status-autofill'),
  autoLoginStatusEl: document.getElementById('site-status-autologin'),
  autofillToggleButton: document.getElementById('btn-toggle-autofill'),
  autoLoginToggleButton: document.getElementById('btn-toggle-autologin')
});

// --- Navegação ---

function initNavigation() {
  navButtons.main.addEventListener('click', () => switchMainView('main'));
  navButtons.autofill.addEventListener('click', () => switchMainView('autofill'));
  navButtons.generator.addEventListener('click', () => switchMainView('generator'));
}

function switchMainView(target) {
  Object.values(views).forEach((view) => view.classList.add('hidden'));
  Object.values(navButtons).forEach((button) => button.classList.remove('active'));

  const viewEl = views[target];
  const navButton = navButtons[target];
  if (viewEl) viewEl.classList.remove('hidden');
  if (navButton) navButton.classList.add('active');

  if (target === 'autofill') {
    autofillModule.refresh();
  }
}

async function initApp() {
  initNavigation();
  try {
    await vaultModule.init();
  } catch (error) {
    console.error("Erro ao iniciar módulo do cofre:", error);
  }
  switchMainView('main');
}


// --- Exportar e Importar CSV ---
function setupCsvImportExport() {
  const exportBtn = document.getElementById('btn-export-csv');
  const importBtn = document.getElementById('btn-import-csv');
  const importInput = document.getElementById('import-csv-input');

  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      // Função de exportação será implementada
      if (vaultModule && vaultModule.exportToCsv) {
        await vaultModule.exportToCsv();
      }
    });
  }

  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file && vaultModule && vaultModule.importFromCsv) {
        await vaultModule.importFromCsv(file);
      }
      importInput.value = '';
    });
  }
}

initApp();
setupCsvImportExport();

export { generatorModule, vaultModule, autofillModule, switchMainView };