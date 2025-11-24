import { VaultService } from '../popup/modules/storage.js';

// --- Referências do DOM ---
const elements = {
  listContainer: document.getElementById('vault-list-container'),
  detailsPane: document.getElementById('details-pane'),
  emptyState: document.getElementById('empty-state'),
  searchInput: document.getElementById('dash-search'),
  btnAdd: document.getElementById('btn-add-new'),
  
  // Modal Elements
  modalOverlay: document.getElementById('modal-overlay'),
  modalForm: document.getElementById('modal-form'),
  btnModalClose: document.getElementById('btn-close-modal'),
  btnModalCancel: document.getElementById('btn-cancel-modal'),
  btnGenModal: document.getElementById('btn-gen-modal'),
  modalTitle: document.getElementById('modal-title'),
  inputs: {
    id: document.getElementById('edit-id'),
    site: document.getElementById('edit-site'),
    user: document.getElementById('edit-user'),
    pass: document.getElementById('edit-pass')
  },
  filterBtns: {
    all: document.getElementById('nav-all'),
    weak: document.getElementById('nav-weak')
  }
};

let allItems = [];
let currentFilter = 'all';
let selectedItemId = null; // Armazena o ID do item selecionado atualmente

// --- Inicialização ---
async function init() {
  await loadData();
  bindEvents();
}

async function loadData() {
  allItems = await VaultService.getAll();
  // Se houver itens e nenhum estiver selecionado, seleciona o primeiro
  if (allItems.length > 0 && !selectedItemId) {
      selectedItemId = allItems[0].id;
  }
  renderApp();
}

function bindEvents() {
  elements.searchInput.addEventListener('input', () => { selectedItemId = null; renderApp(); });
  elements.btnAdd.addEventListener('click', () => openModal());
  
  // Modal Events
  elements.btnModalClose.addEventListener('click', closeModal);
  elements.btnModalCancel.addEventListener('click', closeModal);
  elements.modalForm.addEventListener('submit', handleSave);
  
  elements.btnGenModal.addEventListener('click', () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
    let pass = "";
    for (let i = 0; i < 20; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    elements.inputs.pass.value = pass;
  });

  // Sidebar Filters
  if (elements.filterBtns.all) elements.filterBtns.all.addEventListener('click', () => setFilter('all'));
  if (elements.filterBtns.weak) elements.filterBtns.weak.addEventListener('click', () => setFilter('weak'));
}

function setFilter(type) {
  currentFilter = type;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if(type === 'all' && elements.filterBtns.all) elements.filterBtns.all.classList.add('active');
  if(type === 'weak' && elements.filterBtns.weak) elements.filterBtns.weak.classList.add('active');
  selectedItemId = null; // Reseta seleção ao mudar filtro
  renderApp();
}

// Função central que chama as renderizações das duas partes
function renderApp() {
    const filteredItems = getFilteredItems();
    renderList(filteredItems);
    renderDetailsPane(filteredItems);
}

function getFilteredItems() {
    const term = elements.searchInput.value.toLowerCase();
    return allItems.filter(item => {
      const matchText = (item.site || '').toLowerCase().includes(term) || 
                        (item.username || '').toLowerCase().includes(term);
      let matchType = true;
      if (currentFilter === 'weak') matchType = (item.password || '').length < 8;
      return matchText && matchType;
    });
}

// --- Renderização da Lista (Esquerda) ---
function renderList(filteredItems) {
  // Limpa a lista, mantendo o empty state
  Array.from(elements.listContainer.children).forEach(child => {
      if (child.id !== 'empty-state') child.remove();
  });

  if (filteredItems.length === 0) {
    elements.emptyState.classList.remove('hidden');
    return;
  }
  elements.emptyState.classList.add('hidden');

  filteredItems.forEach(item => {
    const itemEl = document.createElement('div');
    // Adiciona classe 'selected' se este for o item atual
    itemEl.className = `list-item ${item.id === selectedItemId ? 'selected' : ''}`;
    
    const domain = getDomain(item.site);
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    itemEl.innerHTML = `
      <div class="item-icon">
        <img src="${faviconUrl}" onerror="this.src='../assets/internet.svg'">
      </div>
      <div class="item-info">
        <div class="item-site" title="${escapeHtml(item.site)}">${escapeHtml(item.site)}</div>
        <div class="item-user" title="${escapeHtml(item.username)}">${escapeHtml(item.username)}</div>
      </div>
      <span class="material-icons-round item-arrow">chevron_right</span>
    `;

    // Evento de clique para selecionar o item
    itemEl.addEventListener('click', () => {
        selectedItemId = item.id;
        renderApp(); // Re-renderiza para atualizar a seleção visual e o painel direito
    });

    elements.listContainer.appendChild(itemEl);
  });
}

// --- Renderização dos Detalhes (Direita) ---
function renderDetailsPane(filteredItems) {
    const selectedItem = filteredItems.find(i => i.id === selectedItemId);

    // Se não tem item selecionado (ou ele foi filtrado), mostra placeholder
    if (!selectedItem) {
        elements.detailsPane.innerHTML = `
            <div class="no-selection-placeholder">
                <span class="material-icons-round placeholder-icon">touch_app</span>
                <h3>Selecione um item</h3>
                <p>Clique em um login à esquerda para ver os detalhes.</p>
            </div>`;
        return;
    }

    const domain = getDomain(selectedItem.site);
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    let fullUrl = selectedItem.site || '';
    if (fullUrl && !fullUrl.startsWith('http')) fullUrl = 'https://' + fullUrl;

    // Renderiza o painel completo similar à imagem de referência
    elements.detailsPane.innerHTML = `
        <header class="details-header">
            <h3>Login Details</h3>
            <div class="details-actions">
                <button class="btn-secondary icon-btn" id="btn-edit-item" title="Editar">
                    <span class="material-icons-round">edit</span>
                </button>
            </div>
        </header>

        <div class="details-hero">
            <div class="hero-icon">
                <img src="${faviconUrl}" onerror="this.src='../assets/internet.svg'">
            </div>
            <div class="hero-title">
                <h2>${escapeHtml(selectedItem.site)}</h2>
                ${fullUrl ? `<a href="${fullUrl}" target="_blank" class="btn-launch">Launch <span class="material-icons-round" style="font-size:16px;">open_in_new</span></a>` : ''}
            </div>
        </div>

        <div class="details-fields">
            <div class="field-group">
                <label class="field-label">Username</label>
                <div class="field-value-container">
                    <span class="field-value">${escapeHtml(selectedItem.username)}</span>
                    <button class="btn-icon btn-copy" data-copy="${escapeHtml(selectedItem.username)}"><span class="material-icons-round">content_copy</span></button>
                </div>
            </div>
            <div class="field-group">
                <label class="field-label">Password</label>
                <div class="field-value-container">
                    <span class="field-value">•••••••••••••••</span>
                    <button class="btn-icon btn-copy" data-copy="${escapeHtml(selectedItem.password)}"><span class="material-icons-round">content_copy</span></button>
                </div>
            </div>
             <div class="field-group">
                <label class="field-label">Website</label>
                <div class="field-value-container">
                    <span class="field-value">${escapeHtml(selectedItem.site)}</span>
                    <button class="btn-icon btn-copy" data-copy="${escapeHtml(selectedItem.site)}"><span class="material-icons-round">content_copy</span></button>
                </div>
            </div>
        </div>
        
        <div class="details-footer">
            <button class="btn-danger-text" id="btn-delete-item">Delete Login</button>
        </div>
    `;

    // Bind events do painel de detalhes
    elements.detailsPane.querySelector('#btn-edit-item').addEventListener('click', () => openModal(selectedItem));
    elements.detailsPane.querySelector('#btn-delete-item').addEventListener('click', () => handleDelete(selectedItem.id));
    elements.detailsPane.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            copyToClipboard(e.currentTarget.dataset.copy);
            // Feedback visual rápido no ícone
            const icon = e.currentTarget.querySelector('.material-icons-round');
            const original = icon.textContent;
            icon.textContent = 'check';
            icon.style.color = 'var(--primary)';
            setTimeout(() => { icon.textContent = original; icon.style.color = ''; }, 1500);
        });
    });
}

// --- Modal Functions ---
function openModal(item = null) {
  elements.modalForm.reset();
  if (item) {
    elements.inputs.id.value = item.id;
    elements.inputs.site.value = item.site || '';
    elements.inputs.user.value = item.username || '';
    elements.inputs.pass.value = item.password || '';
    elements.modalTitle.textContent = 'Edit Login';
  } else {
    elements.inputs.id.value = '';
    elements.modalTitle.textContent = 'New Login';
  }
  elements.modalOverlay.classList.remove('hidden');
}

function closeModal() {
  elements.modalOverlay.classList.add('hidden');
}

// --- CRUD Operations ---
async function handleSave(e) {
  e.preventDefault();
  const id = elements.inputs.id.value;
  const newItem = {
      id: id || crypto.randomUUID(),
      site: elements.inputs.site.value,
      username: elements.inputs.user.value,
      password: elements.inputs.pass.value
  };

  if (id) {
    const index = allItems.findIndex(i => i.id === id);
    if (index !== -1) allItems[index] = newItem;
  } else {
    allItems.unshift(newItem); // Adiciona no começo
    selectedItemId = newItem.id; // Seleciona o novo item
  }

  await VaultService.saveAll(allItems);
  closeModal();
  await loadData(); // Recarrega para garantir ordem e seleção
}

async function handleDelete(id) {
  if (!id || !confirm('Are you sure you want to delete this login?')) return;
  allItems = allItems.filter(i => i.id !== id);
  selectedItemId = null; // Limpa seleção
  await VaultService.saveAll(allItems);
  await loadData();
}

// --- Utils ---
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getDomain(url) {
    try {
        if (!url.startsWith('http')) url = `https://${url}`;
        return new URL(url).hostname;
    } catch (e) { return 'google.com'; }
}

async function copyToClipboard(text) {
  if (!text) return;
  try { await navigator.clipboard.writeText(text); } catch (err) { console.error('Failed to copy', err); }
}

init();