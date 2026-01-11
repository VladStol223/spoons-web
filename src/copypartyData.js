import { maybeDecryptDownload, encryptForUpload } from "./copypartyCrypto";

function buildAuthHeader(username, password) { const token = btoa(`${username}:${password}`); return `Basic ${token}`; }

const WEB_DATA_FILENAME = "web-data.json";
const DESKTOP_DATA_FILENAME = "data.json"; // desktop-only (web app should not touch this)

async function fetchAndDecryptJsonFile(baseCpPath, username, password, filename) {
  const base = (baseCpPath || "").replace(/\/+$/, "");
  const u = (username || "").trim();
  const p = (password || "").trim();
  const fn = String(filename || "").trim();
  if (!base) throw new Error("Missing Copyparty base (expected /cp).");
  if (!u || !p) throw new Error("Missing username/password.");
  if (!fn) throw new Error("Missing filename.");
  const url = `${base}/${encodeURIComponent(u)}/${encodeURIComponent(fn)}`;
  const res = await fetch(url, { method: "GET", redirect: "follow", credentials: "omit", cache: "no-store", headers: { Authorization: buildAuthHeader(u, p), "Cache-Control": "no-store" } });
  if (!res.ok) throw new Error(`Failed to fetch ${fn} (HTTP ${res.status}).`);
  const buf = await res.arrayBuffer();
  const blob = new Uint8Array(buf);
  const plain = await maybeDecryptDownload(blob, u, p);
  let text = "";
  try { text = new TextDecoder().decode(plain); } catch { throw new Error("Decrypted bytes could not be decoded as UTF-8 (wrong password or corrupt)."); }
  let data = null;
  try { data = JSON.parse(text); } catch { throw new Error(`Decrypted ${fn} is not valid JSON (wrong password or corrupt).`); }
  return data;
}

async function deleteIfExists(baseCpPath, username, password, filename) {
  const base = (baseCpPath || "").replace(/\/+$/, "");
  const u = (username || "").trim();
  const p = (password || "").trim();
  const fn = String(filename || "").trim();
  if (!base) throw new Error("Missing Copyparty base (expected /cp).");
  if (!u || !p) throw new Error("Missing username/password.");
  if (!fn) throw new Error("Missing filename.");
  const url = `${base}/${encodeURIComponent(u)}/${encodeURIComponent(fn)}`;
  const res = await fetch(url, { method: "DELETE", redirect: "follow", credentials: "omit", cache: "no-store", headers: { Authorization: buildAuthHeader(u, p), "Cache-Control": "no-store" } });
  if (res.status === 404) return true; // nothing to delete
  if (res.status === 200 || res.status === 204) return true;
  // Some servers return 405 if DELETE is disabled; in that case we continue to PUT anyway.
  if (res.status === 405) return false;
  if (!res.ok) throw new Error(`Failed to delete ${fn} (HTTP ${res.status}).`);
  return true;
}

async function uploadEncryptedJsonFile(baseCpPath, username, password, filename, dataObj, { deleteFirst } = {}) {
  const base = (baseCpPath || "").replace(/\/+$/, "");
  const u = (username || "").trim();
  const p = (password || "").trim();
  const fn = String(filename || "").trim();
  if (!base) throw new Error("Missing Copyparty base (expected /cp).");
  if (!u || !p) throw new Error("Missing username/password.");
  if (!fn) throw new Error("Missing filename.");
  const url = `${base}/${encodeURIComponent(u)}/${encodeURIComponent(fn)}`;
  if (deleteFirst) { try { await deleteIfExists(base, u, p, fn); } catch {} }
  const text = JSON.stringify(dataObj ?? {});
  const plain = new TextEncoder().encode(text);
  const encBlob = await encryptForUpload(plain, u, p);
  const res = await fetch(url, { method: "PUT", redirect: "follow", credentials: "omit", cache: "no-store", headers: { Authorization: buildAuthHeader(u, p), "Content-Type": "application/octet-stream", "Cache-Control": "no-store" }, body: encBlob });
  if (!res.ok) throw new Error(`Failed to upload ${fn} (HTTP ${res.status}).`);
  return true;
}

// --- Web app (spoons.cloud) uses ONLY web-data.json ---
export async function fetchAndDecryptWebDataJson(baseCpPath, username, password) {
  return await fetchAndDecryptJsonFile(baseCpPath, username, password, WEB_DATA_FILENAME);
}

export async function uploadEncryptedWebDataJson(baseCpPath, username, password, dataObj) {
  // IMPORTANT: do NOT DELETE first (many proxies/Copyparty configs block DELETE).
  // PUT will overwrite the file just fine.
  return await uploadEncryptedJsonFile(baseCpPath, username, password, WEB_DATA_FILENAME, dataObj, { deleteFirst: false });
}
