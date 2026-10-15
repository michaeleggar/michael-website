import { normalizeUser } from "./userUtils.js";

const USERS_STORAGE_KEY = "chat_app_legacy_users";
const USERS_SEED_FINGERPRINT_KEY = "chat_app_legacy_users_seed_fp";

const parseStoredUsers = (raw) => {
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch (error) {
    console.error("Invalid stored users payload", error);
    return null;
  }
};

export const readStoredUsers = () => {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = parseStoredUsers(raw);
    if (!parsed) {
      localStorage.removeItem(USERS_STORAGE_KEY);
      return null;
    }
    return parsed
      .map((user) => normalizeUser(user))
      .filter((user) => user !== null);
  } catch (error) {
    console.error("Failed to read stored users", error);
    return null;
  }
};

export const persistUsers = (users) => {
  try {
    if (typeof localStorage === "undefined") return;
    const sanitized = Array.isArray(users)
      ? users
          .map((user) => normalizeUser(user))
          .filter((user) => user !== null)
      : [];
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (error) {
    console.error("Failed to persist users", error);
  }
};

export const readUsersSeedFingerprint = () => {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(USERS_SEED_FINGERPRINT_KEY);
  } catch (error) {
    console.error("Failed to read user seed fingerprint", error);
    return null;
  }
};

export const persistUsersSeedFingerprint = (fingerprint) => {
  try {
    if (typeof localStorage === "undefined" || typeof fingerprint !== "string") return;
    localStorage.setItem(USERS_SEED_FINGERPRINT_KEY, fingerprint);
  } catch (error) {
    console.error("Failed to persist user seed fingerprint", error);
  }
};

export const clearStoredUsers = () => {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(USERS_STORAGE_KEY);
    localStorage.removeItem(USERS_SEED_FINGERPRINT_KEY);
  } catch (error) {
    console.error("Failed to clear stored users", error);
  }
};
