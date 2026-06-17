const THEME_STORAGE_KEY = "michael-theme";
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
let memoryThemeOverride = null;

function getSavedTheme() {
  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    if (theme === "light" || theme === "dark") return theme;
  } catch (error) {
    return memoryThemeOverride;
  }
  return memoryThemeOverride;
}

function saveTheme(theme) {
  memoryThemeOverride = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {}
}

function getSystemTheme() {
  return themeMedia.matches ? "dark" : "light";
}

function getCurrentTheme() {
  return getSavedTheme() || getSystemTheme();
}

function applyTheme(theme, isSavedOverride) {
  if (isSavedOverride) {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
  updateThemeToggle(theme);
}

function updateThemeToggle(currentTheme) {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;

  toggle.dataset.currentTheme = currentTheme;
  toggle.setAttribute("aria-checked", String(currentTheme === "dark"));
  toggle.setAttribute("aria-label", "Dark mode");
}

function initThemeToggle() {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;

  applyTheme(getCurrentTheme(), Boolean(getSavedTheme()));

  toggle.addEventListener("click", () => {
    const nextTheme = getCurrentTheme() === "dark" ? "light" : "dark";
    saveTheme(nextTheme);
    applyTheme(nextTheme, true);
  });
}

function handleThemePreferenceChange() {
  if (!getSavedTheme()) {
    applyTheme(getSystemTheme(), false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();

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

const mq = window.matchMedia("(min-width: 780px)");
function handleBreakpoint(e) {
  if (e.matches) {
    positionChipSeparators();
  }
}

mq.addEventListener("change", handleBreakpoint);
themeMedia.addEventListener("change", handleThemePreferenceChange);
