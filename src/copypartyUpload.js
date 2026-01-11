// src/copypartyUpload.js
export async function copypartyPutJson(base, username, password, path, obj) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  const url = `${b}/${p}`;
  const token = btoa(`${username}:${password}`);
  const body = JSON.stringify(obj ?? {}, null, 0);
  const res = await fetch(url, { method: "PUT", headers: { "Authorization": `Basic ${token}`, "Content-Type": "application/json" }, body });
  if (!res.ok) { const txt = await res.text().catch(() => ""); return { ok: false, status: res.status, error: txt || `PUT failed (${res.status})` }; }
  return { ok: true };
}
