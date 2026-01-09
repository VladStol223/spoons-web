// src/copypartySync.js
import { uploadEncryptedDataJson } from "./copypartyData";

const LS_DATA_KEY = "spoonsDataCache";
const LS_DIRTY_KEY = "spoonsDataDirty";
const LS_LAST_SYNC_KEY = "spoonsDataLastSyncAt";
const LS_LAST_CHANGE_KEY = "spoonsDataLastChangeAt";
const LS_LAST_ERR_KEY = "spoonsDataLastSyncError";

function nowMs() { return Date.now(); }

export function loadCachedData() {
  try { const raw = localStorage.getItem(LS_DATA_KEY); if (!raw) return null; return JSON.parse(raw); } catch { return null; }
}

export function saveCachedData(dataObj) {
  localStorage.setItem(LS_DATA_KEY, JSON.stringify(dataObj ?? {}));
  localStorage.setItem(LS_LAST_CHANGE_KEY, String(nowMs()));
  localStorage.setItem(LS_DIRTY_KEY, "1");
}

export function markClean() {
  localStorage.setItem(LS_DIRTY_KEY, "0");
  localStorage.setItem(LS_LAST_SYNC_KEY, String(nowMs()));
  localStorage.removeItem(LS_LAST_ERR_KEY);
}

export function markDirty() { localStorage.setItem(LS_DIRTY_KEY, "1"); localStorage.setItem(LS_LAST_CHANGE_KEY, String(nowMs())); }

export function isDirty() { return localStorage.getItem(LS_DIRTY_KEY) === "1"; }

export function getLastSyncAt() { const v = Number(localStorage.getItem(LS_LAST_SYNC_KEY) || "0"); return Number.isFinite(v) ? v : 0; }

export function getLastChangeAt() { const v = Number(localStorage.getItem(LS_LAST_CHANGE_KEY) || "0"); return Number.isFinite(v) ? v : 0; }

export function getLastSyncError() { return localStorage.getItem(LS_LAST_ERR_KEY) || ""; }

export function setLastSyncError(msg) { if (!msg) localStorage.removeItem(LS_LAST_ERR_KEY); else localStorage.setItem(LS_LAST_ERR_KEY, String(msg)); }

export async function syncUploadOnce({ baseCpPath, username, password, getDataObj }) {
  if (!username || !password) return { ok: false, error: "Missing username/password." };
  if (!isDirty()) return { ok: true, skipped: true };

  const dataObj = typeof getDataObj === "function" ? getDataObj() : null;
  if (!dataObj) return { ok: false, error: "No data object to upload." };

  try {
    await uploadEncryptedDataJson(baseCpPath, username, password, dataObj);
    markClean();
    return { ok: true };
  } catch (e) {
    const msg = e?.message || "Upload failed.";
    setLastSyncError(msg);
    markDirty();
    return { ok: false, error: msg };
  }
}

export function createBackoff() {
  return { attempt: 0, nextDelayMs: 2000, lastAttemptAt: 0 };
}

export function bumpBackoff(state) {
  const s = state || createBackoff();
  const nextAttempt = Math.min(10, (s.attempt || 0) + 1);
  const base = Math.min(5 * 60 * 1000, Math.floor(2000 * Math.pow(2, nextAttempt - 1)));
  const jitter = Math.floor(base * (0.15 * Math.random()));
  return { attempt: nextAttempt, nextDelayMs: base + jitter, lastAttemptAt: nowMs() };
}

export function resetBackoff(state) {
  if (!state) return createBackoff();
  return { attempt: 0, nextDelayMs: 2000, lastAttemptAt: 0 };
}
