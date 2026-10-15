const TEMPLATE_STORAGE_KEY = "chat_app_legacy_templates";
const DEFAULT_TEMPLATE_DELAY = 0;

const normalizeDelayMs = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_TEMPLATE_DELAY;
  }
  return Math.round(numeric);
};

const sanitizeTemplate = (candidate) => {
  if (!candidate || typeof candidate !== "object") return null;
  const id =
    typeof candidate.id === "string" && candidate.id.trim().length > 0
      ? candidate.id.trim()
      : null;
  const userId =
    typeof candidate.userId === "string" && candidate.userId.trim().length > 0
      ? candidate.userId.trim()
      : null;
  const text =
    typeof candidate.text === "string" && candidate.text.trim().length > 0
      ? candidate.text
      : "";
  if (!id || !userId || !text) return null;
  const updatedAt =
    typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
      ? candidate.updatedAt
      : Date.now();
  const delayMs = normalizeDelayMs(candidate.delayMs);
  return { id, userId, text, updatedAt, delayMs };
};

const parseStoredTemplates = (raw) => {
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map((item) => sanitizeTemplate(item)).filter(Boolean);
  } catch (error) {
    console.error("Invalid stored templates payload", error);
    return [];
  }
};

export const readStoredTemplates = () => {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (raw === null) return [];
    return parseStoredTemplates(raw);
  } catch (error) {
    console.error("Failed to read stored templates", error);
    return [];
  }
};

export const persistTemplates = (templates) => {
  try {
    if (typeof localStorage === "undefined") return;
    const sanitized = Array.isArray(templates)
      ? templates.map((item) => sanitizeTemplate(item)).filter(Boolean)
      : [];
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (error) {
    console.error("Failed to persist templates", error);
  }
};

export const clearStoredTemplates = () => {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(TEMPLATE_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear stored templates", error);
  }
};
