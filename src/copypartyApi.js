const BASE_RAW = (import.meta.env.VITE_COPYPARTY_BASE || "").trim();

function buildAuthHeader(username, password) {
  const token = btoa(`${username}:${password}`);
  return `Basic ${token}`;
}

function normalizeBase(raw) {
  const base = (raw || "").replace(/\/+$/, "");
  // You should be pointing at your SAME-ORIGIN proxy, ex: "/cp" or "https://spoons.cloud/cp"
  // If someone accidentally points this at jasondarby.com directly, CORS will break.
  if (!base) return { ok: false, error: "Missing VITE_COPYPARTY_BASE in .env.local (should be /cp)." };
  if (/^https?:\/\/(www\.)?jasondarby\.com\/?$/i.test(base) || /^https?:\/\/(www\.)?jasondarby\.com\//i.test(base)) {
    return { ok: false, error: 'VITE_COPYPARTY_BASE should be your proxy path ("/cp" or "https://spoons.cloud/cp"), not https://jasondarby.com (CORS).' };
  }
  return { ok: true, base };
}

export async function copypartyVerifyLogin(username, password) {
  const u = (username || "").trim();
  const p = (password || "").trim();
  if (!u || !p) return { ok: false, error: "Enter a username and password." };

  const nb = normalizeBase(BASE_RAW);
  if (!nb.ok) return nb;

  const base = nb.base;
  const url = `${base}/${encodeURIComponent(u)}/`;
  const body = '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>';

  try {
    const res = await fetch(url, {
      method: "PROPFIND",
      // IMPORTANT: let fetch follow redirects normally; "manual" can create weird results in browsers
      redirect: "follow",
      // IMPORTANT: avoid cookies/sessions; we only want Basic auth
      credentials: "omit",
      cache: "no-store",
      headers: {
        Authorization: buildAuthHeader(u, p),
        Depth: "0",
        "Content-Type": "text/xml",
        "Cache-Control": "no-store"
      },
      body
    });

    // Success: Copyparty WebDAV commonly returns 207 Multi-Status for PROPFIND
    if (res.status === 207 || res.status === 200) return { ok: true };

    // Wrong password (existing user) tends to be 401/403, and can trigger the browser auth popup
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Wrong password (or you don't have access)." };

    // Username/folder doesn't exist
    if (res.status === 404) return { ok: false, error: "No such user (folder not found)." };

    // Anything else: show the code so we can debug (409/5xx/etc)
    return { ok: false, error: `Copyparty returned HTTP ${res.status}.` };
  } catch (e) {
    return { ok: false, error: "Network/proxy error contacting Copyparty. If this is unexpected, verify /cp/ works from the VPS with curl." };
  }
}
