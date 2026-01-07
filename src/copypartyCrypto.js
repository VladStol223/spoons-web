const MAGIC_STR = "SPOONSV1";
const NONCE_LEN = 16;
const enc = new TextEncoder();

function u8Concat(a, b) { const out = new Uint8Array(a.length + b.length); out.set(a, 0); out.set(b, a.length); return out; }

function u8Concat3(a, b, c) { return u8Concat(u8Concat(a, b), c); }

function bytesEqPrefix(buf, prefix) { if (buf.length < prefix.length) return false; for (let i = 0; i < prefix.length; i++) { if (buf[i] !== prefix[i]) return false; } return true; }

function ctr8be(n) { const out = new Uint8Array(8); let x = BigInt(n); for (let i = 7; i >= 0; i--) { out[i] = Number(x & 255n); x >>= 8n; } return out; }

async function kdf(password, username) {
  const pwBytes = enc.encode(password || "");
  const saltBytes = enc.encode((username || "spoons"));
  const keyMaterial = await crypto.subtle.importKey("raw", pwBytes, { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  return new Uint8Array(bits);
}

async function sha256(u8) {
  const digest = await crypto.subtle.digest("SHA-256", u8);
  return new Uint8Array(digest);
}

async function keystream(key, nonce, nbytes) {
  const out = new Uint8Array(nbytes);
  let written = 0;
  let ctr = 0;
  while (written < nbytes) {
    const block = await sha256(u8Concat3(key, nonce, ctr8be(ctr)));
    const need = Math.min(block.length, nbytes - written);
    out.set(block.subarray(0, need), written);
    written += need;
    ctr += 1;
  }
  return out;
}

export async function maybeDecryptDownload(blobU8, username, password) {
  const magic = enc.encode(MAGIC_STR);
  if (!bytesEqPrefix(blobU8, magic)) return blobU8;
  if (blobU8.length < magic.length + NONCE_LEN) return blobU8;
  const nonce = blobU8.subarray(magic.length, magic.length + NONCE_LEN);
  const ct = blobU8.subarray(magic.length + NONCE_LEN);
  const key = await kdf(password, username);
  const ks = await keystream(key, nonce, ct.length);
  const pt = new Uint8Array(ct.length);
  for (let i = 0; i < ct.length; i++) pt[i] = ct[i] ^ ks[i];
  return pt;
}

export async function encryptForUpload(plainU8, username, password) {
  const key = await kdf(password, username);
  const nonce = new Uint8Array(NONCE_LEN);
  crypto.getRandomValues(nonce);
  const ks = await keystream(key, nonce, plainU8.length);
  const ct = new Uint8Array(plainU8.length);
  for (let i = 0; i < plainU8.length; i++) ct[i] = plainU8[i] ^ ks[i];
  const magic = enc.encode(MAGIC_STR);
  const out = new Uint8Array(magic.length + nonce.length + ct.length);
  out.set(magic, 0);
  out.set(nonce, magic.length);
  out.set(ct, magic.length + nonce.length);
  return out;
}
