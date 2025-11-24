import { VaultService } from './storage.js';
import { cloneTemplate, setText, toggleHidden, clearChildren, focusElement } from '../utils/dom.js';

const EYE_OPEN_ICON = '../assets/opened-eye.svg';
const EYE_CLOSED_ICON = '../assets/eye-closed.svg';

export function createVaultModule(options) {
  const state = {
    items: [],
    filter: '',
    currentEditId: null
  };

  const {
    listEl,
    countLabel,
    emptyState,
    templateEl,
    searchInput,
    addButton,
    overlayEl,
    formEl,
    deleteButton,
    saveButton,
    closeButtons,
    inputs,
    passwordToggleButton,
    passwordIcon
  } = options;

  let eventsBound = false;

  async function init() {
    state.items = await VaultService.getAll();
    bindEvents();
    renderList();
  }

  function bindEvents() {
    if (eventsBound) return;

    addButton.addEventListener('click', () => {
      openCreateForm();
    });

    searchInput.addEventListener('input', (event) => {
      state.filter = event.target.value.trim();
      renderList();
    });

    saveButton.addEventListener('click', handleSave);

    formEl.addEventListener('submit', (event) => {
      event.preventDefault();
      handleSave();
    });

    deleteButton.addEventListener('click', handleDelete);
    passwordToggleButton.addEventListener('click', togglePasswordVisibility);

    closeButtons.forEach((button) => {
      button.addEventListener('click', () => toggleOverlay(false));
    });

    eventsBound = true;
  }

  function renderList() {
    clearChildren(listEl);
    const normalizedFilter = state.filter.toLowerCase();
    const filtered = state.items.filter((item) => {
      const site = item.site?.toLowerCase() || '';
      const username = item.username?.toLowerCase() || '';
      return site.includes(normalizedFilter) || username.includes(normalizedFilter);
    });

    setText(countLabel, `${filtered.length} itens`);
    toggleHidden(emptyState, filtered.length !== 0);

    filtered.forEach((item) => {
      const listItem = buildListItem(item);
      listEl.appendChild(listItem);
    });
  }

  function buildListItem(item) {
    const listItem = cloneTemplate(templateEl);
    const nameEl = listItem.querySelector('.item-name');
    const userEl = listItem.querySelector('.item-sub');
    const copyBtn = listItem.querySelector('.copy-btn');
    const launchBtn = listItem.querySelector('.launch-btn');
    const iconBox = listItem.querySelector('.item-icon-box');
    const iconImg = iconBox ? iconBox.querySelector('img') : null;

    listItem.dataset.entryId = item.id;

    setText(nameEl, item.site);
    setText(userEl, item.username);

    // Atualiza o ícone para o favicon do site salvo, com fallback para SVG padrão
    if (iconImg && item.site) {
      try {
        let domain = item.site.trim();
        if (/^https?:\/\//i.test(domain)) {
          domain = new URL(domain).hostname;
        } else {
          domain = domain.split('/')[0];
        }
        iconImg.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        iconImg.alt = `Favicon de ${domain}`;
        // Fallback: se não carregar, usa SVG padrão
        iconImg.onerror = function() {
          this.onerror = null;
          this.src = '../assets/internet.svg';
          this.alt = 'Site';
        };
      } catch (e) {
        iconImg.src = '../assets/internet.svg';
        iconImg.alt = 'Site';
      }
    }

    listItem.addEventListener('click', (event) => {
      if (event.target.closest('.btn-icon-action')) return;
      openEditForm(item.id);
    });

    copyBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      navigator.clipboard.writeText(item.password || '');
    });

    launchBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      openSite(item.site);
    });

    return listItem;
  }

  function openSite(site) {
    if (!site) return;
    let url = site.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    chrome.tabs.create({ url });
  }

  function openCreateForm() {
    state.currentEditId = null;
    formEl.reset();
    inputs.site.value = '';
    inputs.username.value = '';
    inputs.password.value = '';
    toggleHidden(deleteButton, true);
    resetPasswordField();
    toggleOverlay(true);
    focusElement(inputs.site);
  }

  function openEditForm(id) {
    const entry = state.items.find((item) => item.id === id);
    if (!entry) return;
    state.currentEditId = id;
    inputs.site.value = entry.site || '';
    inputs.username.value = entry.username || '';
    inputs.password.value = entry.password || '';
    toggleHidden(deleteButton, false);
    resetPasswordField();
    toggleOverlay(true);
    focusElement(inputs.site);
  }

  async function handleSave() {
    const site = inputs.site.value.trim();
    const username = inputs.username.value.trim();
    const password = inputs.password.value.trim();

    if (!site || !password) return;

    if (state.currentEditId) {
      state.items = state.items.map((item) => (
        item.id === state.currentEditId
          ? { ...item, site, username, password }
          : item
      ));
    } else {
      state.items.push({ id: crypto.randomUUID(), site, username, password });
    }

    await VaultService.saveAll(state.items);
    toggleOverlay(false);
    renderList();
  }

  async function handleDelete() {
    if (!state.currentEditId) return;
    if (!window.confirm('Excluir?')) return;

    state.items = state.items.filter((item) => item.id !== state.currentEditId);
    await VaultService.saveAll(state.items);
    toggleOverlay(false);
    renderList();
  }

  function toggleOverlay(show) {
    toggleHidden(overlayEl, !show);
    if (!show) {
      state.currentEditId = null;
      formEl.reset();
      toggleHidden(deleteButton, true);
      resetPasswordField();
    }
  }

  function resetPasswordField() {
    if (!inputs.password) return;
    inputs.password.type = 'password';
    if (passwordIcon) {
      passwordIcon.src = EYE_CLOSED_ICON;
      passwordIcon.alt = 'Mostrar senha';
    }
  }

  function togglePasswordVisibility() {
    const isHidden = inputs.password.type === 'password';
    inputs.password.type = isHidden ? 'text' : 'password';
    if (passwordIcon) {
      passwordIcon.src = isHidden ? EYE_OPEN_ICON : EYE_CLOSED_ICON;
      passwordIcon.alt = isHidden ? 'Ocultar senha' : 'Mostrar senha';
    }
  }

  return {
    init,
    renderList
  };
}
