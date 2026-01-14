// src/copypartyData.js
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

function makeTempFilename(fn) {
  const ts = Date.now();
  const rand = Math.random().toString(16).slice(2);
  return `${fn}.upload-${ts}-${rand}.tmp`;
}

async function putEncryptedBlob(base, u, p, filename, encBlob) {
  const url = `${base}/${encodeURIComponent(u)}/${encodeURIComponent(filename)}`;
  const res = await fetch(url, { method: "PUT", redirect: "follow", credentials: "omit", cache: "no-store", headers: { Authorization: buildAuthHeader(u, p), "Content-Type": "application/octet-stream", "Cache-Control": "no-store" }, body: encBlob });
  if (!res.ok) throw new Error(`Failed to upload ${filename} (HTTP ${res.status}).`);
  return true;
}

async function moveDav(base, u, p, fromFilename, toFilename) {
  const fromUrl = `${base}/${encodeURIComponent(u)}/${encodeURIComponent(fromFilename)}`;
  const toUrl = `${base}/${encodeURIComponent(u)}/${encodeURIComponent(toFilename)}`;
  const res = await fetch(fromUrl, { method: "MOVE", redirect: "follow", credentials: "omit", cache: "no-store", headers: { Authorization: buildAuthHeader(u, p), "Destination": toUrl, "Overwrite": "T", "Cache-Control": "no-store" } });
  if (res.ok) return true;
  const txt = await res.text().catch(() => "");
  throw new Error(txt || `MOVE failed (HTTP ${res.status}).`);
}

async function deleteDav(base, u, p, filename) {
  const url = `${base}/${encodeURIComponent(u)}/${encodeURIComponent(filename)}`;
  const res = await fetch(url, { method: "DELETE", redirect: "follow", credentials: "omit", cache: "no-store", headers: { Authorization: buildAuthHeader(u, p), "Cache-Control": "no-store" } });
  if (res.ok || res.status === 404) return true;
  return false;
}

async function uploadEncryptedJsonFileAtomic(baseCpPath, username, password, filename, dataObj) {
  const base = (baseCpPath || "").replace(/\/+$/, "");
  const u = (username || "").trim();
  const p = (password || "").trim();
  const fn = String(filename || "").trim();
  if (!base) throw new Error("Missing Copyparty base (expected /cp).");
  if (!u || !p) throw new Error("Missing username/password.");
  if (!fn) throw new Error("Missing filename.");

  const text = JSON.stringify(dataObj ?? {});
  const plain = new TextEncoder().encode(text);
  const encBlob = await encryptForUpload(plain, u, p);

  const tmp = makeTempFilename(fn);

  await putEncryptedBlob(base, u, p, tmp, encBlob);

  try {
    await moveDav(base, u, p, tmp, fn);
    return true;
  } catch (e) {
    try { await deleteDav(base, u, p, tmp); } catch {}
    throw e;
  }
}

// --- Web app (spoons.cloud) uses ONLY web-data.json ---
export async function fetchAndDecryptWebDataJson(baseCpPath, username, password) {
  return await fetchAndDecryptJsonFile(baseCpPath, username, password, WEB_DATA_FILENAME);
}

export async function uploadEncryptedWebDataJson(baseCpPath, username, password, dataObj) {
  return await uploadEncryptedJsonFileAtomic(baseCpPath, username, password, WEB_DATA_FILENAME, dataObj);
}
