import { VaultService } from '../popup/modules/storage.js';

// Elementos DOM
const elements = {
  tableBody: document.getElementById('vault-table-body'),
  emptyState: document.getElementById('empty-state'),
  searchInput: document.getElementById('dash-search'),
  btnAdd: document.getElementById('btn-add-new'),
  modalOverlay: document.getElementById('modal-overlay'),
  modalForm: document.getElementById('modal-form'),
  btnModalClose: document.getElementById('btn-close-modal'),
  btnModalCancel: document.getElementById('btn-cancel-modal'),
  btnDelete: document.getElementById('btn-delete-entry'),
  btnGen: document.getElementById('btn-gen-modal'),
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
let currentFilter = 'all'; // 'all' | 'weak'

// --- Inicialização ---
async function init() {
  await loadData();
  bindEvents();
}

async function loadData() {
  allItems = await VaultService.getAll();
  renderTable();
}

function bindEvents() {
  elements.searchInput.addEventListener('input', renderTable);
  elements.btnAdd.addEventListener('click', () => openModal());
  elements.btnModalClose.addEventListener('click', closeModal);
  elements.btnModalCancel.addEventListener('click', closeModal);
  elements.modalForm.addEventListener('submit', handleSave);
  elements.btnDelete.addEventListener('click', handleDelete);
  
  elements.btnGen.addEventListener('click', () => {
    // Gera uma senha aleatória simples
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
    let pass = "";
    for (let i = 0; i < 16; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    elements.inputs.pass.value = pass;
  });

  // Filtros Sidebar
  if (elements.filterBtns.all) {
      elements.filterBtns.all.addEventListener('click', () => setFilter('all'));
  }
  if (elements.filterBtns.weak) {
      elements.filterBtns.weak.addEventListener('click', () => setFilter('weak'));
  }
}

function setFilter(type) {
  currentFilter = type;
  // Atualiza UI da sidebar
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if(type === 'all' && elements.filterBtns.all) elements.filterBtns.all.classList.add('active');
  if(type === 'weak' && elements.filterBtns.weak) elements.filterBtns.weak.classList.add('active');
  renderTable();
}

// --- Renderização ---
function renderTable() {
  const term = elements.searchInput.value.toLowerCase();
  elements.tableBody.innerHTML = '';

  const filtered = allItems.filter(item => {
    // Filtro de Texto
    const matchText = (item.site || '').toLowerCase().includes(term) || 
                      (item.username || '').toLowerCase().includes(term);
    
    // Filtro de Categoria
    let matchType = true;
    if (currentFilter === 'weak') {
      // Considera fraca se tiver menos de 8 caracteres
      matchType = (item.password || '').length < 8; 
    }

    return matchText && matchType;
  });

  if (filtered.length === 0) {
    elements.emptyState.classList.remove('hidden');
    return;
  }
  elements.emptyState.classList.add('hidden');

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    
    // Tenta extrair domínio para o favicon
    let domain = item.site || '';
    try {
        if (!domain.startsWith('http')) domain = `https://${domain}`;
        domain = new URL(domain).hostname;
    } catch (e) {
        domain = 'google.com'; // fallback
    }
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

    tr.innerHTML = `
      <td><img src="${faviconUrl}" style="width:24px; border-radius:4px;" onerror="this.src='../assets/internet.svg'"></td>
      <td class="site-cell">${escapeHtml(item.site)}</td>
      <td>${escapeHtml(item.username)}</td>
      <td>
        <span class="copy-badge" title="Clique para copiar">
          ••••••••
        </span>
      </td>
      <td>
        <button class="action-btn btn-edit" title="Editar">✏️</button>
        <button class="action-btn btn-copy-user" title="Copiar Usuário">👤</button>
      </td>
    `;

    // Eventos da linha (Cópia e Edição)
    tr.querySelector('.copy-badge').addEventListener('click', () => copyToClipboard(item.password));
    tr.querySelector('.btn-copy-user').addEventListener('click', () => copyToClipboard(item.username));
    tr.querySelector('.btn-edit').addEventListener('click', () => openModal(item));

    elements.tableBody.appendChild(tr);
  });
}

// --- Ações do Modal ---
function openModal(item = null) {
  elements.modalForm.reset();
  if (item) {
    elements.inputs.id.value = item.id;
    elements.inputs.site.value = item.site || '';
    elements.inputs.user.value = item.username || '';
    elements.inputs.pass.value = item.password || '';
    document.getElementById('modal-title').textContent = 'Editar Item';
    elements.btnDelete.classList.remove('hidden');
  } else {
    elements.inputs.id.value = '';
    document.getElementById('modal-title').textContent = 'Novo Item';
    elements.btnDelete.classList.add('hidden');
  }
  elements.modalOverlay.classList.remove('hidden');
}

function closeModal() {
  elements.modalOverlay.classList.add('hidden');
}

async function handleSave(e) {
  e.preventDefault();
  const id = elements.inputs.id.value;
  const site = elements.inputs.site.value;
  const username = elements.inputs.user.value;
  const password = elements.inputs.pass.value;

  if (id) {
    // Editar existente
    const index = allItems.findIndex(i => i.id === id);
    if (index !== -1) {
      allItems[index] = { ...allItems[index], site, username, password };
    }
  } else {
    // Criar novo
    allItems.push({ id: crypto.randomUUID(), site, username, password });
  }

  await VaultService.saveAll(allItems);
  closeModal();
  renderTable();
}

async function handleDelete() {
  const id = elements.inputs.id.value;
  if (!id || !confirm('Tem certeza que deseja excluir?')) return;

  allItems = allItems.filter(i => i.id !== id);
  await VaultService.saveAll(allItems);
  closeModal();
  renderTable();
}

// --- Utils ---
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function copyToClipboard(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    // Feedback visual opcional (pode adicionar um toast aqui depois)
  } catch (err) {
    console.error('Falha ao copiar', err);
  }
}

// Inicia o dashboard
init();