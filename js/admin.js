function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

import { ensureLoggedIn, startLogin, logout } from "./cognito-auth.js";

async function loadMessages() {
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("list");
  const apiUrl = window.__PROFILE__?.adminMessagesApiUrl;

  if (!statusEl || !listEl) return;
  if (!apiUrl) {
    statusEl.textContent =
      "尚未設定 adminMessagesApiUrl（請在 js/profile.js 填入部署後的端點）。";
    return;
  }

  const auth = await ensureLoggedIn();
  if (!auth.ok || !auth.token) {
    statusEl.textContent = "請先登入（Cognito）。";
    return;
  }

  statusEl.textContent = "載入中…";
  listEl.innerHTML = "";

  try {
    const res = await fetch(`${apiUrl}?limit=30`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (res.status === 401) {
      statusEl.textContent = "未授權（401）。請重新登入。";
      return;
    }
    if (!res.ok) {
      statusEl.textContent = `載入失敗（HTTP ${res.status}）。`;
      return;
    }
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];

    if (items.length === 0) {
      statusEl.textContent = "目前沒有訊息。";
      return;
    }

    statusEl.textContent = `已載入 ${items.length} 筆（最新在前）。`;
    listEl.innerHTML = items
      .map((x) => {
        const title = `${escapeHtml(x.name || "—")} · ${escapeHtml(
          x.email || "—",
        )}`;
        const meta = `${escapeHtml(fmtTime(x.createdAt))}${
          x.company ? ` · ${escapeHtml(x.company)}` : ""
        }`;
        const msg = escapeHtml(x.message || "");
        return `
          <div class="item card">
            <h3>${title}</h3>
            <div class="meta">${meta}</div>
            <pre>${msg}</pre>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("載入訊息失敗:", err);
    statusEl.textContent = "載入失敗（網路或系統問題）。";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("login");
  const logoutBtn = document.getElementById("logout");
  const reloadBtn = document.getElementById("reload");
  if (!reloadBtn) return;

  if (loginBtn) loginBtn.addEventListener("click", startLogin);
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  reloadBtn.addEventListener("click", loadMessages);

  // try auto-login if redirected back with code/token
  ensureLoggedIn().then((r) => {
    const authed = Boolean(r?.ok && r?.token);
    if (loginBtn) loginBtn.style.display = authed ? "none" : "inline-flex";
    if (logoutBtn) logoutBtn.style.display = authed ? "inline-flex" : "none";
    if (authed) loadMessages();
  });
});

