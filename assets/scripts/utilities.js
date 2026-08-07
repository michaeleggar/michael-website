const THEME_STORAGE_KEY = "michael-theme";
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
let memoryThemeOverride = null;

function getSavedTheme() {
  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    if (theme === "light" || theme === "dark" || theme === "system") {
      return theme;
    }
  } catch (error) {
    return memoryThemeOverride;
  }
  return memoryThemeOverride;
}

function saveThemePreference(preference) {
  memoryThemeOverride = ["light", "dark"].includes(preference)
    ? preference
    : null;

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

  if (preference === "light" || preference === "dark" || preference === "system") {
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
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  toggle.setAttribute(
    "aria-label",
    `${currentTheme === "dark" ? "Dark" : "Light"} theme active. ` +
      `Switch to ${nextTheme} theme`,
  );
  toggle.title = `Switch to ${nextTheme} theme`;
}

function initThemeToggle() {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;

  applyTheme(getThemePreference());

  toggle.addEventListener("click", () => {
    const nextTheme = toggle.dataset.currentTheme === "dark" ? "light" : "dark";
    saveThemePreference(nextTheme);
    applyTheme(nextTheme);
  });
}

function handleThemePreferenceChange() {
  if (getThemePreference() === "system") {
    applyTheme("system");
  }
}

document.addEventListener("DOMContentLoaded", initThemeToggle);
themeMedia.addEventListener("change", handleThemePreferenceChange);
