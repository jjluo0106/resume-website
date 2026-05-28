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

async function loadMessages() {
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("list");
  const keyInput = document.getElementById("admin-key");
  const apiUrl = window.__PROFILE__?.adminMessagesApiUrl;

  if (!statusEl || !listEl || !keyInput) return;
  if (!apiUrl) {
    statusEl.textContent =
      "尚未設定 adminMessagesApiUrl（請在 js/profile.js 填入部署後的端點）。";
    return;
  }

  const adminKey = String(keyInput.value || "").trim();
  if (!adminKey) {
    statusEl.textContent = "請先輸入 Admin Key。";
    return;
  }

  statusEl.textContent = "載入中…";
  listEl.innerHTML = "";

  try {
    const res = await fetch(`${apiUrl}?limit=30`, {
      method: "GET",
      headers: { "x-admin-key": adminKey, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 401) {
      statusEl.textContent = "Admin Key 不正確（401）。";
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
  const keyInput = document.getElementById("admin-key");
  const reloadBtn = document.getElementById("reload");
  if (!keyInput || !reloadBtn) return;

  const saved = localStorage.getItem("resume_admin_key") || "";
  if (saved) keyInput.value = saved;

  keyInput.addEventListener("change", () => {
    localStorage.setItem("resume_admin_key", String(keyInput.value || ""));
  });

  reloadBtn.addEventListener("click", loadMessages);

  // auto load if key exists
  if (keyInput.value) loadMessages();
});

