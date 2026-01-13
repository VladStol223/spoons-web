// src/copypartyUpload.js
export async function copypartyPutJson(base, username, password, path, obj) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  const url = `${b}/${p}`;
  const token = btoa(`${username}:${password}`);
  const headersAuth = { "Authorization": `Basic ${token}` };

  // Pre-delete the existing file so copyparty can't serve a stale cached copy
  const del = await fetch(url, { method: "DELETE", headers: headersAuth });
  if (!(del.ok || del.status === 404)) { const dtxt = await del.text().catch(() => ""); return { ok: false, status: del.status, error: dtxt || `DELETE failed (${del.status})` }; }

  const body = JSON.stringify(obj ?? {}, null, 0);
  const res = await fetch(url, { method: "PUT", headers: { ...headersAuth, "Content-Type": "application/json" }, body });
  if (!res.ok) { const txt = await res.text().catch(() => ""); return { ok: false, status: res.status, error: txt || `PUT failed (${res.status})` }; }
  return { ok: true };
}
