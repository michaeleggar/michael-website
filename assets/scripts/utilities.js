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

function saveThemePreference(preference) {
  memoryThemeOverride =
    preference === "light" || preference === "dark" ? preference : null;

  try {
    if (memoryThemeOverride) {
      localStorage.setItem(THEME_STORAGE_KEY, memoryThemeOverride);
    } else {
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch (error) {}
}

function getSystemTheme() {
  return themeMedia.matches ? "dark" : "light";
}

function getThemePreference() {
  return getSavedTheme() || "system";
}

function applyTheme(preference) {
  const currentTheme = preference === "system" ? getSystemTheme() : preference;

  if (preference === "light" || preference === "dark") {
    document.documentElement.dataset.theme = preference;
  } else {
    delete document.documentElement.dataset.theme;
  }

  updateThemeToggle(preference, currentTheme);
}

function updateThemeToggle(currentPreference, currentTheme) {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;

  toggle.dataset.currentTheme = currentTheme;
  toggle.dataset.currentPreference = currentPreference;

  toggle.querySelectorAll("[data-theme-option]").forEach((option) => {
    const isActive = option.dataset.themeOption === currentPreference;
    option.setAttribute("aria-pressed", String(isActive));
  });
}

function initThemeToggle() {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;

  applyTheme(getThemePreference());

  toggle.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;

    const option = event.target.closest("[data-theme-option]");
    if (!option || !toggle.contains(option)) return;

    const preference = option.dataset.themeOption;
    if (!["light", "dark", "system"].includes(preference)) return;

    saveThemePreference(preference);
    applyTheme(preference);
  });
}

function handleThemePreferenceChange() {
  if (!getSavedTheme()) {
    applyTheme("system");
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
