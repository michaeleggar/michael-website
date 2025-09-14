function loadPart(url, partEl) {
  return fetch(url)
    .then((part) => part.text())
    .then((html) => {
      partEl.innerHTML = html;
    });
}

function highlightNav() {
  const currentPath = window.location.pathname.replace(/\/index\.html$/, "/");
  document.querySelectorAll(".nav-link").forEach((link) => {
    const hrefPath = link.pathname
      .replace(/\/index\.html$/i, "/")
      .replace(/\/+$/, "/");
    if (hrefPath === currentPath) {
      link.classList.add("active-nav");
    }
  });
}

function hydrateInclude(el) {
  const url = el.getAttribute("data-include");
  if (!url) return Promise.resolve();
  return loadPart(url, el).then(() => {
    el.dispatchEvent(new CustomEvent("include:loaded", { detail: { url } }));
  });
}

function hydrateAllIncludes() {
  const targets = Array.from(document.querySelectorAll("[data-include]"));
  return Promise.all(targets.map(hydrateInclude));
}

document.addEventListener("DOMContentLoaded", () => {
  hydrateAllIncludes().then(() => {
    highlightNav();
  });
});
