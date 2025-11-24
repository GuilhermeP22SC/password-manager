import { encryptData, decryptData } from '../utils/crypto.js';

const VAULT_KEY = 'vault';
const AUTOFILL_KEY = 'autofillPausedSites';
const AUTO_LOGIN_KEY = 'autoLoginPausedSites';

async function getValue(key) {
  const result = await chrome.storage.local.get([key]);
  return result[key];
}

async function setValue(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export const VaultService = {
  async getAll() {
    const stored = await getValue(VAULT_KEY);
    if (!stored) return [];
    try {
      return await decryptData(stored);
    } catch (error) {
      console.error('VaultService: erro ao ler dados.', error);
      return [];
    }
  },

  async saveAll(entries) {
    const payload = await encryptData(entries);
    await setValue(VAULT_KEY, payload);
  }
};

export async function getPausedSites() {
  const stored = await getValue(AUTOFILL_KEY);
  return Array.isArray(stored) ? stored : [];
}

export async function savePausedSites(sites) {
  await setValue(AUTOFILL_KEY, Array.isArray(sites) ? sites : []);
}

export function getAutofillStorageKey() {
  return AUTOFILL_KEY;
}

export async function getAutoLoginPausedSites() {
  const stored = await getValue(AUTO_LOGIN_KEY);
  return Array.isArray(stored) ? stored : [];
}

export async function saveAutoLoginPausedSites(sites) {
  await setValue(AUTO_LOGIN_KEY, Array.isArray(sites) ? sites : []);
}

export function getAutoLoginStorageKey() {
  return AUTO_LOGIN_KEY;
}