const BASE = import.meta.env.VITE_COPYPARTY_BASE || "";

function buildAuthHeader(username, password) { const token = btoa(`${username}:${password}`); return `Basic ${token}`; }

export async function copypartyVerifyLogin(username, password) {
  if (!BASE) return { ok: false, error: "Missing VITE_COPYPARTY_BASE in .env.local" };
  const base = BASE.replace(/\/+$/,"");
  const url = `${base}/${encodeURIComponent(username)}/`;
  const body = '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>';
  try {
    const res = await fetch(url, { method: "PROPFIND", redirect: "manual", headers: { Authorization: buildAuthHeader(username, password), Depth: "0", "Content-Type": "text/xml" }, body });
    if (res.status === 200 || res.status === 207) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Wrong username or password." };
    if (res.status === 404) return { ok: false, error: "No such Copyparty user (folder not found)." };
    if (res.status >= 300 && res.status < 400) return { ok: false, error: "Copyparty redirected the request (likely to a login/home page). Treating as failed login." };
    return { ok: false, error: `Copyparty returned HTTP ${res.status}.` };
  } catch (e) {
    return { ok: false, error: "Network error contacting Copyparty (or proxy). If this is unexpected, test the proxy with curl from the VPS." };
  }
}
