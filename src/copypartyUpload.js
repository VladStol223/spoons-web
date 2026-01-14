// src/copypartyUpload.js
function normBase(base) { return String(base || "").replace(/\/+$/, ""); }
function normPath(path) { return String(path || "").replace(/^\/+/, ""); }
function makeUrl(base, path) { const b = normBase(base); const p = normPath(path); return `${b}/${p}`; }
function authHeaders(username, password) { const token = btoa(`${username}:${password}`); return { "Authorization": `Basic ${token}` }; }

export async function copypartyDelete(base, username, password, path) {
  const url = makeUrl(base, path);
  const res = await fetch(url, { method: "DELETE", headers: authHeaders(username, password) });
  if (res.ok || res.status === 404) return { ok: true };
  const txt = await res.text().catch(() => "");
  return { ok: false, status: res.status, error: txt || `DELETE failed (${res.status})` };
}

export async function copypartyMove(base, username, password, fromPath, toPath) {
  const fromUrl = makeUrl(base, fromPath);
  const toUrl = makeUrl(base, toPath);
  const res = await fetch(fromUrl, { method: "MOVE", headers: { ...authHeaders(username, password), "Destination": toUrl, "Overwrite": "T" } });
  if (res.ok) return { ok: true };
  const txt = await res.text().catch(() => "");
  return { ok: false, status: res.status, error: txt || `MOVE failed (${res.status})` };
}

export async function copypartyPutJson(base, username, password, path, obj) {
  const url = makeUrl(base, path);
  const body = JSON.stringify(obj ?? {}, null, 0);
  const res = await fetch(url, { method: "PUT", headers: { ...authHeaders(username, password), "Content-Type": "application/json" }, body });
  if (!res.ok) { const txt = await res.text().catch(() => ""); return { ok: false, status: res.status, error: txt || `PUT failed (${res.status})` }; }
  return { ok: true };
}

export async function copypartyPutJsonAtomic(base, username, password, path, obj) {
  const p = normPath(path);
  const ts = Date.now();
  const rand = Math.random().toString(16).slice(2);
  const tempPath = `${p}.upload-${ts}-${rand}.tmp`;
  const putRes = await copypartyPutJson(base, username, password, tempPath, obj);
  if (!putRes.ok) return putRes;
  await copypartyDelete(base, username, password, p); // ignore failures here, MOVE overwrite is the real win
  const mvRes = await copypartyMove(base, username, password, tempPath, p);
  if (!mvRes.ok) { await copypartyDelete(base, username, password, tempPath); return mvRes; }
  return { ok: true };
}
