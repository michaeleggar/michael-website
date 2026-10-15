import { bus } from "./bus.js";
import { getState, subscribe, setState, loadBaseline } from "./store.js";
import { createUserTemplate, cloneUser, normalizeUser } from "./userUtils.js";
import { persistUsers } from "./userStorage.js";
import { persistTemplates } from "./templateStorage.js";

const presenceChannel = window.BroadcastChannel
  ? new BroadcastChannel("chat_app_legacy_presence")
  : null;

const elements = {};
const templateEditorState = {
  templateId: null,
};
const modalState = {
  mode: null, // "edit" | "create"
  originalUserId: null,
};
const confirmState = {
  action: null,
  payload: null,
};
const SCALE_DEFAULT = 1;
const SCALE_MIN = 0.5;
const SCALE_MAX = 2.5;
const SCALE_STEP = 0.1;

const clampScale = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return SCALE_DEFAULT;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, numeric));
};

const normalizeScale = (value) => {
  const clamped = clampScale(value);
  return Math.round(clamped * 100) / 100;
};

const formatScalePercent = (value) => `${Math.round(value * 100)}%`;

const timeline = [];

const wait = (duration) =>
  new Promise((resolve) => {
    const delay = Math.max(0, Math.round(Number(duration) || 0));
    window.setTimeout(resolve, delay);
  });

const secondsToMilliseconds = (seconds) => {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.round(numeric * 1000);
};

const millisecondsToSeconds = (ms) => {
  const numeric = Number(ms);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.max(0, numeric) / 1000;
};

const parseDelaySecondsValue = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string" && value.trim() === "") {
    return 0;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  if (numeric === 0) return 0;
  return secondsToMilliseconds(numeric);
};

const formatDelaySecondsValue = (delayMs) => {
  const seconds = millisecondsToSeconds(delayMs);
  if (!seconds) {
    return "0";
  }
  return `${Number(seconds.toFixed(3))}`;
};

const formatDelayLabel = (delayMs) => {
  const seconds = millisecondsToSeconds(delayMs);
  if (!seconds) return "0s";
  if (seconds >= 10) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds >= 1) {
    const precision = seconds % 1 === 0 ? 0 : 1;
    return `${Number(seconds.toFixed(precision))}s`;
  }
  return `${Number(seconds.toFixed(2))}s`;
};

const templateTypingTracker = new Map();
const typingStateMeta = new Map();
const typingUserAliases = new Map();

const resolveTypingUserId = (userId) => {
  if (!userId) return userId;
  let current = userId;
  const visited = new Set();
  while (typingUserAliases.has(current) && !visited.has(current)) {
    visited.add(current);
    current = typingUserAliases.get(current);
  }
  visited.forEach((alias) => typingUserAliases.set(alias, current));
  return current;
};

const transferTypingArtifacts = (fromId, toId) => {
  if (!fromId || !toId || fromId === toId) return;
  const sourceId = resolveTypingUserId(fromId);
  const targetId = resolveTypingUserId(toId);
  if (sourceId === targetId) {
    typingUserAliases.set(fromId, targetId);
    return;
  }
  if (typingStateMeta.has(sourceId)) {
    const meta = typingStateMeta.get(sourceId);
    typingStateMeta.set(targetId, meta);
    typingStateMeta.delete(sourceId);
  }
  if (templateTypingTracker.has(sourceId)) {
    const entry = templateTypingTracker.get(sourceId);
    templateTypingTracker.set(targetId, entry);
    templateTypingTracker.delete(sourceId);
  }
  typingUserAliases.set(fromId, targetId);
  typingUserAliases.set(sourceId, targetId);
};

const clearTypingArtifacts = (userId) => {
  if (!userId) return;
  const canonicalId = resolveTypingUserId(userId);
  typingStateMeta.delete(canonicalId);
  templateTypingTracker.delete(canonicalId);
  const aliasKeys = [];
  typingUserAliases.forEach((target, key) => {
    if (key === canonicalId || target === canonicalId) {
      aliasKeys.push(key);
    }
  });
  aliasKeys.forEach((key) => typingUserAliases.delete(key));
};

const templateTypingStillActive = (userId, version) => {
  if (!userId || !version) return false;
  const meta = typingStateMeta.get(userId);
  if (!meta) return false;
  return Boolean(meta.typing) && meta.source === "template" && meta.version === version;
};

const releaseTemplateTyping = (userId) => {
  const targetId = resolveTypingUserId(userId);
  if (!targetId) return;
  const entry = templateTypingTracker.get(targetId);
  if (!entry) return;
  const nextCount = entry.count - 1;
  if (nextCount <= 0) {
    templateTypingTracker.delete(targetId);
    if (templateTypingStillActive(targetId, entry.version)) {
      applyTypingState(targetId, false, { source: "template" });
      bus.publish("typingStop", { userId: targetId });
    }
    return;
  }
  templateTypingTracker.set(targetId, { ...entry, count: nextCount });
};

const acquireTemplateTyping = (userId) => {
  const targetId = resolveTypingUserId(userId);
  if (!targetId) return () => {};
  const entry = templateTypingTracker.get(targetId) ?? { count: 0, version: null };
  const typingActive = Boolean(getState().typing[targetId]);
  const shouldStart = entry.count === 0 && !typingActive;
  let version = entry.version ?? null;
  if (shouldStart) {
    const meta = applyTypingState(targetId, true, { source: "template" });
    bus.publish("typingStart", { userId: targetId });
    version = meta?.version ?? null;
  }
  templateTypingTracker.set(targetId, {
    count: entry.count + 1,
    version,
  });
  return () => releaseTemplateTyping(userId);
};

const COLOR_PICKER_DEFAULT = "#6b90b1";
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}){1,2}$/i;

const persistCurrentUsers = () => {
  const state = getState();
  persistUsers(state.users);
};

const applyTypingState = (userId, typing, options = {}) => {
  const targetId = resolveTypingUserId(userId);
  if (!targetId) return null;
  const nextTypingState = Boolean(typing);
  const snapshot = getState();
  const current = Boolean(snapshot.typing[targetId]);
  const previousMeta = typingStateMeta.get(targetId);
  const nextMeta = {
    typing: nextTypingState,
    source: options.source ?? "system",
    updatedAt: Date.now(),
    version: (previousMeta?.version ?? 0) + 1,
  };
  typingStateMeta.set(targetId, nextMeta);
  if (current === nextTypingState) {
    return nextMeta;
  }
  setState((prev) => {
    const nextTyping = { ...prev.typing };
    if (nextTypingState) {
      nextTyping[targetId] = true;
    } else {
      delete nextTyping[targetId];
    }
    return { ...prev, typing: nextTyping };
  });
  return nextMeta;
};

const appendTimeline = (entry) => {
  const timestamp = new Date().toLocaleTimeString();
  timeline.unshift(`[${timestamp}] ${entry}`);
  renderTimeline();
};

const renderTimeline = () => {
  const log = elements.timelineLog;
  if (!log) return;
  log.innerHTML = timeline
    .slice(0, 40)
    .map((line) => `<div class="timeline__log-item">${line}</div>`)
    .join("");
};

const rosterInitial = (user) => {
  const manual =
    typeof user?.avatarInitial === "string" ? user.avatarInitial.trim() : "";
  if (manual) {
    return Array.from(manual)[0] ?? "";
  }
  const source =
    user?.displayName && user.displayName.trim()
      ? user.displayName
      : user?.id ?? "";
  const trimmed = source.trim();
  const [glyph] = Array.from(trimmed);
  return glyph ? glyph.toUpperCase() : "?";
};

const setRosterAvatar = (element, user) => {
  if (!element) return;
  element.innerHTML = "";
  element.style.background = user?.color ?? "var(--surface-accent-soft)";
  element.style.color = "var(--text-contrast)";
  element.textContent = rosterInitial(user);
};

const normalizeHexColor = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!HEX_COLOR_RE.test(trimmed)) return null;
  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
};

const colorStringToPickerValue = (value) => {
  const normalized = normalizeHexColor(value);
  if (normalized) return normalized;
  if (typeof value !== "string" || !value.trim()) return null;
  if (!document?.body) return null;
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.left = "-9999px";
  probe.style.top = "0";
  probe.style.width = "0";
  probe.style.height = "0";
  probe.style.color = value;
  document.body.append(probe);
  let computed = "";
  try {
    computed = getComputedStyle(probe).color;
  } finally {
    probe.remove();
  }
  const match =
    computed &&
    computed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(?:\d+(?:\.\d+)?|\.\d+))?\)$/i);
  if (!match) return null;
  const [, r, g, b] = match;
  const toHex = (component) => {
    const numeric = Number(component);
    if (!Number.isFinite(numeric)) return "00";
    return Math.max(0, Math.min(255, numeric)).toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const formatBadgesField = (badges) =>
  Array.isArray(badges) && badges.length ? badges.join(", ") : "";

const parseBadgesField = (value) =>
  typeof value === "string"
    ? value
        .split(",")
        .map((badge) => badge.trim())
        .filter(Boolean)
    : [];

const sanitizeAvatarInitial = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const [glyph] = Array.from(trimmed);
  return glyph ?? "";
};

const syncColorPickerToInput = () => {
  const input = elements.userEditorColorInput;
  const picker = elements.userEditorColorPicker;
  if (!input || !picker) return;
  const hex = colorStringToPickerValue(input.value) ?? COLOR_PICKER_DEFAULT;
  picker.value = hex;
};

const handleUserEditorColorPickerInput = () => {
  const picker = elements.userEditorColorPicker;
  const input = elements.userEditorColorInput;
  if (!picker || !input) return;
  if (picker.value) {
    input.value = picker.value;
  }
};

const handleUserEditorColorTextChange = () => {
  const picker = elements.userEditorColorPicker;
  if (!picker) return;
  const hex = colorStringToPickerValue(elements.userEditorColorInput?.value ?? "");
  if (hex) {
    picker.value = hex;
  }
};

const fillUserEditorForm = (source) => {
  if (!source) return;
  if (elements.userEditorDisplayName) {
    elements.userEditorDisplayName.value = source.displayName ?? "";
  }
  if (elements.userEditorColorInput) {
    elements.userEditorColorInput.value = source.color ?? "";
  }
  if (elements.userEditorAvatarInitial) {
    elements.userEditorAvatarInitial.value = source.avatarInitial ?? "";
  }
  if (elements.userEditorBio) {
    elements.userEditorBio.value = source.bio ?? "";
  }
  if (elements.userEditorBadges) {
    elements.userEditorBadges.value = formatBadgesField(source.badges);
  }
  if (elements.userEditorOnline) {
    elements.userEditorOnline.checked = Boolean(source.online);
  }
  if (elements.userEditorHidden) {
    elements.userEditorHidden.checked = Boolean(source.hidden);
  }
  syncColorPickerToInput();
};

const resetUserEditorForm = () => {
  elements.userEditorForm?.reset();
  if (elements.userEditorColorPicker) {
    elements.userEditorColorPicker.value = COLOR_PICKER_DEFAULT;
  }
};

const collectUserEditorFormData = () => {
  const displayName = elements.userEditorDisplayName?.value ?? "";
  const color = elements.userEditorColorInput?.value ?? "";
  const bio = elements.userEditorBio?.value ?? "";
  const badgesValue = elements.userEditorBadges?.value ?? "";
  const avatarInitial = sanitizeAvatarInitial(elements.userEditorAvatarInitial?.value ?? "");
  return {
    displayName: displayName.trim(),
    color: color.trim(),
    bio: bio.trim(),
    badges: parseBadgesField(badgesValue),
    avatarInitial,
    online: Boolean(elements.userEditorOnline?.checked),
    hidden: Boolean(elements.userEditorHidden?.checked),
  };
};

const describeThreadLabel = (thread, users = []) => {
  if (!thread || thread === "main") return "main chat";
  if (thread.startsWith("dm:")) {
    const [, userId] = thread.split(":");
    const dmUser = users.find((user) => user.id === userId);
    return dmUser ? `DM with ${dmUser.displayName}` : "direct message";
  }
  return thread;
};

const resolveUserName = (userId, users) => {
  if (!userId) return "Member";
  return users.find((user) => user.id === userId)?.displayName ?? userId ?? "Member";
};

const createToggle = ({ userId, key, label, checked }) => {
  const wrapper = document.createElement("label");
  wrapper.className = "toggle";
  wrapper.innerHTML = `
    <input type="checkbox" ${checked ? "checked" : ""} data-toggle="${key}" data-user="${userId}" />
    <span>${label}</span>
  `;
  return wrapper;
};

const modalOpen = () =>
  [elements.userEditorModal, elements.templateEditorModal, elements.confirmModal].some(
    (modal) => modal && !modal.hidden,
  );

const setModalVisibility = (modal, visible) => {
  if (!modal) return;
  modal.hidden = !visible;
  if (visible) {
    modal.setAttribute("aria-hidden", "false");
  } else {
    modal.setAttribute("aria-hidden", "true");
  }
};

const showUserEditorError = (message) => {
  if (!elements.userEditorError) return;
  elements.userEditorError.textContent = message;
  elements.userEditorError.hidden = !message;
};

const clearUserEditorError = () => showUserEditorError("");

const openUserEditor = ({ mode, user }) => {
  if (!elements.userEditorModal) return;
  modalState.mode = mode;
  modalState.originalUserId = user?.id ?? null;
  const isEdit = mode === "edit" && user;
  const source = isEdit ? cloneUser(user) : createUserTemplate();
  const title = isEdit ? `Edit ${user.displayName ?? "User"}` : "New User";
  const cta = isEdit ? "Save" : "Create";
  elements.userEditorTitle.textContent = title;
  elements.userEditorSave.textContent = cta;
  fillUserEditorForm(source);
  clearUserEditorError();
  setModalVisibility(elements.userEditorModal, true);
  window.requestAnimationFrame(() => {
    elements.userEditorDisplayName?.focus();
    elements.userEditorDisplayName?.select();
  });
};

const closeUserEditor = () => {
  modalState.mode = null;
  modalState.originalUserId = null;
  resetUserEditorForm();
  clearUserEditorError();
  setModalVisibility(elements.userEditorModal, false);
};

const openConfirm = ({
  title,
  message,
  confirmLabel = "Confirm",
  action,
  payload = null,
  destructive = false,
}) => {
  if (!elements.confirmModal) return;
  confirmState.action = action;
  confirmState.payload = payload;
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmConfirm.textContent = confirmLabel;
  elements.confirmConfirm.classList.toggle("destructive", Boolean(destructive));
  setModalVisibility(elements.confirmModal, true);
  elements.confirmConfirm.focus();
};

const closeConfirm = () => {
  confirmState.action = null;
  confirmState.payload = null;
  setModalVisibility(elements.confirmModal, false);
};

const showTemplateEditorError = (message) => {
  if (!elements.templateEditorError) return;
  elements.templateEditorError.textContent = message;
  elements.templateEditorError.hidden = !message;
};

const clearTemplateEditorError = () => showTemplateEditorError("");

const openTemplateEditor = (template) => {
  if (!template || !elements.templateEditorModal) return;
  templateEditorState.templateId = template.id;
  const snapshot = getState();
  const userLabel = resolveUserName(template.userId, snapshot.users);
  elements.templateEditorTitle.textContent = "Edit saved message";
  if (elements.templateEditorUser) {
    elements.templateEditorUser.textContent = `Sending as ${userLabel}`;
  }
  elements.templateEditorForm?.reset();
  if (elements.templateEditorMessage) {
    elements.templateEditorMessage.value = template.text ?? "";
  }
  if (elements.templateEditorDelay) {
    elements.templateEditorDelay.value = formatDelaySecondsValue(Number(template.delayMs) || 0);
  }
  clearTemplateEditorError();
  setModalVisibility(elements.templateEditorModal, true);
  window.requestAnimationFrame(() => {
    elements.templateEditorMessage?.focus();
    elements.templateEditorMessage?.select();
  });
};

const closeTemplateEditor = () => {
  templateEditorState.templateId = null;
  if (elements.templateEditorUser) {
    elements.templateEditorUser.textContent = "";
  }
  elements.templateEditorForm?.reset();
  if (elements.templateEditorDelay) {
    elements.templateEditorDelay.value = "0";
  }
  clearTemplateEditorError();
  setModalVisibility(elements.templateEditorModal, false);
};

const applyTemplateEditorChanges = () => {
  const templateId = templateEditorState.templateId;
  if (!templateId) return false;
  const snapshot = getState();
  const template = snapshot.templates.find((item) => item.id === templateId);
  if (!template) {
    showTemplateEditorError("Template no longer exists.");
    return false;
  }
  const messageValue = (elements.templateEditorMessage?.value ?? "").trim();
  if (!messageValue) {
    showTemplateEditorError("Message cannot be empty.");
    return false;
  }
  const delayInput = elements.templateEditorDelay?.value ?? "0";
  const parsedDelay = parseDelaySecondsValue(delayInput);
  if (parsedDelay === null) {
    showTemplateEditorError("Typing delay must be zero or greater.");
    return false;
  }
  const nextDelayMs = parsedDelay ?? 0;
  const initialText = template.text ?? "";
  const initialDelayMs = Number(template.delayMs) || 0;
  if (messageValue === initialText && nextDelayMs === initialDelayMs) {
    appendTimeline("Template update skipped: no changes were made.");
    closeTemplateEditor();
    return true;
  }
  const nextTemplates = snapshot.templates.map((item) =>
    item.id === templateId
      ? { ...item, text: messageValue, delayMs: nextDelayMs, updatedAt: Date.now() }
      : item,
  );
  setState((prev) => ({
    ...prev,
    templates: nextTemplates,
  }));
  persistTemplates(nextTemplates);
  appendTimeline(`Updated template for ${resolveUserName(template.userId, snapshot.users)}.`);
  closeTemplateEditor();
  return true;
};

const handleTemplateEditorSubmit = (event) => {
  event.preventDefault();
  clearTemplateEditorError();
  applyTemplateEditorChanges();
};

const deleteUserById = (userId) => {
  const state = getState();
  const user = state.users.find((u) => u.id === userId);
  if (!user) return;
  setState((prev) => {
    const users = prev.users.filter((u) => u.id !== userId);
    const typing = { ...prev.typing };
    delete typing[userId];
    const messages = prev.messages.filter((message) => message.userId !== userId);
    let view = prev.view;
    if (prev.view?.mode === `dm:${userId}`) {
      view = { ...prev.view, mode: "main" };
    }
    return {
      ...prev,
      users,
      typing,
      messages,
      view,
    };
  });
  clearTypingArtifacts(userId);
  persistCurrentUsers();
  bus.publish("userRemoved", { userId });
  appendTimeline(`Deleted user ${user.displayName}.`);
};

const applyConfirmAction = () => {
  switch (confirmState.action) {
    case "deleteUser": {
      const userId = confirmState.payload?.userId;
      if (userId) {
        deleteUserById(userId);
      }
      break;
    }
    case "resetClient": {
      resetChatClient();
      break;
    }
    case "deleteTemplate": {
      const templateId = confirmState.payload?.templateId;
      if (templateId) {
        deleteTemplateById(templateId);
      }
      break;
    }
    default:
      break;
  }
  closeConfirm();
};

const handleUserEditorSave = () => {
  if (!modalState.mode) return;
  const form = elements.userEditorForm;
  if (form && typeof form.reportValidity === "function" && !form.reportValidity()) {
    return;
  }
  clearUserEditorError();

  const draft = collectUserEditorFormData();
  const fallbackId = modalState.mode === "edit" ? modalState.originalUserId ?? undefined : undefined;
  const normalized = normalizeUser(draft, { fallbackId });
  if (!normalized) {
    showUserEditorError("Please review the user details and try again.");
    return;
  }

  const state = getState();
  const duplicate = state.users.some(
    (u) =>
      u.id === normalized.id &&
      (modalState.mode !== "edit" || u.id !== modalState.originalUserId),
  );
  if (duplicate) {
    showUserEditorError(`User with id "${normalized.id}" already exists.`);
    return;
  }

  if (modalState.mode === "edit" && modalState.originalUserId) {
    const previousId = modalState.originalUserId;
    const existing = state.users.find((u) => u.id === previousId);
    if (!existing) {
      showUserEditorError("User no longer exists.");
      return;
    }
    const idChanged = normalized.id !== previousId;
    setState((prev) => {
      const users = prev.users.map((u) => (u.id === previousId ? normalized : u));
      const typing = { ...prev.typing };
      if (idChanged && typing[previousId]) {
        typing[normalized.id] = typing[previousId];
        delete typing[previousId];
      }
      const messages = prev.messages.map((message) =>
        message.userId === previousId ? { ...message, userId: normalized.id } : message,
      );
      let view = prev.view;
      if (prev.view?.mode === `dm:${previousId}`) {
        view = { ...prev.view, mode: `dm:${normalized.id}` };
      }
      return {
        ...prev,
        users,
        typing,
        messages,
        view,
      };
    });
    if (idChanged) {
      transferTypingArtifacts(previousId, normalized.id);
    }
    persistCurrentUsers();
    if (idChanged) {
      bus.publish("userRemoved", { userId: previousId, redirectTo: normalized.id });
    }
    bus.publish("userUpdated", { user: normalized });
    if (existing.online !== normalized.online) {
      bus.publish("presence", { userId: normalized.id, online: normalized.online });
    }
    appendTimeline(`Updated user ${normalized.displayName}.`);
  } else if (modalState.mode === "create") {
    setState((prev) => ({
      ...prev,
      users: [...prev.users, normalized],
    }));
    persistCurrentUsers();
    bus.publish("userUpdated", { user: normalized });
    if (normalized.online) {
      bus.publish("presence", { userId: normalized.id, online: true });
    }
    appendTimeline(`Added user ${normalized.displayName}.`);
  }

  closeUserEditor();
};

const handleUserEditorFormSubmit = (event) => {
  event.preventDefault();
  handleUserEditorSave();
};

const handleRosterClick = (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const actionEl = target.closest("[data-action]");
  if (!(actionEl instanceof HTMLElement)) return;
  const { action, user: userId } = actionEl.dataset;
  if (!action || !userId) return;
  const state = getState();
  const user = state.users.find((u) => u.id === userId);
  if (!user) return;
  if (action === "dm") {
    switchToDmView(userId);
    return;
  }
  if (action === "edit") {
    openUserEditor({ mode: "edit", user });
  }
  if (action === "delete") {
    openConfirm({
      title: "Delete User",
      message: `Are you sure you want to delete ${user.displayName}? This cannot be undone.`,
      confirmLabel: "Delete",
      action: "deleteUser",
      payload: { userId },
      destructive: true,
    });
  }
};

const handleAddUser = () => {
  openUserEditor({ mode: "create" });
};

const renderRoster = (state) => {
  const rosterEl = elements.rosterList;
  if (!rosterEl) return;
  rosterEl.innerHTML = "";
  state.users.forEach((user) => {
    const item = document.createElement("article");
    item.className = "roster__item";
    item.dataset.userId = user.id ?? "";

    const avatar = document.createElement("div");
    avatar.className = "roster__avatar";
    setRosterAvatar(avatar, user);

    const meta = document.createElement("div");
    meta.className = "roster__meta";
    const name = document.createElement("div");
    name.className = "roster__name";
    name.textContent = user.displayName;
    if (user.hidden) {
      const hiddenTag = document.createElement("span");
      hiddenTag.className = "roster__tag roster__tag--hidden";
      hiddenTag.textContent = "Hidden";
      name.append(" ", hiddenTag);
    }
    meta.append(name);

    const toggles = document.createElement("div");
    toggles.className = "roster__toggles";
    const typingActive = state.typing[user.id] ?? false;
    toggles.append(
      createToggle({
        userId: user.id,
        key: "online",
        label: "Online",
        checked: Boolean(user.online),
      }),
      createToggle({
        userId: user.id,
        key: "typing",
        label: "Typing",
        checked: typingActive,
      }),
      createToggle({
        userId: user.id,
        key: "hidden",
        label: "Hide",
        checked: Boolean(user.hidden),
      }),
    );

    const actions = document.createElement("div");
    actions.className = "roster__actions";

    const editDeleteGroup = document.createElement("div");
    editDeleteGroup.className = "roster__actions-row";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "roster__actionBtn";
    editButton.textContent = "Edit";
    editButton.title = `Edit ${user.displayName}`;
    editButton.setAttribute("aria-label", `Edit ${user.displayName}`);
    editButton.dataset.action = "edit";
    editButton.dataset.user = user.id;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "roster__actionBtn control__danger-btn";
    deleteButton.textContent = "Delete";
    deleteButton.title = `Delete ${user.displayName}`;
    deleteButton.setAttribute("aria-label", `Delete ${user.displayName}`);
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.user = user.id;

    editDeleteGroup.append(editButton, deleteButton);

    const dmButton = document.createElement("button");
    dmButton.type = "button";
    dmButton.className = "roster__actionBtn roster__actionBtn--wide";
    dmButton.textContent = "Switch to DM";
    dmButton.title = `Switch to DM with ${user.displayName}`;
    dmButton.setAttribute("aria-label", `Switch to DM with ${user.displayName}`);
    dmButton.dataset.action = "dm";
    dmButton.dataset.user = user.id;

    actions.append(editDeleteGroup, dmButton);

    const settings = document.createElement("div");
    settings.className = "roster__settings";
    settings.append(toggles, actions);

    item.append(avatar, meta, settings);
    rosterEl.append(item);
  });
};

const renderTemplates = (state) => {
  const listEl = elements.templateList;
  if (!listEl) return;
  listEl.innerHTML = "";
  const templates = Array.isArray(state.templates) ? state.templates : [];
  if (!templates.length) {
    const empty = document.createElement("p");
    empty.className = "template-list__empty";
    empty.textContent = "No saved templates yet.";
    listEl.append(empty);
    return;
  }
  templates.forEach((template) => {
    const card = document.createElement("article");
    card.className = "template-card";
    card.dataset.templateId = template.id;
    const delayMs = Number(template.delayMs) || 0;

    const entry = document.createElement("p");
    entry.className = "template-card__entry";
    const userLabel = document.createElement("span");
    userLabel.className = "template-card__user";
    userLabel.textContent = `${resolveUserName(template.userId, state.users)}:`;
    entry.append(userLabel, document.createTextNode(` ${template.text}`));

    const actions = document.createElement("div");
    actions.className = "template-card__actions";

    const createActionButton = (label, action, extraClass = "") => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `roster__actionBtn template-card__actionBtn${
        extraClass ? ` ${extraClass}` : ""
      }`;
      button.textContent = label;
      button.dataset.templateAction = action;
      button.dataset.templateId = template.id;
      return button;
    };

    actions.append(
      createActionButton("Send", "send"),
      createActionButton("Edit", "edit"),
      createActionButton("Delete", "delete", "control__danger-btn"),
    );

    card.append(entry);
    if (delayMs > 0) {
      const delayMeta = document.createElement("p");
      delayMeta.className = "template-card__meta";
      delayMeta.textContent = `Typing delay: ${formatDelayLabel(delayMs)}`;
      card.append(delayMeta);
    }
    card.append(actions);
    listEl.append(card);
  });
};

const describeView = (mode, users = []) => {
  if (!mode || mode === "main") {
    return "Main chat";
  }
  if (mode.startsWith("dm:")) {
    const userId = mode.slice(3);
    const user = users.find((u) => u.id === userId);
    return user ? `DM with ${user.displayName}` : `DM with ${userId}`;
  }
  return mode;
};

const renderSelectors = (state) => {
  const { sendAs, dmTarget, videoRequester, activeUserSelect } = elements;
  const users = state.users;

  const syncSelect = (select, preferredValue, filterFn = () => true) => {
    if (!select) return "";
    const filtered = users.filter(filterFn);
    if (!filtered.length) {
      select.innerHTML = "";
      select.value = "";
      select.disabled = true;
      return "";
    }
    select.disabled = false;
    select.innerHTML = filtered
      .map((user) => `<option value="${user.id}">${user.displayName}</option>`)
      .join("");
    const nextValue =
      preferredValue && filtered.some((user) => user.id === preferredValue)
        ? preferredValue
        : filtered[0].id;
    select.value = nextValue;
    return nextValue;
  };

  syncSelect(sendAs, sendAs?.value);
  const viewMode = state.view?.mode ?? "";
  const dmPreferred = viewMode.startsWith("dm:")
    ? viewMode.slice(3)
    : dmTarget?.value;
  syncSelect(dmTarget, dmPreferred);
  syncSelect(videoRequester, videoRequester?.value);
  const activePreferred = state.currentUserId ?? activeUserSelect?.value;
  syncSelect(activeUserSelect, activePreferred, (user) => !user.hidden);
};

const renderPrefs = (state) => {
  const scale = normalizeScale(state?.prefs?.uiScale ?? SCALE_DEFAULT);
  if (elements.scaleValue) {
    elements.scaleValue.textContent = formatScalePercent(scale);
  }
  if (elements.scaleDecreaseBtn) {
    elements.scaleDecreaseBtn.disabled = scale <= SCALE_MIN;
  }
  if (elements.scaleIncreaseBtn) {
    elements.scaleIncreaseBtn.disabled = scale >= SCALE_MAX;
  }
};

const render = (state) => {
  renderRoster(state);
  renderSelectors(state);
  renderTemplates(state);
  renderPrefs(state);
};

const announceReady = () => {
  presenceChannel?.postMessage({ type: "windowReady", window: "control" });
};

const handleExternalViewSwitch = ({ view }) => {
  if (typeof view !== "string" || view.length === 0) return;
  const currentMode = getState().view?.mode ?? "main";
  if (currentMode === view) return;
  setState((prev) => ({
    ...prev,
    view: { ...prev.view, mode: view },
  }));
  const latestState = getState();
  const label = describeView(view, latestState.users);
  appendTimeline(`Screen switched to ${label}; control synced view.`);
};

const handleExternalMessageCreate = (payload) => {
  if (!payload?.id) return;
  let inserted = false;
  setState((prev) => {
    if (prev.messages.some((message) => message.id === payload.id)) {
      return prev;
    }
    inserted = true;
    return { ...prev, messages: [...prev.messages, payload] };
  });
  if (!inserted) return;
  const snapshot = getState();
  const author = resolveUserName(payload.userId, snapshot.users);
  const threadLabel = describeThreadLabel(payload.thread, snapshot.users);
  appendTimeline(`Screen sent message as ${author} (${threadLabel}).`);
};

const handleExternalMessageDelete = ({ messageId }) => {
  if (!messageId) return;
  const snapshot = getState();
  const targetMessage = snapshot.messages.find((message) => message.id === messageId);
  if (!targetMessage) return;
  setState((prev) => {
    const nextState = {
      ...prev,
      messages: prev.messages.filter((message) => message.id !== messageId),
    };
    if (prev.video?.messageId === messageId) {
      nextState.video = {
        ...prev.video,
        state: "idle",
        fromUserId: null,
        messageId: null,
      };
    }
    return nextState;
  });
  const author =
    snapshot.users.find((user) => user.id === targetMessage.userId)?.displayName ??
    targetMessage.userId ??
    "Unknown member";
  const threadLabel = describeThreadLabel(targetMessage.thread, snapshot.users);
  appendTimeline(`Message from ${author} (${threadLabel}) deleted on screen.`);
};

const handleExternalMessageEdit = ({ messageId, text }) => {
  if (!messageId) return;
  const snapshot = getState();
  const targetMessage = snapshot.messages.find((message) => message.id === messageId);
  if (!targetMessage) return;
  setState((prev) => ({
    ...prev,
    messages: prev.messages.map((message) =>
      message.id === messageId ? { ...message, text } : message,
    ),
  }));
  const author = resolveUserName(targetMessage.userId, snapshot.users);
  const threadLabel = describeThreadLabel(targetMessage.thread, snapshot.users);
  appendTimeline(`Edited ${author}'s message in ${threadLabel}.`);
};

const handleExternalMessageReorder = ({ messageId, swapWithId }) => {
  if (!messageId || !swapWithId) return;
  const snapshot = getState();
  const threadLabel = describeThreadLabel(
    snapshot.messages.find((message) => message.id === messageId)?.thread,
    snapshot.users,
  );
  let swapped = false;
  setState((prev) => {
    const messages = [...prev.messages];
    const firstIndex = messages.findIndex((message) => message.id === messageId);
    const secondIndex = messages.findIndex((message) => message.id === swapWithId);
    if (firstIndex < 0 || secondIndex < 0) {
      return prev;
    }
    [messages[firstIndex], messages[secondIndex]] = [messages[secondIndex], messages[firstIndex]];
    swapped = true;
    return { ...prev, messages };
  });
  if (swapped) {
    appendTimeline(`Reordered messages in ${threadLabel}.`);
  }
};

const registerBusObservers = () => {
  bus.subscribe("typingStart", ({ userId }) => {
    applyTypingState(userId, true, { source: "external" });
  });
  bus.subscribe("typingStop", ({ userId }) => {
    applyTypingState(userId, false, { source: "external" });
  });
  bus.subscribe("switchView", handleExternalViewSwitch);
  bus.subscribe("message", handleExternalMessageCreate);
  bus.subscribe("messageEdit", handleExternalMessageEdit);
  bus.subscribe("messageReorder", handleExternalMessageReorder);
  bus.subscribe("messageDelete", handleExternalMessageDelete);
  bus.subscribe("activeUserChange", handleActiveUserBroadcast);
  ["videoRequest", "videoAccept", "videoDecline", "videoEnd"].forEach((event) => {
    bus.subscribe(event, (payload) => handleExternalVideoEvent(event, payload));
  });
};

const adjustScale = (delta) => {
  const state = getState();
  const current = normalizeScale(state?.prefs?.uiScale ?? SCALE_DEFAULT);
  const next = normalizeScale(current + delta);
  if (next === current) return;
  setState((prev) => ({
    ...prev,
    prefs: { ...prev.prefs, uiScale: next },
  }));
  renderPrefs({
    ...state,
    prefs: { ...state.prefs, uiScale: next },
  });
  bus.publish("uiScale", { scale: next });
  appendTimeline(`Zoom set to ${formatScalePercent(next)}.`);
};

const handleScaleIncrease = () => adjustScale(SCALE_STEP);

const handleScaleDecrease = () => adjustScale(-SCALE_STEP);

const handleRosterToggle = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const { toggle, user: userId } = target.dataset;
  if (!toggle || !userId) return;
  const state = getState();
  const user = state.users.find((u) => u.id === userId);
  if (!user) return;

  if (toggle === "online") {
    const nextOnline = target.checked;
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? { ...u, online: nextOnline } : u)),
    }));
    persistCurrentUsers();
    bus.publish("presence", {
      userId,
      online: nextOnline,
    });
    appendTimeline(`${user.displayName} is now ${nextOnline ? "online" : "offline"}.`);
  }

  if (toggle === "typing") {
    const nextTyping = target.checked;
    const targetUserId = resolveTypingUserId(userId);
    applyTypingState(targetUserId, nextTyping, { source: "manual" });
    bus.publish(nextTyping ? "typingStart" : "typingStop", {
      userId: targetUserId,
    });
    appendTimeline(`${user.displayName} typing ${nextTyping ? "started" : "stopped"}.`);
  }

  if (toggle === "hidden") {
    const nextHidden = target.checked;
    const updatedUser = { ...user, hidden: nextHidden };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? updatedUser : u)),
    }));
    persistCurrentUsers();
    bus.publish("userUpdated", { user: updatedUser });
    appendTimeline(
      `${user.displayName} is ${nextHidden ? "hidden from" : "visible on"} screen.`,
    );
  }
};

const createMessageId = () => `msg_${crypto.randomUUID().slice(0, 8)}`;

const createTemplateId = () => `tmpl_${crypto.randomUUID().slice(0, 8)}`;

const dispatchMessage = ({ userId, text }) => {
  if (!userId || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const state = getState();
  const user = state.users.find((u) => u.id === userId);
  if (!user) return null;
  const thread = state.view?.mode ?? "main";
  const timestamp = Date.now();
  const payload = {
    id: createMessageId(),
    thread,
    userId,
    text: trimmed,
    timestamp,
  };
  setState((prev) => ({
    ...prev,
    messages: [...prev.messages, payload],
  }));
  bus.publish("message", payload);
  return { payload, user, thread };
};

const sendMessageWithDelay = async ({ userId, text, delayMs = 0, source = "message" }) => {
  if (!userId || typeof text !== "string") return null;
  const normalizedDelay = Math.max(0, Number(delayMs) || 0);
  if (normalizedDelay <= 0) {
    return dispatchMessage({ userId, text });
  }
  const snapshot = getState();
  const label = resolveUserName(userId, snapshot.users);
  const releaseTyping = acquireTemplateTyping(userId);
  const descriptor = source === "template" ? "template" : "message";
  appendTimeline(
    `Typing as ${label} for ${formatDelayLabel(normalizedDelay)} before sending ${descriptor}.`,
  );
  try {
    await wait(normalizedDelay);
    return dispatchMessage({ userId, text });
  } finally {
    releaseTyping();
  }
};

const handleSendMessage = async () => {
  const text = elements.composerInput?.value ?? "";
  const sendAs = elements.sendAs?.value ?? "";
  const delayMs = readTemplateDelayFromInput();
  const result = await sendMessageWithDelay({ userId: sendAs, text, delayMs, source: "message" });
  if (!result) return;
  appendTimeline(`Sent message as ${result.user.displayName} (${result.thread}).`);
  if (elements.composerInput) {
    elements.composerInput.value = "";
  }
};

const readTemplateDelayFromInput = () => {
  if (!elements.templateDelayInput) return 0;
  const parsed = parseDelaySecondsValue(elements.templateDelayInput.value);
  if (parsed === null) {
    elements.templateDelayInput.value = "0";
    return 0;
  }
  return parsed;
};

const handleTemplateSave = () => {
  const composerInput = elements.composerInput;
  const userSelect = elements.sendAs;
  if (!composerInput || !userSelect) return;
  const text = composerInput.value.trim();
  const userId = userSelect.value;
  if (!text || !userId) return;
  const delayMs = readTemplateDelayFromInput();
  const snapshot = getState();
  const now = Date.now();
  const createdTemplate = {
    id: createTemplateId(),
    userId,
    text,
    delayMs,
    updatedAt: now,
  };
  const nextTemplates = [...snapshot.templates, createdTemplate];
  setState((prev) => ({
    ...prev,
    templates: nextTemplates,
  }));
  persistTemplates(nextTemplates);
  appendTimeline(`Saved template for ${resolveUserName(userId, snapshot.users)}.`);
  if (composerInput) {
    composerInput.value = "";
  }
};

const deleteTemplateById = (templateId) => {
  if (!templateId) return;
  const snapshot = getState();
  const template = snapshot.templates.find((item) => item.id === templateId);
  if (!template) return;
  const nextTemplates = snapshot.templates.filter((item) => item.id !== templateId);
  setState((prev) => ({
    ...prev,
    templates: nextTemplates,
  }));
  persistTemplates(nextTemplates);
  appendTimeline(`Deleted template for ${resolveUserName(template.userId, snapshot.users)}.`);
  if (templateEditorState.templateId === templateId) {
    closeTemplateEditor();
  }
};

const handleTemplateListClick = async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const actionEl = target.closest("[data-template-action]");
  if (!(actionEl instanceof HTMLElement)) return;
  const templateId = actionEl.dataset.templateId;
  const action = actionEl.dataset.templateAction;
  if (!templateId || !action) return;
  const snapshot = getState();
  const template = snapshot.templates.find((item) => item.id === templateId);
  if (!template) return;
  if (action === "send") {
    const result = await sendMessageWithDelay({
      userId: template.userId,
      text: template.text,
      delayMs: Number(template.delayMs) || 0,
      source: "template",
    });
    if (result) {
      appendTimeline(`Sent saved template as ${result.user.displayName} (${result.thread}).`);
    } else {
      appendTimeline("Template send skipped: select a valid user and message.");
    }
    return;
  }
  if (action === "edit") {
    openTemplateEditor(template);
    return;
  }
  if (action === "delete") {
    openConfirm({
      title: "Delete Template",
      message: "Are you sure you want to delete this saved template?",
      confirmLabel: "Delete",
      action: "deleteTemplate",
      payload: { templateId },
      destructive: true,
    });
  }
};

const switchToDmView = (targetId) => {
  if (!targetId) return;
  const state = getState();
  const targetUser = state.users.find((user) => user.id === targetId);
  setState((prev) => ({
    ...prev,
    view: { ...prev.view, mode: `dm:${targetId}` },
  }));
  bus.publish("switchView", { view: `dm:${targetId}` });
  appendTimeline(
    `Switched screen to DM with ${targetUser?.displayName ?? targetId}.`,
  );
};

const handleSwitchMain = () => {
  setState((prev) => ({
    ...prev,
    view: { ...prev.view, mode: "main" },
  }));
  bus.publish("switchView", { view: "main" });
  appendTimeline("Switched screen to Main chat.");
};

const handleActiveUserSelectChange = (event) => {
  const select = event?.target;
  if (!(select instanceof HTMLSelectElement)) return;
  const targetId = select.value || null;
  const snapshot = getState();
  if (snapshot.currentUserId === targetId) return;
  setState((prev) => ({
    ...prev,
    currentUserId: targetId,
  }));
  bus.publish("activeUserChange", { userId: targetId });
  const label = resolveUserName(targetId, snapshot.users);
  appendTimeline(`Logged in user set to ${label}.`);
};

const handleActiveUserBroadcast = ({ userId }) => {
  const snapshot = getState();
  if (snapshot.currentUserId === userId) return;
  setState((prev) => ({
    ...prev,
    currentUserId: userId ?? null,
  }));
  const label = resolveUserName(userId, snapshot.users);
  appendTimeline(`Logged in user synced to ${label}.`);
};

const requestActiveUserState = () => {
  bus.publish("activeUserRequest", {});
};

const applyVideoStatusToMessages = (messages, messageId, status) => {
  if (!messageId) return { list: messages, changed: false };
  let changed = false;
  const next = messages.map((message) => {
    if (message.id !== messageId || message.kind !== "videoRequest") {
      return message;
    }
    if (message.videoStatus === status) {
      return message;
    }
    changed = true;
    return { ...message, videoStatus: status };
  });
  return { list: changed ? next : messages, changed };
};

const handleVideoEvent = (type) => {
  const state = getState();

  if (type === "videoRequest") {
    const requesterId = elements.videoRequester?.value;
    if (!requesterId) {
      appendTimeline("Video request skipped: no requester selected.");
      return;
    }
    const requester = state.users.find((user) => user.id === requesterId);
    if (!requester) {
      appendTimeline("Video request skipped: requester not found.");
      return;
    }
    const messageId = createMessageId();
    const thread = state.view.mode;
    const timestamp = Date.now();
    const message = {
      id: messageId,
      thread,
      userId: requesterId,
      text: `${requester.displayName} is requesting a video chat.`,
      timestamp,
      kind: "videoRequest",
      videoStatus: "pending",
    };
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
      video: {
        ...prev.video,
        state: "requested",
        fromUserId: requesterId,
        messageId,
      },
    }));
    bus.publish("message", message);
    bus.publish("videoRequest", { userId: requesterId, messageId });
    appendTimeline(`Video request sent as ${requester.displayName}.`);
    return;
  }

  const { video } = state;
  const pendingUserId = video?.fromUserId ?? elements.videoRequester?.value ?? "";
  const pendingMessageId = video?.messageId ?? null;
  const user = state.users.find((u) => u.id === pendingUserId) ?? null;

  if (type === "videoAccept" || type === "videoDecline") {
    const hasPendingRequest =
      video?.state === "requested" && Boolean(video?.fromUserId) && Boolean(video?.messageId);
    if (!hasPendingRequest) {
      appendTimeline("No pending video request to respond to.");
      return;
    }
    const status = type === "videoAccept" ? "accepted" : "declined";
    setState((prev) => ({
      ...prev,
      video:
        type === "videoAccept"
          ? { ...prev.video, state: "accepted" }
          : { ...prev.video, state: "idle", fromUserId: null, messageId: null },
      messages: prev.messages.map((message) =>
        message.id === prev.video.messageId && message.kind === "videoRequest"
          ? { ...message, videoStatus: status }
          : message,
      ),
    }));
    bus.publish(type, { userId: video.fromUserId, messageId: video.messageId });
    const detail = user ? ` for ${user.displayName}` : "";
    appendTimeline(`Video request ${status}${detail}.`);
    return;
  }

  if (type === "videoEnd") {
    setState((prev) => ({
      ...prev,
      video: {
        state: "idle",
        fromUserId: null,
        messageId: null,
      },
      messages: prev.video.messageId
        ? prev.messages.map((message) =>
            message.id === prev.video.messageId && message.kind === "videoRequest"
              ? { ...message, videoStatus: "ended" }
              : message,
          )
        : prev.messages,
    }));
    bus.publish(type, { userId: pendingUserId || null, messageId: pendingMessageId });
    appendTimeline("Video session ended.");
    return;
  }

  bus.publish(type, { userId: pendingUserId || null, messageId: pendingMessageId });
};

const handleExternalVideoEvent = (type, payload = {}) => {
  const { userId = null, messageId = null } = payload;
  if (type === "videoRequest") {
    let changed = false;
    setState((prev) => {
      if (
        prev.video.state === "requested" &&
        prev.video.fromUserId === userId &&
        prev.video.messageId === messageId
      ) {
        return prev;
      }
      changed = true;
      return {
        ...prev,
        video: {
          state: "requested",
          fromUserId: userId ?? null,
          messageId: messageId ?? null,
        },
      };
    });
    if (!changed) return;
    const snapshot = getState();
    appendTimeline(
      `Incoming video request from ${resolveUserName(userId, snapshot.users)}.`,
    );
    return;
  }

  if (type === "videoAccept") {
    let changed = false;
    setState((prev) => {
      const nextId = messageId ?? prev.video.messageId ?? null;
      const { list: nextMessages, changed: messagesChanged } = applyVideoStatusToMessages(
        prev.messages,
        nextId,
        "accepted",
      );
      const nextVideo = {
        ...prev.video,
        state: "accepted",
        fromUserId: prev.video.fromUserId ?? userId ?? null,
        messageId: nextId,
      };
      if (
        prev.video.state === nextVideo.state &&
        prev.video.fromUserId === nextVideo.fromUserId &&
        prev.video.messageId === nextVideo.messageId &&
        !messagesChanged
      ) {
        return prev;
      }
      changed = true;
      return {
        ...prev,
        video: nextVideo,
        messages: nextMessages,
      };
    });
    if (!changed) return;
    const snapshot = getState();
    const targetUserId = snapshot.video.fromUserId ?? userId;
    const requester =
      snapshot.users.find((u) => u.id === targetUserId) ?? null;
    const detail = requester ? ` for ${requester.displayName}` : "";
    appendTimeline(`Video request accepted${detail}.`);
    return;
  }

  if (type === "videoDecline" || type === "videoEnd") {
    let changed = false;
    setState((prev) => {
      const nextId = messageId ?? prev.video.messageId ?? null;
      const status = type === "videoDecline" ? "declined" : "ended";
      const { list: nextMessages, changed: messagesChanged } = applyVideoStatusToMessages(
        prev.messages,
        nextId,
        status,
      );
      const shouldResetVideo =
        prev.video.state !== "idle" || prev.video.messageId !== null;
      if (!messagesChanged && !shouldResetVideo) {
        return prev;
      }
      changed = true;
      return {
        ...prev,
        video: {
          state: "idle",
          fromUserId: null,
          messageId: null,
        },
        messages: nextMessages,
      };
    });
    if (!changed) return;
    appendTimeline(
      type === "videoDecline"
        ? "Video request declined on screen."
        : "Video session ended on screen.",
    );
    return;
  }
};

const handleStartTake = () => {
  const now = Date.now();
  setState((prev) => ({
    ...prev,
    take: {
      ...prev.take,
      startedAt: now,
      timeline: [],
    },
    messages: [],
  }));
  bus.publish("takeStart", { startedAt: now });
  appendTimeline("Take started.");
};

const resetChatClient = () => {
  setState((prev) => ({
    ...prev,
    messages: [],
    view: { mode: "main" },
  }));
  bus.publish("takeReset", {});
  appendTimeline("Chat client reset.");
};

const handleResetTake = () => {
  openConfirm({
    title: "Reset Chat Client",
    message: "This clears all current messages and timeline entries. Are you sure?",
    confirmLabel: "Reset",
    action: "resetClient",
    destructive: true,
  });
};

const handleHotkeys = (event) => {
  const activeTarget = event.target;
  if (
    activeTarget instanceof HTMLElement &&
    activeTarget.matches("input, textarea, select")
  ) {
    return;
  }
  if (modalOpen()) {
    if (event.key === "Escape") {
      if (!elements.userEditorModal?.hidden) {
        event.preventDefault();
        closeUserEditor();
      } else if (!elements.templateEditorModal?.hidden) {
        event.preventDefault();
        closeTemplateEditor();
      } else if (!elements.confirmModal?.hidden) {
        event.preventDefault();
        closeConfirm();
      }
    }
    return;
  }
  const key = (event.key ?? "").toLowerCase();
  const code = event.code ?? "";
  const isControlLike = event.ctrlKey || event.metaKey;
  const matchesKey = (char) => key === char || code === `Key${char.toUpperCase()}`;
  if (isControlLike && event.shiftKey) {
    if (matchesKey("a")) {
      event.preventDefault();
      handleVideoEvent("videoAccept");
      return;
    }
    if (matchesKey("d")) {
      event.preventDefault();
      handleVideoEvent("videoDecline");
      return;
    }
    if (matchesKey("e")) {
      event.preventDefault();
      handleVideoEvent("videoEnd");
      return;
    }
  }
  switch (key) {
    case "enter":
      handleSendMessage();
      break;
    case "a":
      handleVideoEvent("videoAccept");
      break;
    case "x":
      handleVideoEvent("videoDecline");
      break;
    case "e":
      handleVideoEvent("videoEnd");
      break;
    default:
      break;
  }
};

const bindEvents = () => {
  elements.rosterList?.addEventListener("change", handleRosterToggle);
  elements.rosterList?.addEventListener("click", handleRosterClick);
  elements.addUserBtn?.addEventListener("click", handleAddUser);
  elements.sendMessageBtn?.addEventListener("click", handleSendMessage);
  elements.switchToDM?.addEventListener("click", handleDMSelect);
  elements.switchToMain?.addEventListener("click", handleSwitchMain);
  elements.videoSwitchToMain?.addEventListener("click", handleSwitchMain);
  elements.videoRequestBtn?.addEventListener("click", () => handleVideoEvent("videoRequest"));
  elements.videoAcceptBtn?.addEventListener("click", () => handleVideoEvent("videoAccept"));
  elements.videoDeclineBtn?.addEventListener("click", () => handleVideoEvent("videoDecline"));
  elements.videoEndBtn?.addEventListener("click", () => handleVideoEvent("videoEnd"));
  elements.activeUserSelect?.addEventListener("change", handleActiveUserSelectChange);
  elements.scaleDecreaseBtn?.addEventListener("click", handleScaleDecrease);
  elements.scaleIncreaseBtn?.addEventListener("click", handleScaleIncrease);
  elements.startTakeBtn?.addEventListener("click", handleStartTake);
  elements.resetTakeBtn?.addEventListener("click", handleResetTake);
  elements.saveTemplateBtn?.addEventListener("click", handleTemplateSave);
  elements.templateList?.addEventListener("click", handleTemplateListClick);
  elements.userEditorForm?.addEventListener("submit", handleUserEditorFormSubmit);
  elements.userEditorColorPicker?.addEventListener("input", handleUserEditorColorPickerInput);
  elements.userEditorColorInput?.addEventListener("input", handleUserEditorColorTextChange);
  elements.userEditorCancel?.addEventListener("click", closeUserEditor);
  elements.userEditorClose?.addEventListener("click", closeUserEditor);
  elements.userEditorBackdrop?.addEventListener("click", closeUserEditor);
  elements.templateEditorForm?.addEventListener("submit", handleTemplateEditorSubmit);
  elements.templateEditorCancel?.addEventListener("click", closeTemplateEditor);
  elements.templateEditorClose?.addEventListener("click", closeTemplateEditor);
  elements.templateEditorBackdrop?.addEventListener("click", closeTemplateEditor);
  elements.confirmCancel?.addEventListener("click", closeConfirm);
  elements.confirmBackdrop?.addEventListener("click", closeConfirm);
  elements.confirmConfirm?.addEventListener("click", applyConfirmAction);
  window.addEventListener("keydown", handleHotkeys);
};

const cacheElements = () => {
  elements.rosterList = document.getElementById("rosterList");
  elements.addUserBtn = document.getElementById("addUserBtn");
  elements.sendAs = document.getElementById("sendAs");
  elements.dmTarget = document.getElementById("dmTarget");
  elements.sendMessageBtn = document.getElementById("sendMessageBtn");
  elements.composerPanel = document.getElementById("messagePanel") ?? document.getElementById("sendPanel");
  elements.saveTemplateBtn = document.getElementById("saveTemplateBtn");
  elements.templateList = document.getElementById("templateList");
  elements.switchToDM = document.getElementById("switchToDM");
  elements.switchToMain = document.getElementById("switchToMain");
  elements.videoSwitchToMain = document.getElementById("videoSwitchToMain");
  elements.videoRequester = document.getElementById("videoRequester");
  elements.videoRequestBtn = document.getElementById("videoRequestBtn");
  elements.videoAcceptBtn = document.getElementById("videoAcceptBtn");
  elements.videoDeclineBtn = document.getElementById("videoDeclineBtn");
  elements.videoEndBtn = document.getElementById("videoEndBtn");
  elements.activeUserSelect = document.getElementById("activeUserSelect");
  elements.scaleDecreaseBtn = document.getElementById("scaleDecreaseBtn");
  elements.scaleIncreaseBtn = document.getElementById("scaleIncreaseBtn");
  elements.scaleValue = document.getElementById("scaleValue");
  elements.startTakeBtn = document.getElementById("startTakeBtn");
  elements.resetTakeBtn = document.getElementById("resetTakeBtn");
  elements.composerInput = document.getElementById("composerInput");
  elements.templateDelayInput = document.getElementById("templateDelayInput");
  elements.timelineLog = document.getElementById("timelineLog");
  elements.userEditorModal = document.getElementById("userEditorModal");
  elements.userEditorForm = document.getElementById("userEditorForm");
  elements.userEditorDisplayName = document.getElementById("userDisplayNameInput");
  elements.userEditorColorInput = document.getElementById("userColorInput");
  elements.userEditorColorPicker = document.getElementById("userColorPicker");
  elements.userEditorAvatarInitial = document.getElementById("userAvatarInitialInput");
  elements.userEditorBio = document.getElementById("userBioInput");
  elements.userEditorBadges = document.getElementById("userBadgesInput");
  elements.userEditorOnline = document.getElementById("userOnlineInput");
  elements.userEditorHidden = document.getElementById("userHiddenInput");
  elements.userEditorTitle = document.getElementById("userEditorTitle");
  elements.userEditorSave = document.getElementById("userEditorSave");
  elements.userEditorCancel = document.getElementById("userEditorCancel");
  elements.userEditorClose = document.getElementById("userEditorClose");
  elements.userEditorBackdrop = document.getElementById("userEditorBackdrop");
  elements.userEditorError = document.getElementById("userEditorError");
  elements.templateEditorModal = document.getElementById("templateEditorModal");
  elements.templateEditorForm = document.getElementById("templateEditorForm");
  elements.templateEditorTitle = document.getElementById("templateEditorTitle");
  elements.templateEditorUser = document.getElementById("templateEditorUser");
  elements.templateEditorMessage = document.getElementById("templateEditorMessage");
  elements.templateEditorDelay = document.getElementById("templateEditorDelay");
  elements.templateEditorError = document.getElementById("templateEditorError");
  elements.templateEditorCancel = document.getElementById("templateEditorCancel");
  elements.templateEditorClose = document.getElementById("templateEditorClose");
  elements.templateEditorBackdrop = document.getElementById("templateEditorBackdrop");
  elements.confirmModal = document.getElementById("confirmModal");
  elements.confirmTitle = document.getElementById("confirmTitle");
  elements.confirmMessage = document.getElementById("confirmMessage");
  elements.confirmConfirm = document.getElementById("confirmConfirm");
  elements.confirmCancel = document.getElementById("confirmCancel");
  elements.confirmBackdrop = document.getElementById("confirmBackdrop");
};

const init = async () => {
  cacheElements();
  document.documentElement.style.setProperty("--ui-scale", "1");
  bindEvents();
  registerBusObservers();
  announceReady();
  appendTimeline("Control panel ready.");
  await loadBaseline();
  render(getState());
  subscribe(render);
  requestActiveUserState();
};

window.addEventListener("DOMContentLoaded", init);
