import { loadUsers } from "./userLoader.js";
import { readStoredTemplates } from "./templateStorage.js";

const listeners = new Set();

const createInitialState = () => ({
  ready: false,
  users: [],
  templates: [],
  messages: [],
  currentUserId: null,
  prefs: {
    theme: "lightPastel",
    uiScale: 1,
    autosave: false,
    clockMode: "frozen",
  },
  view: {
    mode: "main", // "main" | `dm:<userId>`
  },
  typing: {},
  video: {
    state: "idle", // idle | requested | accepting | active | declined
    fromUserId: null,
    messageId: null,
  },
  take: {
    startedAt: null,
    timeline: [],
  },
});

let state = createInitialState();

export const getState = () => structuredClone(state);

export const subscribe = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const notify = () => {
  const snapshot = getState();
  listeners.forEach((callback) => callback(snapshot));
};

export const setState = (updater) => {
  const next = typeof updater === "function" ? updater(state) : updater;
  state = { ...state, ...next };
  notify();
};

export const resetState = () => {
  state = createInitialState();
  notify();
};

export const loadBaseline = async () => {
  const users = await loadUsers();
  const templates = readStoredTemplates();
  state = {
    ...state,
    ready: true,
    users,
    templates,
  };
  notify();
};
