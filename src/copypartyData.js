import { maybeDecryptDownload, encryptForUpload } from "./copypartyCrypto";

function buildAuthHeader(username, password) { const token = btoa(`${username}:${password}`); return `Basic ${token}`; }

export async function fetchAndDecryptDataJson(baseCpPath, username, password) {
  const base = (baseCpPath || "").replace(/\/+$/, "");
  const u = (username || "").trim();
  const p = (password || "").trim();
  if (!base) throw new Error("Missing Copyparty base (expected /cp).");
  if (!u || !p) throw new Error("Missing username/password.");
  const url = `${base}/${encodeURIComponent(u)}/data.json`;
  const res = await fetch(url, { method: "GET", redirect: "follow", credentials: "omit", cache: "no-store", headers: { Authorization: buildAuthHeader(u, p), "Cache-Control": "no-store" } });
  if (!res.ok) throw new Error(`Failed to fetch data.json (HTTP ${res.status}).`);
  const buf = await res.arrayBuffer();
  const blob = new Uint8Array(buf);
  const plain = await maybeDecryptDownload(blob, u, p);
  let text = "";
  try { text = new TextDecoder().decode(plain); } catch (e) { throw new Error("Decrypted bytes could not be decoded as UTF-8 (wrong password or corrupt)."); }
  let data = null;
  try { data = JSON.parse(text); } catch (e) { throw new Error("Decrypted data.json is not valid JSON (wrong password or corrupt)."); }
  return data;
}

export async function uploadEncryptedDataJson(baseCpPath, username, password, dataObj) {
  const base = (baseCpPath || "").replace(/\/+$/, "");
  const u = (username || "").trim();
  const p = (password || "").trim();
  if (!base) throw new Error("Missing Copyparty base (expected /cp).");
  if (!u || !p) throw new Error("Missing username/password.");
  const url = `${base}/${encodeURIComponent(u)}/data.json`;
  const text = JSON.stringify(dataObj ?? {});
  const plain = new TextEncoder().encode(text);
  const encBlob = await encryptForUpload(plain, u, p);
  const res = await fetch(url, { method: "PUT", redirect: "follow", credentials: "omit", cache: "no-store", headers: { Authorization: buildAuthHeader(u, p), "Content-Type": "application/octet-stream", "Cache-Control": "no-store" }, body: encBlob });
  if (!res.ok) throw new Error(`Failed to upload data.json (HTTP ${res.status}).`);
  return true;
}
