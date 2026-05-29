function base64UrlEncode(bytes) {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

function randomString(len = 64) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function getCfg() {
  const cfg = window.__PROFILE__?.cognitoAdminAuth;
  if (!cfg) return null;
  const region = String(cfg.region || "").trim();
  const domainPrefix = String(cfg.domainPrefix || "").trim();
  const clientId = String(cfg.clientId || "").trim();
  const redirectUri = String(cfg.redirectUri || "").trim();
  const logoutUri = String(cfg.logoutUri || "").trim();
  if (!region || !domainPrefix || !clientId || !redirectUri) return null;
  const domain = `https://${domainPrefix}.auth.${region}.amazoncognito.com`;
  return { region, domainPrefix, domain, clientId, redirectUri, logoutUri };
}

function setStatus(text) {
  const el = document.getElementById("auth-status");
  if (el) el.textContent = text;
}

function saveTokens(tokens) {
  sessionStorage.setItem("resume_admin_tokens", JSON.stringify(tokens));
}

function loadTokens() {
  try {
    return JSON.parse(sessionStorage.getItem("resume_admin_tokens") || "null");
  } catch {
    return null;
  }
}

function clearTokens() {
  sessionStorage.removeItem("resume_admin_tokens");
}

function parseQuery() {
  const url = new URL(window.location.href);
  return { url, code: url.searchParams.get("code"), error: url.searchParams.get("error") };
}

function clearAuthQuery(url) {
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  history.replaceState({}, document.title, url.toString());
}

export async function ensureLoggedIn() {
  const cfg = getCfg();
  if (!cfg) {
    setStatus("尚未設定 Cognito（請在 js/profile.js 填入 cognitoAdminAuth）。");
    return { ok: false, token: null, cfg: null };
  }

  const { url, code, error } = parseQuery();
  if (error) {
    setStatus(`登入失敗：${error}`);
    clearAuthQuery(url);
    return { ok: false, token: null, cfg };
  }

  const existing = loadTokens();
  if (existing?.id_token) {
    setStatus("已登入（使用本次瀏覽器工作階段）。");
    return { ok: true, token: existing.id_token, cfg };
  }

  if (code) {
    try {
      const verifier = sessionStorage.getItem("resume_pkce_verifier") || "";
      if (!verifier) throw new Error("Missing PKCE verifier");

      const form = new URLSearchParams();
      form.set("grant_type", "authorization_code");
      form.set("client_id", cfg.clientId);
      form.set("code", code);
      form.set("redirect_uri", cfg.redirectUri);
      form.set("code_verifier", verifier);

      const tokenRes = await fetch(`${cfg.domain}/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      if (!tokenRes.ok) throw new Error(`Token HTTP ${tokenRes.status}`);
      const tokens = await tokenRes.json();
      saveTokens(tokens);
      sessionStorage.removeItem("resume_pkce_verifier");
      setStatus("已登入（剛完成授權）。");
      clearAuthQuery(url);
      return { ok: true, token: tokens.id_token, cfg };
    } catch (e) {
      console.error("交換 token 失敗:", e);
      setStatus("登入失敗（token 交換失敗）。");
      clearAuthQuery(url);
      return { ok: false, token: null, cfg };
    }
  }

  setStatus("尚未登入。");
  return { ok: false, token: null, cfg };
}

export async function startLogin() {
  const cfg = getCfg();
  if (!cfg) return;
  const verifier = randomString(64);
  const challenge = base64UrlEncode(await sha256(verifier));
  sessionStorage.setItem("resume_pkce_verifier", verifier);

  const state = randomString(16);
  const u = new URL(`${cfg.domain}/oauth2/authorize`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("code_challenge", challenge);
  window.location.assign(u.toString());
}

export async function logout() {
  const cfg = getCfg();
  clearTokens();
  if (!cfg?.logoutUri) {
    window.location.reload();
    return;
  }
  const u = new URL(`${cfg.domain}/logout`);
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("logout_uri", cfg.logoutUri);
  window.location.assign(u.toString());
}

