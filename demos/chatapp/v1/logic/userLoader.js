import {
  persistUsers,
  readStoredUsers,
  readUsersSeedFingerprint,
  persistUsersSeedFingerprint,
} from "./userStorage.js";
import { normalizeUser } from "./userUtils.js";

const computeFingerprint = async (text) => {
  if (typeof text !== "string" || !text) return null;
  const hasTextEncoder = typeof TextEncoder !== "undefined";
  const subtle =
    typeof globalThis !== "undefined" && globalThis.crypto
      ? globalThis.crypto.subtle
      : null;
  if (!hasTextEncoder || !subtle || typeof subtle.digest !== "function") {
    return text;
  }
  try {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((value) => value.toString(16).padStart(2, "0")).join("");
  } catch {
    return text;
  }
};

const normalizeUsers = (raw) =>
  Array.isArray(raw)
    ? raw.map((user) => normalizeUser(user)).filter((user) => user !== null)
    : [];

export const loadUsers = async () => {
  const storedUsers = readStoredUsers();
  const storedFingerprint = readUsersSeedFingerprint();
  const fallbackToStored = () => storedUsers ?? [];

  try {
    const response = await fetch("./data/users.json", { cache: "no-store" });
    if (!response.ok) {
      console.error("Failed to load users.json");
      return fallbackToStored();
    }

    const body = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (error) {
      console.error("Invalid users.json", error);
      return fallbackToStored();
    }

    if (!Array.isArray(parsed)) {
      console.error("users.json must contain an array of users.");
      return fallbackToStored();
    }

    const normalizedSeed = normalizeUsers(parsed);
    if (normalizedSeed.length === 0) {
      console.warn("users.json did not contain any valid users.");
      return fallbackToStored();
    }

    const fingerprint = await computeFingerprint(body);
    if (
      storedUsers &&
      storedUsers.length > 0 &&
      fingerprint &&
      storedFingerprint &&
      storedFingerprint === fingerprint
    ) {
      return storedUsers;
    }

    persistUsers(normalizedSeed);
    if (fingerprint) {
      persistUsersSeedFingerprint(fingerprint);
    }
    return normalizedSeed;
  } catch (error) {
    console.error("Invalid users.json", error);
    return fallbackToStored();
  }
};
