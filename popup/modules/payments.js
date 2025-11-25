import { PaymentsService } from './storage.js';
import { cloneTemplate, setText, toggleHidden, clearChildren, focusElement } from '../utils/dom.js';

export function createPaymentsModule(options) {
  const state = {
    items: [],
    currentEditId: null
  };

  const {
    listEl,
    emptyState,
    templateEl,
    addButton,
    overlayEl,
    formEl,
    deleteButton,
    saveButton,
    closeButton,
    inputs
  } = options;

  let eventsBound = false;

  async function init() {
    await refresh();
    bindEvents();
  }

  function bindEvents() {
    if (eventsBound) return;

    addButton?.addEventListener('click', () => openCreateForm());

    saveButton?.addEventListener('click', handleSave);
    formEl?.addEventListener('submit', (event) => {
      event.preventDefault();
      handleSave();
    });

    deleteButton?.addEventListener('click', handleDelete);
    closeButton?.addEventListener('click', () => toggleOverlay(false));

    overlayEl?.addEventListener('click', (event) => {
      if (event.target === overlayEl) {
        toggleOverlay(false);
      }
    });

    eventsBound = true;
  }

  async function refresh() {
    state.items = await PaymentsService.getAll();
    renderList();
  }

  function renderList() {
    if (!listEl) return;
    clearChildren(listEl);
    toggleHidden(emptyState, state.items.length !== 0);

    state.items.forEach((item) => {
      const node = buildListItem(item);
      listEl.appendChild(node);
    });
  }

  function buildListItem(item) {
    const listItem = cloneTemplate(templateEl);
    listItem.dataset.paymentId = item.id;

    setText(listItem.querySelector('.payment-name'), item.name || 'Pagamento');
    setText(listItem.querySelector('.payment-meta'), formatMeta(item));

    const editBtn = listItem.querySelector('.edit-btn');
    const deleteBtn = listItem.querySelector('.delete-btn');

    editBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      openEditForm(item.id);
    });

    deleteBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      confirmDelete(item.id);
    });

    listItem.addEventListener('click', () => openEditForm(item.id));

    return listItem;
  }

  function formatMeta(item) {
    const digits = (item.number || '').replace(/[^0-9]/g, '');
    const last = digits.slice(-4);
    const masked = last ? `•••• ${last}` : 'Sem número';
    const expiry = item.expiry ? ` • ${item.expiry}` : '';
    const site = item.site ? ` • ${item.site}` : '';
    return `${masked}${expiry}${site}`;
  }

  function openCreateForm() {
    state.currentEditId = null;
    formEl?.reset();
    if (inputs.cvc) inputs.cvc.value = '';
    if (inputs.site) inputs.site.value = '';
    toggleHidden(deleteButton, true);
    toggleOverlay(true);
    focusElement(inputs.name);
  }

  function openEditForm(id) {
    const entry = state.items.find((item) => item.id === id);
    if (!entry) return;
    state.currentEditId = id;
    inputs.name.value = entry.name || '';
    inputs.number.value = entry.number || '';
    inputs.expiry.value = entry.expiry || '';
    inputs.cvc.value = entry.cvc || '';
    inputs.site.value = entry.site || '';
    inputs.notes.value = entry.notes || '';
    toggleHidden(deleteButton, false);
    toggleOverlay(true);
    focusElement(inputs.name);
  }

  function toggleOverlay(show) {
    if (!overlayEl) return;
    toggleHidden(overlayEl, !show);
    if (!show) {
      state.currentEditId = null;
      formEl?.reset();
      if (inputs.cvc) inputs.cvc.value = '';
      if (inputs.site) inputs.site.value = '';
      toggleHidden(deleteButton, true);
    }
  }

  async function handleSave() {
    const name = inputs.name.value.trim();
    const number = inputs.number.value.trim();
    const expiry = inputs.expiry.value.trim();
    const cvc = inputs.cvc.value.trim();
    const site = inputs.site.value.trim();
    const notes = inputs.notes.value.trim();

    if (!name || !number) {
      alert('Informe pelo menos o nome e o número.');
      return;
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    if (sanitizedNumber.length < 12) {
      alert('Número do cartão incompleto.');
      return;
    }
    const sanitizedCvc = cvc.replace(/[^0-9]/g, '').slice(0, 4);

    if (state.currentEditId) {
      state.items = state.items.map((item) => (
        item.id === state.currentEditId
          ? { ...item, name, number: sanitizedNumber, expiry, cvc: sanitizedCvc, site, notes }
          : item
      ));
    } else {
      state.items.push({
        id: crypto.randomUUID(),
        name,
        number: sanitizedNumber,
        expiry,
        cvc: sanitizedCvc,
        site,
        notes
      });
    }

    await PaymentsService.saveAll(state.items);
    await refresh();
    toggleOverlay(false);
  }

  async function handleDelete() {
    if (!state.currentEditId) return;
    await confirmDelete(state.currentEditId);
  }

  async function confirmDelete(id) {
    if (!window.confirm('Deseja excluir este pagamento?')) return;
    state.items = state.items.filter((item) => item.id !== id);
    await PaymentsService.saveAll(state.items);
    await refresh();
    if (state.currentEditId === id) {
      toggleOverlay(false);
    }
  }

  return {
    init,
    refresh
  };
}
