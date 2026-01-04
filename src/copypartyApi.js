const BASE = import.meta.env.VITE_COPYPARTY_BASE || "";

function buildAuthHeader(username, password) { const token = btoa(`${username}:${password}`); return `Basic ${token}`; }

export async function copypartyVerifyLogin(username, password) {
  if (!BASE) return { ok: false, error: "Missing VITE_COPYPARTY_BASE in .env.local" };
  const url = `${BASE.replace(/\/+$/,"")}/${encodeURIComponent(username)}/`;
  try {
    const res = await fetch(url, { method: "PROPFIND", headers: { Authorization: buildAuthHeader(username, password), Depth: "0" } });
    if (res.status === 207 || res.status === 200) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Wrong username or password." };
    if (res.status === 404) return { ok: false, error: "User folder not found on Copyparty." };
    return { ok: false, error: `Copyparty returned HTTP ${res.status}.` };
  } catch (e) {
    return { ok: false, error: "Network/CORS error contacting Copyparty. If Copyparty is on another domain, you likely need a VPS proxy or CORS enabled." };
  }
}
