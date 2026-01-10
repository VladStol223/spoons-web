// src/copypartySync.js
import { uploadEncryptedDataJson } from "./copypartyData";

// Canonical cache key used everywhere
const LS_DATA_KEY = "spoons_data_cache";

// Legacy keys we may have used previously (read-only fallback)
const LEGACY_DATA_KEYS = ["spoonsDataCache", "spoons_data_json", "data.json", "spoonsData", "spoons_data"];

const LS_DIRTY_KEY = "spoonsDataDirty";
const LS_LAST_SYNC_KEY = "spoonsDataLastSyncAt";
const LS_LAST_CHANGE_KEY = "spoonsDataLastChangeAt";
const LS_LAST_ERR_KEY = "spoonsDataLastSyncError";

function nowMs() { return Date.now(); }

function safeParse(raw) { try { return JSON.parse(raw); } catch { return null; } }

export function loadCachedData() {
  // 1) canonical
  const raw0 = localStorage.getItem(LS_DATA_KEY);
  const j0 = raw0 ? safeParse(raw0) : null;
  if (j0 && typeof j0 === "object") return j0;

  // 2) legacy fallback + migrate forward
  for (const k of LEGACY_DATA_KEYS) {
    const raw = localStorage.getItem(k);
    const j = raw ? safeParse(raw) : null;
    if (j && typeof j === "object") {
      try { localStorage.setItem(LS_DATA_KEY, JSON.stringify(j)); } catch {}
      return j;
    }
  }

  return null;
}

export function saveCachedData(dataObj) {
  const obj = (dataObj && typeof dataObj === "object") ? dataObj : {};
  localStorage.setItem(LS_DATA_KEY, JSON.stringify(obj));
  localStorage.setItem(LS_LAST_CHANGE_KEY, String(nowMs()));
  localStorage.setItem(LS_DIRTY_KEY, "1");

  // Optional: keep legacy key around for one version so older code still sees it
  try { localStorage.setItem("spoonsDataCache", JSON.stringify(obj)); } catch {}
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
