const THEME_STORAGE_KEY = "michael-theme";

function getActiveTheme() {
  const theme = document.documentElement.dataset.theme;
  if (theme === "light" || theme === "dark") return theme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function updateThemeToggle(toggle) {
  const currentTheme = getActiveTheme();
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

  updateThemeToggle(toggle);

  toggle.addEventListener("click", () => {
    const nextTheme = getActiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (error) {}

    updateThemeToggle(toggle);
  });
}

document.addEventListener("DOMContentLoaded", initThemeToggle);
