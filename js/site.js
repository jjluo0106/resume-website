function smoothAnchorScroll() {
  document.addEventListener("click", (e) => {
    const a =
      e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    const id = a.getAttribute("href");
    if (!id || id.length < 2) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function getVisitorCount() {
  const el = document.getElementById("v-count");
  if (!el) return;

  const apiUrl = window.__PROFILE__?.counterApiUrl;
  if (!apiUrl) {
    el.innerText = "—";
    return;
  }

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    el.innerText =
      data && typeof data.count !== "undefined" ? String(data.count) : "—";
  } catch (error) {
    console.error("撈取訪客計數失敗:", error);
    el.innerText = "系統維護中";
  }
}

function contactForm() {
  const form = document.getElementById("contact-form");
  const statusEl = document.getElementById("contact-status");
  if (!form || !statusEl) return;

  const apiUrl = window.__PROFILE__?.contactApiUrl;
  if (!apiUrl) {
    statusEl.textContent =
      "尚未設定 contactApiUrl（請先部署 infra/ 的 Serverless API）。";
    return;
  }

  const setStatus = (text, kind) => {
    statusEl.textContent = text;
    statusEl.dataset.kind = kind || "info";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("送出中…", "info");

    const fd = new FormData(form);
    const payload = {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      company: String(fd.get("company") || "").trim(),
      message: String(fd.get("message") || "").trim(),
      website: String(fd.get("website") || "").trim(), // honeypot
    };

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 429) {
        setStatus("送出太頻繁，請稍後再試。", "warn");
        return;
      }
      if (!res.ok) {
        setStatus("送出失敗，請稍後再試。", "error");
        return;
      }
      setStatus("已送出，謝謝你！我會盡快回覆。", "success");
      form.reset();
    } catch (err) {
      console.error("送出聯絡表單失敗:", err);
      setStatus("送出失敗（網路或系統問題），請稍後再試。", "error");
    }
  });
}

function initStairfallEmbed() {
  const iframe = document.getElementById("stairfall-iframe");
  const openLink = document.getElementById("stairfall-open-link");
  const url = window.__PROFILE__?.stairfallGameUrl?.trim();
  if (!url) return;
  if (iframe) iframe.src = url;
  if (openLink) {
    openLink.href = url;
    openLink.removeAttribute("aria-disabled");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  smoothAnchorScroll();
  getVisitorCount();
  contactForm();
  initStairfallEmbed();
});

