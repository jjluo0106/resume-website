// Profile data (edit here only)
window.__PROFILE__ = {
  name: "阿哲",
  tagline: "這是一個部署在 AWS 上的 Serverless 自我介紹網站。",
  location: "台灣 / 可遠端（可自行調整）",
  email: "jjluo0106@gamil.com",
  github: "https://github.com/yourname",
  linkedin: "https://linkedin.com/in/yourname",
};

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value ?? "";
}

function setLink(id, href, text) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!href) {
    el.removeAttribute("href");
    el.textContent = text ?? "";
    return;
  }
  el.setAttribute("href", href);
  el.textContent = text ?? href.replace(/^https?:\/\//, "");
  el.setAttribute("rel", "noreferrer noopener");
  el.setAttribute("target", "_blank");
}

function applyProfile(profile) {
  if (!profile) return;
  setText(
    "profile-name",
    profile.name ? `你好，我是${profile.name}！` : "你好！",
  );
  setText("profile-tagline", profile.tagline ?? "");
  setText("profile-location", profile.location ?? "");

  const emailText = profile.email ?? "";
  const emailHref = emailText ? `mailto:${emailText}` : "";
  const emailEl = document.getElementById("profile-email");
  if (emailEl) {
    emailEl.setAttribute("href", emailHref);
    emailEl.textContent = emailText;
  }

  setLink("profile-github", profile.github, undefined);
  setLink("profile-linkedin", profile.linkedin, undefined);
}

window.addEventListener("DOMContentLoaded", () => {
  applyProfile(window.__PROFILE__);
});
