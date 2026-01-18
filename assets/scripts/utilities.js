document.addEventListener("DOMContentLoaded", () => {
  const currentPath = window.location.pathname;

  const normalizePath = (path) => {
    let normalized = path.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
    if (normalized !== "/" && !normalized.endsWith("/")) normalized += "/";
    return normalized || "/";
  };

  const normalizedCurrent = normalizePath(currentPath);

  document.querySelectorAll(".nav-link").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === "#") return;
    const normalizedHref = normalizePath(href);
    if (
      normalizedHref === normalizedCurrent ||
      (normalizedHref !== "/" && normalizedCurrent.startsWith(normalizedHref))
    ) {
      link.classList.add("active-nav");
    }
  });

  positionChipSeparators();
});

function positionChipSeparators() {
  document.querySelectorAll(".chip-rows").forEach((board) => {
    const label = board.querySelector(".chip-label");
    if (label)
      board.style.setProperty("--separator-left", `${label.offsetWidth}px`);
  });
}

function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

window.addEventListener("resize", debounce(positionChipSeparators, 100));
