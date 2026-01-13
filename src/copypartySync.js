// src/copypartySync.js
import { uploadEncryptedWebDataJson } from "./copypartyData";

// Canonical cache key used everywhere
const LS_DATA_KEY = "spoons_data_cache";

// Legacy keys we may have used previously (read-only fallback)
const LEGACY_DATA_KEYS = ["spoonsDataCache", "spoons_data_json", "spoonsData", "spoons_data"];

const LS_DIRTY_KEY = "spoonsDataDirty";
const LS_LAST_SYNC_KEY = "spoonsDataLastSyncAt";
const LS_LAST_CHANGE_KEY = "spoonsDataLastChangeAt";
const LS_LAST_ERR_KEY = "spoonsDataLastSyncError";

let uploadTimer = null;
let uploadInFlight = false;
let uploadQueued = false;
let latestPendingObj = null;

function nowMs() { return Date.now(); }
function safeParse(raw) { try { return JSON.parse(raw); } catch { return null; } }

function normalizeDataObj(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};

  // normalize spoons to o.spoons (accept legacy keys)
  const candidates = [
    o.spoons,
    o.spoons_count,
    o.spoonsCount,
    o.spoonsRemaining,
    o.spoons_remaining,
    o.current_spoons,
    o.currentSpoons
  ];

  let found = null;
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n)) { found = n; break; }
  }
  o.spoons = Math.max(0, Math.floor(Number(found ?? 0) || 0));

  return o;
}

function getCreds() {
  try {
    const raw = sessionStorage.getItem("spoonsAuth");
    if (!raw) return null;
    const j = JSON.parse(raw);
    const u = String(j?.username || "").trim();
    const p = String(j?.password || "").trim();
    if (u && p) return { username: u, password: p };
  } catch {}
  return null;
}

export function loadCachedData() {
  const keys = [LS_DATA_KEY, ...LEGACY_DATA_KEYS];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const j = safeParse(raw);
      if (j && typeof j === "object") {
        const norm = normalizeDataObj(j);

        // converge to canonical key (and normalized shape)
        if (k !== LS_DATA_KEY || JSON.stringify(norm) !== JSON.stringify(j)) {
          try { localStorage.setItem(LS_DATA_KEY, JSON.stringify(norm)); } catch {}
        }

        return norm;
      }
    } catch {}
  }
  return null;
}

export function markClean() {
  try { localStorage.setItem(LS_DIRTY_KEY, "0"); } catch {}
  try { localStorage.setItem(LS_LAST_SYNC_KEY, String(nowMs())); } catch {}
  try { localStorage.removeItem(LS_LAST_ERR_KEY); } catch {}
}

export function markDirty() {
  try { localStorage.setItem(LS_DIRTY_KEY, "1"); } catch {}
  try { localStorage.setItem(LS_LAST_CHANGE_KEY, String(nowMs())); } catch {}
}

export function isDirty() {
  try { return localStorage.getItem(LS_DIRTY_KEY) === "1"; } catch { return false; }
}

export function getLastSyncAt() {
  const v = Number(localStorage.getItem(LS_LAST_SYNC_KEY) || "0");
  return Number.isFinite(v) ? v : 0;
}

export function getLastChangeAt() {
  const v = Number(localStorage.getItem(LS_LAST_CHANGE_KEY) || "0");
  return Number.isFinite(v) ? v : 0;
}

export function getLastSyncError() {
  try { return localStorage.getItem(LS_LAST_ERR_KEY) || ""; } catch { return ""; }
}

export function setLastSyncError(msg) {
  try {
    if (!msg) localStorage.removeItem(LS_LAST_ERR_KEY);
    else localStorage.setItem(LS_LAST_ERR_KEY, String(msg));
  } catch {}
}

async function uploadNow(obj) {
  const creds = getCreds();
  const base = (import.meta.env.VITE_COPYPARTY_BASE || "/cp").trim();
  if (!creds) return { ok: false, error: "No creds in sessionStorage." };
  if (!base) return { ok: false, error: "Missing VITE_COPYPARTY_BASE." };

  try {
    await uploadEncryptedWebDataJson(base, creds.username, creds.password, obj);
    markClean();
    try { localStorage.setItem("spoons_last_upload_ts", String(nowMs())); } catch {}
    return { ok: true };
  } catch (e) {
    const msg = e?.message || "Upload failed.";
    setLastSyncError(msg);
    markDirty();
    return { ok: false, error: msg };
  }
}

function scheduleUpload() {
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(async () => {
    if (uploadInFlight) { uploadQueued = true; return; }
    uploadInFlight = true;

    // Always upload the most recent snapshot we know about
    const objToUpload = latestPendingObj || loadCachedData() || {};
    const res = await uploadNow(objToUpload);

    uploadInFlight = false;

    // If changes happened during upload, run again (and it will use the newest snapshot)
    if (uploadQueued || isDirty()) {
      uploadQueued = false;
      scheduleUpload();
    }

    if (!res.ok) console.warn("Copyparty upload failed:", res);
  }, 800);
}

export function saveCachedData(dataObj) {
  const norm = normalizeDataObj(dataObj);
  const raw = JSON.stringify(norm);

  let prev = "";
  try { prev = localStorage.getItem(LS_DATA_KEY) || ""; } catch {}

  // If nothing actually changed, do nothing (no dirty, no upload)
  if (prev === raw) return;

  try { localStorage.setItem(LS_DATA_KEY, raw); } catch {}
  try { localStorage.setItem(LS_LAST_CHANGE_KEY, String(nowMs())); } catch {}
  try { localStorage.setItem(LS_DIRTY_KEY, "1"); } catch {}

  try { localStorage.setItem("spoonsDataCache", raw); } catch {}

  latestPendingObj = norm;
  scheduleUpload();
}

export function forceUploadCachedData() {
  const obj = loadCachedData();
  if (!obj) return Promise.resolve({ ok: false, error: "No cached data to upload." });
  latestPendingObj = obj;
  markDirty();
  return uploadNow(obj);
}

// Call this ONCE at app startup (App.jsx or your auth bootstrap)
export function initCopypartyAutoSync() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushUploadIfDirty();
  });

  window.addEventListener("pagehide", () => {
    flushUploadIfDirty();
  });

  window.addEventListener("online", () => {
    flushUploadIfDirty();
  });
}

export function flushUploadIfDirty() {
  if (!isDirty()) return Promise.resolve({ ok: true, skipped: true });
  const obj = loadCachedData();
  if (!obj) return Promise.resolve({ ok: false, error: "No cached data to upload." });
  return uploadNow(obj);
}

export function hydrateCachedDataFromServer(dataObj) {
  const norm = normalizeDataObj(dataObj);
  const raw = JSON.stringify(norm);

  try { localStorage.setItem(LS_DATA_KEY, raw); } catch {}
  try { localStorage.setItem("spoonsDataCache", raw); } catch {} // optional legacy
  try { localStorage.setItem(LS_LAST_CHANGE_KEY, String(nowMs())); } catch {}

  // IMPORTANT: do NOT mark dirty and do NOT upload
  markClean();
}
