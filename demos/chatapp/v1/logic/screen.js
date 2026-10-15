import { bus } from "./bus.js";
import { loadUsers } from "./userLoader.js";
import { applyProfileStatus } from "./profileStatus.js";

const presenceChannel = window.BroadcastChannel
  ? new BroadcastChannel("chat_app_legacy_presence")
  : null;

const defaultVideoState = () => ({
  state: "idle",
  userId: null,
  cameraOn: true,
  microphoneOn: true,
  messageId: null,
});

const state = {
  users: [],
  messages: [],
  view: "main",
  typing: {},
  video: defaultVideoState(),
  currentUserId: null,
  selfPopoverOpen: false,
  profile: {
    open: false,
    userId: null,
    trigger: null,
    pendingFocus: false,
  },
};

const updateCurrentUserId = (nextUserId, { announce = true } = {}) => {
  const normalized = nextUserId ?? null;
  if (state.currentUserId === normalized) return false;
  state.currentUserId = normalized;
  if (announce) {
    bus.publish("activeUserChange", { userId: normalized });
  }
  return true;
};

const elements = {};
const messageMenuState = {
  open: false,
  messageId: null,
  target: null,
};
const messageEditorState = {
  messageId: null,
};

let selfTypingActive = false;
let typingTimeoutId = null;
let lastVideoState = "idle";
let videoPendingIndicatorTimeoutId = null;
let videoPendingIndicatorDismissed = false;
const seenMessages = new Set();
const pendingReorders = new Set();
const FEED_BOTTOM_EPSILON = 6;

const isFeedNearBottom = (feed, threshold = FEED_BOTTOM_EPSILON) => {
  if (!feed) return false;
  const distance = feed.scrollHeight - (feed.scrollTop + feed.clientHeight);
  return distance <= threshold;
};

const stickFeedToBottom = (feed) => {
  if (!feed) return;
  feed.scrollTop = feed.scrollHeight;
};

const SCALE_DEFAULT = 1;
const SCALE_MIN = 0.5;
const SCALE_MAX = 2.5;

const clampScale = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return SCALE_DEFAULT;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, numeric));
};

const normalizeScale = (value) => {
  const clamped = clampScale(value);
  return Math.round(clamped * 100) / 100;
};

let currentScale = SCALE_DEFAULT;
let appliedScale = null;

const resetScaledDimensions = (target) => {
  if (!target) return;
  [
    "transform",
    "transformOrigin",
    "width",
    "height",
    "minHeight",
    "maxHeight",
    "margin",
  ].forEach((prop) => {
    const cssProp =
      prop === "transformOrigin"
        ? "transform-origin"
        : prop.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    target.style.removeProperty(cssProp);
  });
};

const applyScaledDimensions = (target, scale) => {
  if (!target || scale === 1) {
    resetScaledDimensions(target);
    return;
  }
  target.style.transformOrigin = "top center";
  target.style.transform = `scale(${scale})`;
  const widthCalc = `calc(100% / ${scale})`;
  const heightCalc = `calc((100vh - 2rem) / ${scale})`;
  target.style.width = widthCalc;
  target.style.height = heightCalc;
  target.style.minHeight = heightCalc;
  target.style.maxHeight = heightCalc;
  target.style.margin = "0 auto";
};

const applyDocumentScale = (scale) => {
  const normalized = normalizeScale(scale ?? SCALE_DEFAULT);
  if (appliedScale === normalized) return;

  const body = document.body;
  const appRoot = elements.appRoot ?? document.querySelector(".screen__app");

  currentScale = normalized;
  appliedScale = normalized;

  document.documentElement.style.setProperty("--ui-scale", "1");

  if (body) {
    body.dataset.zoomMode = "transform";
    body.style.removeProperty("zoom");
    body.setAttribute("data-ui-scale", normalized.toString());
    if (normalized === 1) {
      body.style.removeProperty("overflow");
    } else {
      body.style.overflow = "hidden";
    }
  }

  if (!appRoot) return;

  if (normalized === 1) {
    resetScaledDimensions(appRoot);
    return;
  }

  applyScaledDimensions(appRoot, normalized);
};

const PROFILE_NAME_MIN_SCALE = 0.58;
const PROFILE_NAME_MIN_FONT_PX = 12;
const profileNameElements = new Set();
const profileNameFitQueue = new Set();
let profileNameFitScheduled = false;

const fitProfileName = (element) => {
  if (!(element instanceof HTMLElement)) return;

  const containerWidth = Math.floor(element.parentElement?.clientWidth ?? element.clientWidth);
  element.style.removeProperty("font-size");

  if (!containerWidth || containerWidth <= 0) {
    return;
  }

  const computed = window.getComputedStyle(element);
  const baseFontSize = Number.parseFloat(computed.fontSize) || 24;
  const minFontSize = Math.max(PROFILE_NAME_MIN_FONT_PX, baseFontSize * PROFILE_NAME_MIN_SCALE);

  element.style.fontSize = `${baseFontSize}px`;
  const baseScrollWidth = element.scrollWidth;

  if (baseScrollWidth <= containerWidth) {
    return;
  }

  let nextFontSize = Math.max(minFontSize, (containerWidth / baseScrollWidth) * baseFontSize);
  element.style.fontSize = `${nextFontSize}px`;

  let guard = 0;
  while (element.scrollWidth > containerWidth && nextFontSize > minFontSize && guard < 6) {
    nextFontSize = Math.max(minFontSize, nextFontSize - 0.5);
    element.style.fontSize = `${nextFontSize}px`;
    guard += 1;
  }
};

const queueProfileNameFit = (element) => {
  if (element instanceof HTMLElement) {
    profileNameElements.add(element);
    profileNameFitQueue.add(element);
  } else if (!element) {
    profileNameElements.forEach((item) => profileNameFitQueue.add(item));
  }

  if (profileNameFitScheduled) return;
  profileNameFitScheduled = true;
  window.requestAnimationFrame(() => {
    profileNameFitScheduled = false;
    profileNameFitQueue.forEach((item) => fitProfileName(item));
    profileNameFitQueue.clear();
  });
};

window.addEventListener("resize", () => queueProfileNameFit());

const clearProfileRosterHighlight = () => {
  document
    .querySelectorAll(".sidebar__user--active")
    .forEach((item) => item.classList.remove("sidebar__user--active"));
};

const groupIconMarkup = `
  <svg
    class="icon icon--channel size-6"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-4.03a48.527 48.527 0 0 1-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979Z" />
    <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
  </svg>
`.trim();

const dmIconMarkup = `
  <svg
    class="icon icon--dm size-6"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97-1.94.284-3.916.455-5.922.505a.39.39 0 0 0-.266.112L8.78 21.53A.75.75 0 0 1 7.5 21v-3.955a48.842 48.842 0 0 1-2.652-.316c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z"
    />
  </svg>
`.trim();

const setChannelPrefix = (value) => {
  const prefixEl = elements.channelPrefix;
  if (!prefixEl) return;

  if (value === "dm") {
    prefixEl.innerHTML = dmIconMarkup;
    prefixEl.setAttribute("aria-hidden", "true");
    return;
  }

  if (value === "group") {
    prefixEl.innerHTML = groupIconMarkup;
    prefixEl.setAttribute("aria-hidden", "true");
    return;
  }

  prefixEl.textContent = value ?? "";
  if (value) {
    prefixEl.removeAttribute("aria-hidden");
  } else {
    prefixEl.setAttribute("aria-hidden", "true");
  }
};

const announceReady = () => {
  presenceChannel?.postMessage({ type: "windowReady", window: "screen" });
};

const userById = (id) => state.users.find((user) => user.id === id);

const userColor = (user) => user?.color ?? "var(--surface-accent-soft)";

const userInitial = (user) => {
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

const messageById = (id) => state.messages.find((message) => message.id === id);

const findMessageIndex = (messageId) =>
  state.messages.findIndex((message) => message.id === messageId);

const findThreadNeighborIndex = (startIndex, direction) => {
  const reference = state.messages[startIndex];
  if (!reference) return null;
  const step = direction === "up" ? -1 : 1;
  let targetIndex = startIndex + step;
  while (targetIndex >= 0 && targetIndex < state.messages.length) {
    if (state.messages[targetIndex]?.thread === reference.thread) {
      return targetIndex;
    }
    targetIndex += step;
  }
  return null;
};

const canMoveMessage = (messageId, direction) => {
  const index = findMessageIndex(messageId);
  if (index < 0) return false;
  return findThreadNeighborIndex(index, direction) !== null;
};

const swapMessagesById = (firstId, secondId) => {
  if (!firstId || !secondId || firstId === secondId) return false;
  const firstIndex = findMessageIndex(firstId);
  const secondIndex = findMessageIndex(secondId);
  if (firstIndex < 0 || secondIndex < 0) return false;
  [state.messages[firstIndex], state.messages[secondIndex]] = [
    state.messages[secondIndex],
    state.messages[firstIndex],
  ];
  return true;
};

const formatReorderKey = (a, b) => `${a}__${b}`;

const trackPendingReorder = (messageId, swapWithId) => {
  const key = formatReorderKey(messageId, swapWithId);
  pendingReorders.add(key);
  window.setTimeout(() => pendingReorders.delete(key), 2000);
  return key;
};

const isPendingReorder = (messageId, swapWithId) => {
  const key = formatReorderKey(messageId, swapWithId);
  if (pendingReorders.has(key)) {
    pendingReorders.delete(key);
    return true;
  }
  return false;
};

const currentUser = () => userById(state.currentUserId);

const profileBadges = (user) => (Array.isArray(user?.badges) ? user.badges : []);

const profileBio = (user) => user?.bio ?? "User bio";

const createMessageId = () => `msg_${crypto.randomUUID().slice(0, 8)}`;

const isDirectMessageView = () => state.view.startsWith("dm:");

const setAvatar = (element, user) => {
  if (!element) return;
  element.innerHTML = "";
  element.style.background = user ? userColor(user) : "var(--surface-faint)";
  element.style.color = "var(--text-contrast)";
  element.textContent = userInitial(user);
};

const renderMessage = (message) => {
  const user = userById(message.userId);
  const displayName = user?.displayName ?? "Unknown";
  const bubble = document.createElement("article");
  bubble.className = "message";

  const avatar = document.createElement("div");
  avatar.className = "message__avatar";
  setAvatar(avatar, user);

  const body = document.createElement("div");
  body.className = "message__body";

  if (message?.id) {
    bubble.dataset.messageId = message.id;
  }
  if (message?.kind) {
    bubble.dataset.messageKind = message.kind;
  }

  if (message.kind === "videoRequest") {
    bubble.classList.add("message--videoRequest");
    const isSelfRequest = message.userId === state.currentUserId;
    const text = document.createElement("div");
    text.className = "message__text";
    text.textContent = isSelfRequest
      ? "You requested a video chat."
      : message.text || `${displayName} is requesting a video chat.`;
    body.append(text);

    const status = message.videoStatus ?? "pending";
    if (status === "pending" && !isSelfRequest) {
      const actions = document.createElement("div");
      actions.className = "message__actions";

      const acceptButton = document.createElement("button");
      acceptButton.type = "button";
      acceptButton.className = "message__action message__action--primary";
      acceptButton.textContent = "Accept";
      acceptButton.dataset.action = "videoAccept";
      acceptButton.dataset.messageId = message.id;
      acceptButton.dataset.userId = message.userId;

      const declineButton = document.createElement("button");
      declineButton.type = "button";
      declineButton.className = "message__action";
      declineButton.textContent = "Decline";
      declineButton.dataset.action = "videoDecline";
      declineButton.dataset.messageId = message.id;
      declineButton.dataset.userId = message.userId;

      actions.append(acceptButton, declineButton);
      body.append(actions);
    } else {
      const statusEl = document.createElement("div");
      statusEl.className = `message__status message__status--${status}`;
      const statusText =
        status === "pending"
          ? "Requesting..."
          : status === "accepted"
            ? "Video chat accepted"
            : status === "declined"
              ? "Video chat declined"
              : "Video chat ended";
      statusEl.textContent = statusText;
      body.append(statusEl);
    }

    bubble.append(avatar, body);
    return bubble;
  }

  const meta = document.createElement("div");
  meta.className = "message__meta";
  const author = document.createElement("span");
  author.className = "message__author";
  author.textContent = displayName;
  meta.append(author);
  body.append(meta);

  const text = document.createElement("div");
  text.className = "message__text";
  const lines = String(message.text ?? "").split("\n");
  lines.forEach((line, index) => {
    if (index > 0) text.appendChild(document.createElement("br"));
    text.appendChild(document.createTextNode(line));
  });

  body.append(text);
  bubble.append(avatar, body);
  return bubble;
};

const setMenuActionDisabled = (action, disabled) => {
  const button = elements.messageMenu?.querySelector(
    `[data-menu-action="${action}"]`,
  );
  if (!button) return;
  button.disabled = disabled;
  if (disabled) {
    button.setAttribute("aria-disabled", "true");
  } else {
    button.removeAttribute("aria-disabled");
  }
};

const resetMessageMenuAvailability = () => {
  ["moveUp", "moveDown"].forEach((action) => setMenuActionDisabled(action, false));
};

const updateMessageMenuAvailability = (messageId) => {
  if (!messageById(messageId)) {
    ["moveUp", "moveDown"].forEach((action) => setMenuActionDisabled(action, true));
    return;
  }
  setMenuActionDisabled("moveUp", !canMoveMessage(messageId, "up"));
  setMenuActionDisabled("moveDown", !canMoveMessage(messageId, "down"));
};

const clearMessageMenuTarget = () => {
  if (!messageMenuState.target) return;
  messageMenuState.target.classList.remove("message--menuTarget");
  messageMenuState.target = null;
};

const setMessageMenuTarget = (bubble) => {
  if (!(bubble instanceof HTMLElement)) return;
  if (messageMenuState.target === bubble) return;
  clearMessageMenuTarget();
  bubble.classList.add("message--menuTarget");
  messageMenuState.target = bubble;
};

const closeMessageContextMenu = () => {
  const menu = elements.messageMenu;
  if (!menu) return;
  if (!messageMenuState.open) return;
  menu.hidden = true;
  menu.setAttribute("aria-hidden", "true");
  messageMenuState.open = false;
  messageMenuState.messageId = null;
  clearMessageMenuTarget();
  resetMessageMenuAvailability();
};

const positionMessageContextMenu = (menu, x, y) => {
  if (!menu) return;
  const padding = 12;
  const rect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let left = x;
  let top = y;
  if (left + rect.width + padding > viewportWidth) {
    left = Math.max(padding, viewportWidth - rect.width - padding);
  }
  if (top + rect.height + padding > viewportHeight) {
    top = Math.max(padding, viewportHeight - rect.height - padding);
  }
  if (left < padding) {
    left = padding;
  }
  if (top < padding) {
    top = padding;
  }
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
};

const openMessageContextMenu = ({ messageId, x, y, bubble }) => {
  const menu = elements.messageMenu;
  if (!menu) return;
  messageMenuState.open = true;
  messageMenuState.messageId = messageId;
  menu.hidden = false;
  menu.setAttribute("aria-hidden", "false");
  menu.style.left = "-9999px";
  menu.style.top = "-9999px";
  if (bubble) {
    setMessageMenuTarget(bubble);
  } else {
    clearMessageMenuTarget();
  }
  updateMessageMenuAvailability(messageId);
  positionMessageContextMenu(menu, x, y);
  const focusTarget =
    menu.querySelector('[data-menu-action]:not(:disabled)') ??
    menu.querySelector("[data-menu-action]");
  focusTarget?.focus({ preventScroll: true });
};

const removeMessageFromState = (messageId) => {
  if (!messageId) return null;
  const index = state.messages.findIndex((message) => message.id === messageId);
  if (index < 0) return null;
  const [removed] = state.messages.splice(index, 1);
  seenMessages.delete(messageId);
  if (state.video?.messageId === messageId) {
    state.video = defaultVideoState();
    renderVideo();
  }
  return removed;
};

const deleteMessageById = (messageId) => {
  const removed = removeMessageFromState(messageId);
  if (!removed) return false;
  closeMessageContextMenu();
  renderFeed();
  bus.publish("messageDelete", { messageId });
  return true;
};

const showMessageEditorError = (message) => {
  if (!elements.messageEditorError) return;
  elements.messageEditorError.textContent = message;
  elements.messageEditorError.hidden = !message;
};

const clearMessageEditorError = () => showMessageEditorError("");

const isMessageEditorOpen = () =>
  Boolean(elements.messageEditorModal && !elements.messageEditorModal.hidden);

const setMessageEditorVisibility = (visible) => {
  const modal = elements.messageEditorModal;
  if (!modal) return;
  modal.hidden = !visible;
  modal.setAttribute("aria-hidden", visible ? "false" : "true");
};

const openMessageEditor = (message) => {
  if (!message || !elements.messageEditorModal) return false;
  messageEditorState.messageId = message.id;
  const author = userById(message.userId)?.displayName ?? "Member";
  const isVideoRequest = message.kind === "videoRequest";
  elements.messageEditorTitle.textContent = isVideoRequest ? "Edit video request" : "Edit message";
  if (elements.messageEditorMeta) {
    elements.messageEditorMeta.textContent = `Sent by ${author}`;
  }
  elements.messageEditorForm?.reset();
  const defaultText = isVideoRequest
    ? message.text ?? `${author} is requesting a video chat.`
    : String(message.text ?? "");
  if (elements.messageEditorInput) {
    elements.messageEditorInput.value = defaultText;
  }
  clearMessageEditorError();
  setMessageEditorVisibility(true);
  window.requestAnimationFrame(() => {
    const input = elements.messageEditorInput;
    if (input) {
      input.focus({ preventScroll: true });
      const length = input.value.length;
      input.setSelectionRange(0, length);
    }
  });
  return true;
};

const closeMessageEditor = () => {
  messageEditorState.messageId = null;
  if (elements.messageEditorMeta) {
    elements.messageEditorMeta.textContent = "";
  }
  elements.messageEditorForm?.reset();
  clearMessageEditorError();
  setMessageEditorVisibility(false);
};

const applyMessageEditorChanges = () => {
  const messageId = messageEditorState.messageId;
  if (!messageId) return false;
  const message = messageById(messageId);
  if (!message) {
    showMessageEditorError("Message no longer exists.");
    return false;
  }
  const nextText = elements.messageEditorInput?.value ?? "";
  if (nextText === (message.text ?? "")) {
    closeMessageEditor();
    return false;
  }
  state.messages = state.messages.map((entry) =>
    entry.id === messageId ? { ...entry, text: nextText } : entry,
  );
  renderFeed();
  bus.publish("messageEdit", { messageId, text: nextText });
  closeMessageEditor();
  return true;
};

const editMessageById = (messageId) => {
  const message = messageById(messageId);
  if (!message) return false;
  return openMessageEditor(message);
};

const moveMessageByDirection = (messageId, direction) => {
  const index = findMessageIndex(messageId);
  if (index < 0) return false;
  const neighborIndex = findThreadNeighborIndex(index, direction);
  if (neighborIndex === null) return false;
  const swapTarget = state.messages[neighborIndex];
  if (!swapTarget?.id) return false;
  [state.messages[index], state.messages[neighborIndex]] = [
    state.messages[neighborIndex],
    state.messages[index],
  ];
  renderFeed();
  trackPendingReorder(messageId, swapTarget.id);
  bus.publish("messageReorder", { messageId, swapWithId: swapTarget.id });
  return true;
};

const handleMessageMenuAction = (action) => {
  const messageId = messageMenuState.messageId;
  if (!messageId) return;
  let handled = false;
  switch (action) {
    case "moveUp":
      handled = moveMessageByDirection(messageId, "up");
      break;
    case "moveDown":
      handled = moveMessageByDirection(messageId, "down");
      break;
    case "edit":
      handled = editMessageById(messageId);
      break;
    case "delete":
      handled = deleteMessageById(messageId);
      break;
    default:
      break;
  }
  if (handled && messageMenuState.open) {
    closeMessageContextMenu();
  }
};

const handleMessageContextMenu = (event) => {
  if (!(event.target instanceof HTMLElement)) return;
  const bubble = event.target.closest(".message");
  if (!bubble) {
    closeMessageContextMenu();
    return;
  }
  const messageId = bubble.dataset.messageId;
  if (!messageId) return;
  if (!state.messages.some((message) => message.id === messageId)) return;
  event.preventDefault();
  closeMessageContextMenu();
  const rect = bubble.getBoundingClientRect();
  const pointerX = event.clientX || rect.left + rect.width / 2;
  const pointerY = event.clientY || rect.top + rect.height / 2;
  openMessageContextMenu({
    messageId,
    x: pointerX,
    y: pointerY,
    bubble,
  });
};

const handleMessageMenuClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.menuAction;
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  handleMessageMenuAction(action);
};

const handleMessageMenuOutsideClick = (event) => {
  if (!messageMenuState.open) return;
  const menu = elements.messageMenu;
  if (!menu) return;
  if (event.target instanceof Node && menu.contains(event.target)) {
    return;
  }
  closeMessageContextMenu();
};

const handleMessageMenuKeydown = (event) => {
  if (!messageMenuState.open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeMessageContextMenu();
  }
};

const handleMessageEditorSubmit = (event) => {
  event.preventDefault();
  clearMessageEditorError();
  applyMessageEditorChanges();
};

const handleMessageEditorKeydown = (event) => {
  if (!isMessageEditorOpen()) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeMessageEditor();
  }
};

const handleMessageDeleted = ({ messageId }) => {
  const removed = removeMessageFromState(messageId);
  if (!removed) return;
  if (messageMenuState.messageId === messageId) {
    closeMessageContextMenu();
  }
  if (messageEditorState.messageId === messageId) {
    closeMessageEditor();
  }
  renderFeed();
};

const handleMessageEdit = ({ messageId, text }) => {
  if (!messageId) return;
  const index = findMessageIndex(messageId);
  if (index < 0) return;
  state.messages[index] = { ...state.messages[index], text };
  renderFeed();
};

const handleMessageReorder = ({ messageId, swapWithId }) => {
  if (!messageId || !swapWithId) return;
  if (isPendingReorder(messageId, swapWithId)) {
    return;
  }
  if (swapMessagesById(messageId, swapWithId)) {
    renderFeed();
  }
};

const renderFeed = () => {
  const feed = elements.messageFeed;
  if (!feed) return;
  closeMessageContextMenu();
  feed.innerHTML = "";
  const thread = state.view;
  const filtered = state.messages.filter((message) => {
    if (message.thread !== thread) return false;
    const author = userById(message.userId);
    return author && !author.hidden;
  });
  filtered.forEach((message) => {
    feed.append(renderMessage(message));
  });
  feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
};

const applyVideoRequestStatus = (messageId, status) => {
  if (!messageId) return false;
  let updated = false;
  state.messages = state.messages.map((message) => {
    if (message.id !== messageId) return message;
    if (message.kind !== "videoRequest") return message;
    if (message.videoStatus === status) return message;
    updated = true;
    return { ...message, videoStatus: status };
  });
  return updated;
};

const registerMessage = (payload) => {
  if (!payload?.id) return false;
  if (seenMessages.has(payload.id)) return false;
  seenMessages.add(payload.id);
  state.messages.push(payload);
  return true;
};

const handleMessageFeedClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  if (action !== "videoAccept" && action !== "videoDecline") return;
  const messageId = target.dataset.messageId;
  const userId = target.dataset.userId;
  if (!messageId || !userId) return;
  handleVideoEvent(action, { userId, messageId });
  bus.publish(action, { userId, messageId });
};

const renderHeader = () => {
  const titleEl = elements.screenTitle;
  const prefixEl = elements.channelPrefix;
  const topicEl = elements.screenTopic;
  const backButton = elements.backToGroupButton;
  const videoButton = elements.headerVideoButton;
  if (!titleEl || !prefixEl) return;

  const dmView = isDirectMessageView();
  const body = document.body;
  if (body) {
    body.classList.toggle("screen--dm", dmView);
  }

  if (backButton) {
    backButton.hidden = !dmView;
    if (dmView) {
      backButton.removeAttribute("aria-hidden");
    } else {
      backButton.setAttribute("aria-hidden", "true");
    }
  }

  if (!dmView) {
    titleEl.textContent = "Teen Cancer Support Group";
    setChannelPrefix("group");
    topicEl && (topicEl.textContent = "Chat short introduction or welcome message.");
    if (videoButton) {
      videoButton.setAttribute("aria-label", "Start video call");
      videoButton.title = "Start video call";
    }
    return;
  }

  const [, userId] = state.view.split(":");
  const user = userById(userId);
  titleEl.textContent = user ? user.displayName : "direct-message";
  setChannelPrefix("dm");
  if (user) {
    topicEl && (topicEl.textContent = `You and ${user.displayName} are catching up.`);
  } else {
    topicEl && (topicEl.textContent = "Direct message thread.");
  }
  if (videoButton) {
    if (user) {
      const label = `Start video call with ${user.displayName}`;
      videoButton.setAttribute("aria-label", label);
      videoButton.title = label;
    } else {
      videoButton.setAttribute("aria-label", "Start video call");
      videoButton.title = "Start video call";
    }
  }
};

const renderTyping = () => {
  const indicator = elements.typingIndicator;
  if (!indicator) return;
  const label = indicator.querySelector(".typing-indicator__label");
  if (!label) return;

  const feed = elements.messageFeed;
  const shouldStickToBottom = isFeedNearBottom(feed);
  const indicatorWasHidden = indicator.hidden;

  const activeIds = Object.keys(state.typing).filter((id) => Boolean(state.typing[id]));
  const remoteActiveId = activeIds.find((id) => id && id !== state.currentUserId);
  const localIsActive = activeIds.includes(state.currentUserId);
  const typingUserId = remoteActiveId ?? (localIsActive ? state.currentUserId : null);

  let nextHidden = true;
  let nextLabel = "";

  if (typingUserId) {
    const user = userById(typingUserId);
    if (user && !user.hidden) {
      nextHidden = false;
      nextLabel = `${user.displayName} is typing`;
    }
  }

  indicator.hidden = nextHidden;
  if (!nextHidden && nextLabel) {
    label.textContent = nextLabel;
  }

  if (shouldStickToBottom && indicatorWasHidden !== nextHidden) {
    window.requestAnimationFrame(() => stickFeedToBottom(feed));
  }
};

const handleRosterKeydown = (event) => {
  const item = event.target?.closest?.(".sidebar__user");
  if (!item) return;
  if (!["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  const { userId } = item.dataset ?? {};
  if (!userId) return;
  openUserProfile(userId, { trigger: item });
};

const handleProfileKeydown = (event) => {
  if (event.key !== "Escape") return;
  if (!state.profile.open) return;
  event.preventDefault();
  closeUserProfile({ returnFocus: true });
};

const handleProfileOutsidePointer = (event) => {
  if (!state.profile.open) return;
  const card = elements.userProfileCard;
  if (!card) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (card.contains(target)) return;
  const trigger = state.profile.trigger;
  if (trigger instanceof HTMLElement && trigger.contains(target)) return;
  closeUserProfile({ returnFocus: false });
};

const handleProfileReposition = () => {
  placeProfilePopover();
};

const placeProfilePopover = () => {
  if (!state.profile.open) return;
  const popover = elements.userProfilePopover;
  const card = elements.userProfileCard;
  if (!popover || !card) return;

  const { userId } = state.profile;
  if (!userId) return;

  let trigger = state.profile.trigger;
  if (!(trigger instanceof HTMLElement) || !document.contains(trigger)) {
    trigger = document.querySelector(`.sidebar__user[data-user-id="${userId}"]`);
    state.profile.trigger = trigger instanceof HTMLElement ? trigger : null;
  }

  if (!trigger) return;

  const rect = trigger.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const spacing = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top = rect.top;
  const maxTop = viewportHeight - cardRect.height - spacing;
  top = Math.min(Math.max(spacing, top), Math.max(maxTop, spacing));

  let left = rect.right + spacing;
  if (left + cardRect.width > viewportWidth - spacing) {
    left = rect.left - cardRect.width - spacing;
  }

  if (left < spacing) {
    left = Math.max(spacing, Math.min(rect.left, viewportWidth - cardRect.width - spacing));
  }

  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
};

const openUserProfile = (userId, { trigger } = {}) => {
  if (!userId) return;
  const user = userById(userId);
  if (!user) return;
  const triggerElement = trigger instanceof HTMLElement ? trigger : null;
  const alreadyOpen = state.profile.open && state.profile.userId === userId;
  state.profile.userId = userId;
  state.profile.open = true;
  state.profile.trigger = triggerElement;
  state.profile.pendingFocus = !alreadyOpen;
  renderProfilePopover();
  document.addEventListener("keydown", handleProfileKeydown);
  document.addEventListener("pointerdown", handleProfileOutsidePointer);
  window.addEventListener("resize", handleProfileReposition);
  document.addEventListener("scroll", handleProfileReposition, true);
};

const closeUserProfile = ({ returnFocus = false } = {}) => {
  if (!state.profile.open) return;
  const trigger = state.profile.trigger;
  clearProfileRosterHighlight();
  state.profile.open = false;
  state.profile.userId = null;
  state.profile.pendingFocus = false;
  state.profile.trigger = null;
  document.removeEventListener("keydown", handleProfileKeydown);
  document.removeEventListener("pointerdown", handleProfileOutsidePointer);
  window.removeEventListener("resize", handleProfileReposition);
  document.removeEventListener("scroll", handleProfileReposition, true);
  renderProfilePopover();
  if (returnFocus && trigger instanceof HTMLElement) {
    window.requestAnimationFrame(() => trigger.focus());
  }
};

const renderProfilePopover = () => {
  const popover = elements.userProfilePopover;
  if (!popover) return;
  if (!state.profile.open || !state.profile.userId) {
    clearProfileRosterHighlight();
    popover.hidden = true;
    popover.setAttribute("aria-hidden", "true");
    popover.style.visibility = "hidden";
    popover.style.top = "";
    popover.style.left = "";
    return;
  }

  const user = userById(state.profile.userId);
  if (!user) {
    closeUserProfile();
    return;
  }
  const isSelfProfile = user.id === state.currentUserId;

  let trigger = state.profile.trigger;
  if (!(trigger instanceof HTMLElement) || !document.contains(trigger)) {
    trigger = document.querySelector(`.sidebar__user[data-user-id="${state.profile.userId}"]`);
    state.profile.trigger = trigger instanceof HTMLElement ? trigger : null;
  }

  if (!state.profile.trigger) {
    closeUserProfile();
    return;
  }

  const rosterItem =
    state.profile.trigger.classList.contains("sidebar__user")
      ? state.profile.trigger
      : state.profile.trigger.closest(".sidebar__user") ??
        document.querySelector(`.sidebar__user[data-user-id="${state.profile.userId}"]`);
  clearProfileRosterHighlight();
  if (rosterItem instanceof HTMLElement) {
    rosterItem.classList.add("sidebar__user--active");
  }

  popover.hidden = false;
  popover.setAttribute("aria-hidden", "false");
  popover.style.visibility = "hidden";

  const accentColor = user.bannerColor ?? userColor(user);
  const card = elements.userProfileCard;
  if (card) {
    card.style.setProperty("--profile-accent", accentColor);
    card.style.setProperty("--profile-accent-opacity", "0.8");
    card.classList.toggle("profileCard--self", isSelfProfile);
  }

  const banner = elements.userProfileBanner;
  if (banner) {
    banner.style.background = accentColor;
  }

  const avatar = elements.userProfileAvatar;
  setAvatar(avatar, user);

  const presence = elements.userProfilePresence;
  if (presence) {
    presence.classList.toggle("profileCard__presence--offline", !user.online);
  }

  const statusEl = elements.userProfileStatus;
  if (statusEl) {
    applyProfileStatus(statusEl, user);
  }

  const nameEl = elements.userProfileName;
  if (nameEl) {
    nameEl.textContent = user.displayName ?? "Member";
    queueProfileNameFit(nameEl);
  }

  const bioEl = elements.userProfileBio;
  if (bioEl) {
    const bio = profileBio(user);
    bioEl.textContent = bio;
    bioEl.hidden = !bio;
  }

  const badgesEl = elements.userProfileBadges;
  if (badgesEl) {
    badgesEl.innerHTML = "";
    const badges = profileBadges(user);
    if (badges.length === 0) {
      badgesEl.hidden = true;
    } else {
      badgesEl.hidden = false;
      badges.forEach((badge) => {
        const chip = document.createElement("span");
        chip.className = "profileCard__badge";
        chip.textContent = badge;
        badgesEl.append(chip);
      });
    }
  }

  const messageButton = elements.userProfileMessageButton;
  if (messageButton) {
    if (isSelfProfile) {
      messageButton.hidden = true;
      messageButton.setAttribute("aria-hidden", "true");
      messageButton.disabled = true;
      messageButton.style.display = "none";
    } else {
      const targetName = user.displayName?.trim() || user?.id || "Member";
      messageButton.hidden = false;
      messageButton.removeAttribute("aria-hidden");
      messageButton.textContent = "Message";
      messageButton.setAttribute("aria-label", `Message ${targetName}`);
      messageButton.disabled = false;
      messageButton.style.display = "";
    }
  }

  const videoButton = elements.userProfileVideoButton;
  if (videoButton) {
    if (isSelfProfile) {
      videoButton.hidden = true;
      videoButton.setAttribute("aria-hidden", "true");
      videoButton.disabled = true;
      videoButton.style.display = "none";
      videoButton.removeAttribute("title");
    } else {
      videoButton.hidden = false;
      videoButton.removeAttribute("aria-hidden");
      videoButton.disabled = false;
      videoButton.style.display = "";
      videoButton.title = user.online
        ? "Start a video call"
        : "Video call will notify them when they return.";
    }
  }

  const closeButton = elements.userProfileClose;

  placeProfilePopover();
  popover.style.visibility = "visible";

  if (state.profile.pendingFocus) {
    state.profile.pendingFocus = false;
    window.requestAnimationFrame(() => {
      const focusTarget =
        !isSelfProfile && messageButton && !messageButton.hidden ? messageButton : closeButton;
      focusTarget?.focus();
    });
  }
};

const startDirectMessage = (userId, { focusComposer = true } = {}) => {
  if (!userId) return;
  state.view = `dm:${userId}`;
  renderView();
  bus.publish("switchView", { view: `dm:${userId}` });
  if (focusComposer) {
    window.requestAnimationFrame(() => {
      elements.composerInput?.focus();
    });
  }
};

const returnToGroupChat = ({ focusComposer = true } = {}) => {
  state.view = "main";
  renderView();
  bus.publish("switchView", { view: "main" });
  if (focusComposer) {
    window.requestAnimationFrame(() => {
      elements.composerInput?.focus();
    });
  }
};

const requestVideoCall = (userId) => {
  if (!userId) return;
  const caller = currentUser();
  if (!caller?.id) {
    console.warn("Cannot start video call without an active user.");
    return;
  }

  const messageId = createMessageId();
  const thread = state.view;
  const message = {
    id: messageId,
    thread,
    userId: caller.id,
    text: `${caller.displayName ?? "Member"} is requesting a video chat.`,
    timestamp: Date.now(),
    kind: "videoRequest",
    videoStatus: "pending",
  };

  if (registerMessage(message)) {
    renderFeed();
  }

  state.video = {
    state: "requesting",
    userId,
    cameraOn: true,
    microphoneOn: true,
    messageId,
  };

  renderVideo();
  bus.publish("message", message);
  bus.publish("videoRequest", { userId: caller.id, messageId });
};

const renderRoster = () => {
  const onlineList = elements.onlineRoster;
  const offlineList = elements.offlineRoster;
  const onlineCountEl = elements.onlineCount;
  const offlineCountEl = elements.offlineCount;
  const membersSection = elements.membersSection;
  const shouldShow = !isDirectMessageView();

  if (membersSection) {
    membersSection.hidden = !shouldShow;
    if (shouldShow) {
      membersSection.removeAttribute("aria-hidden");
    } else {
      membersSection.setAttribute("aria-hidden", "true");
    }
  }

  if (!shouldShow) return;
  if (!onlineList || !offlineList || !onlineCountEl || !offlineCountEl) return;

  onlineList.innerHTML = "";
  offlineList.innerHTML = "";

  const visibleUsers = state.users
    .filter((user) => !user.hidden)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const onlineUsers = visibleUsers.filter((user) => user.online);
  const offlineUsers = visibleUsers.filter((user) => !user.online);

  onlineCountEl.textContent = String(onlineUsers.length);
  offlineCountEl.textContent = String(offlineUsers.length);

  const createRosterItem = (user) => {
    const item = document.createElement("article");
    item.className = "sidebar__user";
    if (!user.online) item.classList.add("sidebar__user--offline");
    item.dataset.userId = user.id ?? "";
    item.setAttribute("role", "button");
    item.tabIndex = 0;
    item.setAttribute("aria-label", `View profile for ${user.displayName}`);

    const avatar = document.createElement("div");
    avatar.className = "sidebar__avatar";
    setAvatar(avatar, user);

    const presence = document.createElement("span");
    presence.className = "sidebar__presence";
    if (!user.online) presence.classList.add("sidebar__presence--offline");
    avatar.append(presence);

    const meta = document.createElement("div");
    meta.className = "sidebar__meta";
    const name = document.createElement("div");
    name.className = "sidebar__name";
    name.textContent = user.displayName;
    meta.append(name);

    item.append(avatar, meta);
    item.addEventListener("click", () => openUserProfile(user.id, { trigger: item }));
    item.addEventListener("keydown", handleRosterKeydown);
    return item;
  };

  const appendUsers = (container, users, emptyMessage) => {
    if (users.length === 0) {
      const empty = document.createElement("p");
      empty.className = "sidebar__empty";
      empty.textContent = emptyMessage;
      container.append(empty);
      return;
    }
    users.forEach((user) => {
      container.append(createRosterItem(user));
    });
  };

  appendUsers(onlineList, onlineUsers, "No one is online right now.");
  appendUsers(offlineList, offlineUsers, "Everyone is online!");
  renderProfilePopover();
};

const positionSelfPopover = () => {
  if (!state.selfPopoverOpen) return;
  const popover = elements.selfPopover;
  const panel = elements.selfPopoverPanel;
  const button = elements.selfSettingsButton;
  if (!popover || !panel || !button) return;
  const spacing = 12;
  const buttonRect = button.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top = buttonRect.bottom + spacing;
  let left = buttonRect.left;

  if (top + panelRect.height > viewportHeight - spacing) {
    top = Math.max(spacing, buttonRect.top - panelRect.height - spacing);
  }

  const maxLeft = viewportWidth - panelRect.width - spacing;
  left = Math.min(Math.max(left, spacing), Math.max(maxLeft, spacing));

  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
};

const focusSelfPopoverOption = () => {
  const options = elements.selfPopoverList?.querySelectorAll(".selfPopoverOption") ?? [];
  const preferred =
    Array.from(options).find((option) => option.getAttribute("aria-selected") === "true") ??
    options[0];
  if (!preferred) return;
  window.requestAnimationFrame(() => {
    preferred.focus();
  });
};

const handleSelfPopoverListKeydown = (event) => {
  if (!state.selfPopoverOpen) return;
  const targetOption = event.target?.closest?.(".selfPopoverOption");
  const options = Array.from(
    elements.selfPopoverList?.querySelectorAll(".selfPopoverOption") ?? [],
  );
  if (options.length === 0) return;

  const currentIndex = targetOption ? options.indexOf(targetOption) : -1;
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % options.length;
    } else if (event.key === "ArrowUp") {
      if (currentIndex < 0) {
        nextIndex = options.length - 1;
      } else {
        nextIndex = (currentIndex - 1 + options.length) % options.length;
      }
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    }
    options[nextIndex]?.focus();
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    const option = targetOption ?? options[0];
    const userId = option?.dataset?.userId;
    if (!userId) return;
    if (userId !== state.currentUserId) {
      setCurrentUser(userId, { focusComposer: true });
    } else {
      closeUserPopover();
      elements.composerInput?.focus();
    }
  }
};

const handleSelfPopoverKeydown = (event) => {
  if (!state.selfPopoverOpen) return;
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeUserPopover({ returnFocus: true });
};

const handleSelfPopoverOutsidePointer = (event) => {
  if (!state.selfPopoverOpen) return;
  const popover = elements.selfPopover;
  const button = elements.selfSettingsButton;
  if (!popover || !button) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (popover.contains(target) || button.contains(target)) return;
  closeUserPopover();
};

const openUserPopover = () => {
  if (state.selfPopoverOpen) return;
  if (state.users.length <= 1) return;
  const popover = elements.selfPopover;
  const button = elements.selfSettingsButton;
  if (!popover || !button) return;
  renderUserPopover();
  popover.hidden = false;
  button.setAttribute("aria-expanded", "true");
  state.selfPopoverOpen = true;
  document.addEventListener("pointerdown", handleSelfPopoverOutsidePointer);
  document.addEventListener("keydown", handleSelfPopoverKeydown);
  window.addEventListener("resize", positionSelfPopover);
  window.addEventListener("scroll", positionSelfPopover, true);
  positionSelfPopover();
  focusSelfPopoverOption();
};

const closeUserPopover = ({ returnFocus = false } = {}) => {
  if (!state.selfPopoverOpen) return;
  const popover = elements.selfPopover;
  const button = elements.selfSettingsButton;
  if (popover) {
    popover.hidden = true;
  }
  if (button) {
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) {
      button.focus();
    }
  }
  state.selfPopoverOpen = false;
  document.removeEventListener("pointerdown", handleSelfPopoverOutsidePointer);
  document.removeEventListener("keydown", handleSelfPopoverKeydown);
  window.removeEventListener("resize", positionSelfPopover);
  window.removeEventListener("scroll", positionSelfPopover, true);
};

const toggleUserPopover = () => {
  if (state.selfPopoverOpen) {
    closeUserPopover();
  } else {
    openUserPopover();
  }
};

const setCurrentUser = (userId, { focusComposer = false, announce = true } = {}) => {
  const hasUser = state.users.some((user) => user.id === userId);
  const nextUserId = hasUser ? userId : null;
  const previousUserId = state.currentUserId;
  if (previousUserId === nextUserId) {
    closeUserPopover();
    if (focusComposer) {
      elements.composerInput?.focus();
    }
    return;
  }

  if (selfTypingActive && previousUserId) {
    bus.publish("typingStop", { userId: previousUserId });
  }

  if (previousUserId) {
    delete state.typing[previousUserId];
  }

  updateCurrentUserId(nextUserId, { announce });
  cancelTypingTimeout();
  selfTypingActive = false;

  renderSelfCard();
  renderUserPopover();
  renderComposer();
  renderTyping();
  closeUserPopover();

  if (focusComposer) {
    elements.composerInput?.focus();
  }
};

const renderUserPopover = () => {
  const popover = elements.selfPopover;
  const list = elements.selfPopoverList;
  if (!popover || !list) return;

  list.innerHTML = "";

  const selectableUsers = state.users.filter((user) => !user.hidden);

  if (selectableUsers.length <= 1) {
    closeUserPopover();
    const empty = document.createElement("p");
    empty.className = "selfPopover__empty";
    empty.textContent = "Only one user available.";
    list.append(empty);
    return;
  }

  selectableUsers.forEach((user) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "selfPopoverOption";
    option.dataset.userId = user.id;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", user.id === state.currentUserId ? "true" : "false");

    const avatar = document.createElement("div");
    avatar.className = "selfPopoverOption__avatar";
    setAvatar(avatar, user);

    const meta = document.createElement("div");
    meta.className = "selfPopoverOption__meta";

    const name = document.createElement("span");
    name.className = "selfPopoverOption__name";
    name.textContent = user.displayName;
    meta.append(name);

    if (!user.online) {
      option.classList.add("selfPopoverOption--offline");
      option.setAttribute("data-status", "offline");
    } else {
      option.removeAttribute("data-status");
    }

    option.append(avatar, meta);
    list.append(option);
  });

  if (state.selfPopoverOpen) {
    positionSelfPopover();
  }
};

const renderSelfCard = () => {
  const container = elements.sidebarSelf;
  if (!container) return;
  const avatarEl = elements.selfAvatar;
  const nameEl = elements.selfName;
  const presenceEl = elements.selfPresence;
  const settingsButton = elements.selfSettingsButton;
  const visibleUsers = state.users.filter((user) => !user.hidden);
  const canSwitchUser = visibleUsers.length > 1;
  if (settingsButton) {
    settingsButton.disabled = !canSwitchUser;
    settingsButton.title = canSwitchUser
      ? "Switch active user"
      : "Add more users in the control panel to enable switching.";
    if (!canSwitchUser) {
      settingsButton.setAttribute("aria-expanded", "false");
      closeUserPopover();
    }
  }
  const attachPresence = () => {
    if (!avatarEl || !presenceEl) return;
    if (presenceEl.parentElement !== avatarEl) {
      avatarEl.append(presenceEl);
    }
  };
  const setPresenceState = (label, isOnline) => {
    if (!presenceEl) return;
    presenceEl.setAttribute("aria-label", label);
    presenceEl.setAttribute("title", label);
    presenceEl.classList.toggle("sidebar__presence--offline", !isOnline);
  };
  let user = currentUser();
  if (!user || user.hidden) {
    const fallbackId = determineDefaultUser(state.users);
    updateCurrentUserId(fallbackId);
    user = currentUser();
  }
  if (!user || user.hidden) {
    if (nameEl) {
      nameEl.textContent = "Guest User";
      queueProfileNameFit(nameEl);
    }
    container.classList.add("sidebar__self--offline");
    if (avatarEl) {
      avatarEl.textContent = "?";
      avatarEl.style.background = "var(--surface-accent-strong)";
      avatarEl.style.color = "var(--text-primary)";
    }
    attachPresence();
    setPresenceState("Offline", false);
    return;
  }
  setAvatar(avatarEl, user);
  attachPresence();
  if (nameEl) {
    nameEl.textContent = user.displayName;
    queueProfileNameFit(nameEl);
  }
  const online = Boolean(user.online);
  const presenceLabel = online ? "Online" : "Offline";
  setPresenceState(presenceLabel, online);
  container.classList.toggle("sidebar__self--offline", !online);
};

const renderComposer = () => {
  const input = elements.composerInput;
  const send = elements.composerSend;
  const avatar = elements.composerAvatar;
  if (!input || !send) return;

  const thread = state.view;
  const user = currentUser();

  const isDM = thread.startsWith("dm:");
  if (isDM) {
    const [, userId] = thread.split(":");
    const counterpart = userById(userId);
    input.placeholder = counterpart
      ? `Message @${counterpart.displayName}`
      : "Message direct thread";
  } else {
    input.placeholder = "Message chat group";
  }

  if (avatar) {
    setAvatar(avatar, user);
  }
  updateComposerSendState();
  autoSizeComposer();
};

const renderDmProfile = () => {
  const panel = elements.dmProfilePanel;
  if (!panel) return;

  const showPanel = isDirectMessageView();
  if (!showPanel) {
    panel.hidden = true;
    panel.setAttribute("aria-hidden", "true");
    return;
  }

  const [, userId] = state.view.split(":");
  const user = userById(userId);
  if (!user || user.hidden) {
    panel.hidden = true;
    panel.setAttribute("aria-hidden", "true");
    return;
  }

  const isSelfProfile = user.id === state.currentUserId;

  panel.hidden = false;
  panel.removeAttribute("aria-hidden");

  const accentColor = user.bannerColor ?? userColor(user);
  const card = elements.dmProfileCard;
  if (card) {
    card.style.setProperty("--profile-accent", accentColor);
    card.style.setProperty("--profile-accent-opacity", "0.8");
    card.classList.toggle("profileCard--self", isSelfProfile);
  }

  const banner = elements.dmProfileBanner;
  if (banner) {
    banner.style.background = accentColor;
  }

  setAvatar(elements.dmProfileAvatar, user);

  const presence = elements.dmProfilePresence;
  if (presence) {
    presence.classList.toggle("profileCard__presence--offline", !user.online);
  }

  const statusEl = elements.dmProfileStatus;
  if (statusEl) {
    applyProfileStatus(statusEl, user);
  }

  const nameEl = elements.dmProfileName;
  if (nameEl) {
    nameEl.textContent = user.displayName ?? "Member";
    queueProfileNameFit(nameEl);
  }

  const bioEl = elements.dmProfileBio;
  if (bioEl) {
    const bio = profileBio(user);
    bioEl.textContent = bio;
    bioEl.hidden = !bio;
  }

  const badgesEl = elements.dmProfileBadges;
  if (badgesEl) {
    badgesEl.innerHTML = "";
    const badges = profileBadges(user);
    if (badges.length === 0) {
      badgesEl.hidden = true;
    } else {
      badgesEl.hidden = false;
      badges.forEach((badge) => {
        const chip = document.createElement("span");
        chip.className = "profileCard__badge";
        chip.textContent = badge;
        badgesEl.append(chip);
      });
    }
  }

  const messageButton = elements.dmProfileMessageButton;
  if (messageButton) {
    messageButton.hidden = true;
    messageButton.setAttribute("aria-hidden", "true");
    messageButton.disabled = true;
    messageButton.style.display = "none";
  }

  const videoButton = elements.dmProfileVideoButton;
  if (videoButton) {
    if (isSelfProfile) {
      videoButton.hidden = true;
      videoButton.setAttribute("aria-hidden", "true");
      videoButton.disabled = true;
      videoButton.style.display = "none";
      videoButton.removeAttribute("title");
    } else {
      videoButton.hidden = false;
      videoButton.removeAttribute("aria-hidden");
      videoButton.disabled = false;
      videoButton.style.display = "";
      videoButton.title = user.online
        ? `Start a video call with ${user.displayName}`
        : "Video call will notify them when they return.";
    }
  }
};

const autoSizeComposer = () => {
  const input = elements.composerInput;
  if (!input) return;
  input.style.removeProperty("height");
  const computed = getComputedStyle(input);
  const lineHeight = Number.parseFloat(computed.lineHeight) || 20;
  const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
  const borderTop = Number.parseFloat(computed.borderTopWidth) || 0;
  const borderBottom = Number.parseFloat(computed.borderBottomWidth) || 0;
  const verticalChrome = paddingTop + paddingBottom + borderTop + borderBottom;
  const maxHeight = Number.parseFloat(computed.maxHeight) || lineHeight * 6 + verticalChrome;
  input.rows = 1;
  const contentHeight = input.scrollHeight - verticalChrome;
  const contentRows = Math.ceil(contentHeight / lineHeight);
  const maxRows = Math.max(1, Math.floor((maxHeight - verticalChrome) / lineHeight));
  input.rows = Math.min(Math.max(contentRows, 1), maxRows);
};

const updateComposerSendState = () => {
  const input = elements.composerInput;
  const send = elements.composerSend;
  if (!input || !send) return;
  const hasUser = Boolean(currentUser());
  const hasText = Boolean(input.value.trim());
  send.disabled = !hasUser || !hasText;
  send.title = hasUser ? "Send message" : "No available user";
};

const setSelfTyping = (typing) => {
  if (!state.currentUserId) return;
  if (selfTypingActive === typing) return;
  selfTypingActive = typing;
  bus.publish(typing ? "typingStart" : "typingStop", { userId: state.currentUserId });
};

const cancelTypingTimeout = () => {
  if (typingTimeoutId) {
    window.clearTimeout(typingTimeoutId);
    typingTimeoutId = null;
  }
};

const scheduleTypingStop = () => {
  cancelTypingTimeout();
  typingTimeoutId = window.setTimeout(() => {
    setSelfTyping(false);
    typingTimeoutId = null;
  }, 1200);
};

const handleComposerInput = () => {
  autoSizeComposer();
  updateComposerSendState();
  const input = elements.composerInput;
  if (!input || !state.currentUserId) return;
  if (input.value.trim().length > 0) {
    setSelfTyping(true);
    scheduleTypingStop();
  } else {
    cancelTypingTimeout();
    setSelfTyping(false);
  }
};

const sendComposerMessage = () => {
  const input = elements.composerInput;
  if (!input || !state.currentUserId) return;
  const rawText = input.value;
  const trimmed = rawText.trim();
  if (!trimmed) return;
  const payload = {
    id: createMessageId(),
    thread: state.view,
    userId: state.currentUserId,
    text: rawText.replace(/\s+$/, ""),
    timestamp: Date.now(),
  };
  const inserted = registerMessage(payload);
  if (inserted) {
    renderFeed();
  }
  bus.publish("message", payload);
  input.value = "";
  autoSizeComposer();
  updateComposerSendState();
  cancelTypingTimeout();
  setSelfTyping(false);
  input.focus();
};

const handleComposerKeydown = (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendComposerMessage();
  }
  if (event.key === "Escape") {
    const input = elements.composerInput;
    if (!input) return;
    input.value = "";
    autoSizeComposer();
    updateComposerSendState();
    cancelTypingTimeout();
    setSelfTyping(false);
  }
};

const bindComposerControls = () => {
  const input = elements.composerInput;
  const send = elements.composerSend;
  if (!input || !send) return;
  input.addEventListener("input", handleComposerInput);
  input.addEventListener("keydown", handleComposerKeydown);
  send.addEventListener("click", (event) => {
    event.preventDefault();
    sendComposerMessage();
  });
};

const bindSelfControls = () => {
  const button = elements.selfSettingsButton;
  const list = elements.selfPopoverList;
  const close = elements.selfPopoverClose;
  if (button) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (button.disabled) return;
      toggleUserPopover();
    });
  }
  if (close) {
    close.addEventListener("click", () => {
      closeUserPopover({ returnFocus: true });
    });
  }
  if (list) {
    list.addEventListener("keydown", handleSelfPopoverListKeydown);
    list.addEventListener("click", (event) => {
      const option = event.target.closest(".selfPopoverOption");
      if (!option) return;
      const { userId } = option.dataset;
      if (!userId) return;
      if (userId !== state.currentUserId) {
        setCurrentUser(userId, { focusComposer: true });
      } else {
        closeUserPopover();
        elements.composerInput?.focus();
      }
    });
  }
};

const bindProfileControls = () => {
  const close = elements.userProfileClose;
  const message = elements.userProfileMessageButton;
  const video = elements.userProfileVideoButton;

  if (close) {
    close.addEventListener("click", () => {
      closeUserProfile({ returnFocus: true });
    });
  }

  if (message) {
    message.addEventListener("click", () => {
      const { userId } = state.profile;
      if (!userId) return;
      closeUserProfile();
      startDirectMessage(userId, { focusComposer: true });
    });
  }

  if (video) {
    video.addEventListener("click", () => {
      const { userId } = state.profile;
      if (!userId) return;
      closeUserProfile({ returnFocus: false });
      requestVideoCall(userId);
    });
  }
};

const bindDmProfileControls = () => {
  const message = elements.dmProfileMessageButton;
  const video = elements.dmProfileVideoButton;
  if (message) {
    message.addEventListener("click", () => {
      if (!isDirectMessageView()) return;
      elements.composerInput?.focus();
    });
  }
  if (video) {
    video.addEventListener("click", () => {
      if (!isDirectMessageView()) return;
      const [, userId] = state.view.split(":");
      if (!userId) return;
      requestVideoCall(userId);
    });
  }
};

const renderVideo = () => {
  const modal = elements.videoModal;
  if (!modal) return;

  const previousState = lastVideoState;
  const pending = elements.videoModalPending;
  const actions = elements.videoModalActions;
  const toolbar = elements.videoModalToolbar;
  const cameraToggle = elements.videoModalCameraToggle;
  const microphoneToggle = elements.videoModalMicrophoneToggle;
  const endButton = elements.videoModalEnd;
  const acceptButton = elements.videoModalAccept;
  const declineButton = elements.videoModalDecline;
  const closeButton = elements.videoModalClose;

  const targetUser = state.video.userId ? userById(state.video.userId) : null;
  const targetDisplayName = targetUser?.displayName ?? "User";
  const cameraOn = state.video.cameraOn !== false;
  const microphoneOn = state.video.microphoneOn !== false;
  const isRequesting = state.video.state === "requesting";
  const isRequested = state.video.state === "requested";
  const modalVisibleStates = new Set(["requesting", "accepted", "active"]);
  const modalShouldShow = modalVisibleStates.has(state.video.state);

  modal.hidden = !modalShouldShow;
  modal.dataset.state = modalShouldShow ? "active" : "idle";

  const titleEl = elements.videoModalTitle;
  if (titleEl) {
    titleEl.textContent =
      modalShouldShow && targetUser
        ? `Video Chat with ${targetDisplayName}`
        : "Video Chat";
  }

  if (toolbar) {
    toolbar.hidden = !modalShouldShow;
  }

  if (actions) {
    actions.hidden = !isRequested;
  }

  if (acceptButton) {
    acceptButton.hidden = !isRequested;
  }

  if (declineButton) {
    declineButton.hidden = !isRequested;
  }

  if (closeButton) {
    closeButton.hidden = !modalShouldShow;
  }

  if (cameraToggle) {
    cameraToggle.dataset.status = cameraOn ? "on" : "off";
    cameraToggle.setAttribute("aria-pressed", cameraOn ? "true" : "false");
  }

  if (microphoneToggle) {
    microphoneToggle.dataset.status = microphoneOn ? "on" : "off";
    microphoneToggle.setAttribute("aria-pressed", microphoneOn ? "true" : "false");
  }

  if (endButton) {
    endButton.disabled = !modalShouldShow;
  }

  if (isRequesting) {
    if (previousState !== "requesting") {
      videoPendingIndicatorDismissed = false;
      if (videoPendingIndicatorTimeoutId) {
        window.clearTimeout(videoPendingIndicatorTimeoutId);
        videoPendingIndicatorTimeoutId = null;
      }
    }
    if (!videoPendingIndicatorDismissed) {
      if (pending) {
        pending.hidden = false;
      }
      if (!videoPendingIndicatorTimeoutId) {
        videoPendingIndicatorTimeoutId = window.setTimeout(() => {
          videoPendingIndicatorDismissed = true;
          if (elements.videoModalPending) {
            elements.videoModalPending.hidden = true;
          }
          videoPendingIndicatorTimeoutId = null;
        }, 5000);
      }
    } else if (pending) {
      pending.hidden = true;
    }
  } else {
    if (pending) {
      pending.hidden = true;
    }
    if (videoPendingIndicatorTimeoutId) {
      window.clearTimeout(videoPendingIndicatorTimeoutId);
      videoPendingIndicatorTimeoutId = null;
    }
    if (previousState === "requesting") {
      videoPendingIndicatorDismissed = false;
    }
  }

  lastVideoState = state.video.state;
};

const renderView = () => {
  renderHeader();
  renderFeed();
  renderTyping();
  renderRoster();
  renderDmProfile();
  renderSelfCard();
  renderUserPopover();
  renderComposer();
  renderVideo();
  renderProfilePopover();
};

const handlePresence = ({ userId, online }) => {
  state.users = state.users.map((user) =>
    user.id === userId ? { ...user, online } : user,
  );
  renderHeader();
  renderRoster();
  renderDmProfile();
  renderSelfCard();
  renderUserPopover();
};

const upsertUser = (incoming) => {
  if (!incoming?.id) return null;
  const copy = structuredClone(incoming);
  const index = state.users.findIndex((user) => user.id === copy.id);
  if (index >= 0) {
    state.users[index] = { ...state.users[index], ...copy };
  } else {
    state.users.push(copy);
  }
  return copy;
};

const handleUserUpdated = ({ user }) => {
  const updated = upsertUser(user);
  if (!updated) return;

  if (updated.hidden) {
    delete state.typing[updated.id];
    if (state.view === `dm:${updated.id}`) {
      state.view = "main";
    }
    if (state.currentUserId === updated.id) {
      updateCurrentUserId(determineDefaultUser(state.users));
      cancelTypingTimeout();
      selfTypingActive = false;
    }
    if (state.profile?.userId === updated.id) {
      closeUserProfile({ returnFocus: false });
    }
  } else {
    const current = currentUser();
    if (!current || current.hidden) {
      updateCurrentUserId(determineDefaultUser(state.users));
    }
  }

  renderView();
};

const handleUserRemoved = ({ userId, redirectTo }) => {
  if (!userId) return;
  const existing = userById(userId);
  if (!existing) return;

  state.users = state.users.filter((user) => user.id !== userId);

  if (redirectTo) {
    state.messages = state.messages.map((message) =>
      message.userId === userId ? { ...message, userId: redirectTo } : message,
    );
    if (state.typing[userId]) {
      state.typing[redirectTo] = state.typing[userId];
    }
    delete state.typing[userId];
    if (state.view === `dm:${userId}`) {
      state.view = `dm:${redirectTo}`;
    }
    if (state.currentUserId === userId) {
      updateCurrentUserId(redirectTo);
      cancelTypingTimeout();
      selfTypingActive = false;
    }
  } else {
    state.messages = state.messages.filter((message) => message.userId !== userId);
    delete state.typing[userId];
    if (state.view === `dm:${userId}`) {
      state.view = "main";
    }
    if (state.currentUserId === userId) {
      updateCurrentUserId(determineDefaultUser(state.users));
      cancelTypingTimeout();
      selfTypingActive = false;
    }
  }

  if (state.profile?.userId === userId) {
    closeUserProfile({ returnFocus: false });
  }

  renderView();
};

const handleMessage = (payload) => {
  if (registerMessage(payload)) {
    renderFeed();
  }
};

const handleTyping = (userId, typing) => {
  if (!userId) return;
  if (typing) {
    state.typing[userId] = true;
  } else {
    delete state.typing[userId];
  }
  renderTyping();
};

const handleSwitchView = ({ view }) => {
  state.view = view;
  renderView();
};

const handleVideoEvent = (type, payload) => {
  const incomingMessageId = payload?.messageId ?? null;
  switch (type) {
    case "videoRequest": {
      state.video = {
        state: "requested",
        userId: payload?.userId ?? null,
        cameraOn: true,
        microphoneOn: true,
        messageId: incomingMessageId,
      };
      if (applyVideoRequestStatus(incomingMessageId, "pending")) {
        renderFeed();
      }
      break;
    }
    case "videoAccept": {
      const messageId = incomingMessageId ?? state.video.messageId ?? null;
      const participantId = state.video.userId ?? payload?.userId ?? null;
      state.video = {
        state: "accepted",
        userId: participantId,
        cameraOn: state.video.cameraOn !== false,
        microphoneOn: state.video.microphoneOn !== false,
        messageId,
      };
      if (applyVideoRequestStatus(messageId, "accepted")) {
        renderFeed();
      }
      break;
    }
    case "videoDecline": {
      const messageId = incomingMessageId ?? state.video.messageId ?? null;
      if (applyVideoRequestStatus(messageId, "declined")) {
        renderFeed();
      }
      state.video = defaultVideoState();
      break;
    }
    case "videoEnd": {
      const messageId = incomingMessageId ?? state.video.messageId ?? null;
      if (applyVideoRequestStatus(messageId, "ended")) {
        renderFeed();
      }
      state.video = defaultVideoState();
      break;
    }
    default:
      break;
  }
  renderVideo();
};

const handleTakeStart = () => {
  state.messages = [];
  state.typing = {};
  seenMessages.clear();
  selfTypingActive = false;
  cancelTypingTimeout();
  closeUserPopover();
  closeUserProfile();
  closeMessageEditor();
  renderFeed();
  renderTyping();
};

const handleTakeReset = () => {
  state.messages = [];
  state.view = "main";
  state.video = defaultVideoState();
  state.typing = {};
  seenMessages.clear();
  selfTypingActive = false;
  cancelTypingTimeout();
  closeUserPopover();
  closeUserProfile();
  closeMessageEditor();
  renderView();
};

const toggleVideoSetting = (key) => {
  if (!key) return;
  if (state.video.state === "idle") return;
  const isEnabled = state.video[key] !== false;
  state.video = {
    ...state.video,
    [key]: !isEnabled,
  };
  renderVideo();
};

const bindFeedControls = () => {
  const feed = elements.messageFeed;
  if (!feed) return;
  feed.addEventListener("click", handleMessageFeedClick);
  feed.addEventListener("contextmenu", handleMessageContextMenu);
  feed.addEventListener("scroll", closeMessageContextMenu);
};

const bindMessageMenuControls = () => {
  elements.messageMenu?.addEventListener("click", handleMessageMenuClick);
  document.addEventListener("click", handleMessageMenuOutsideClick);
  document.addEventListener("keydown", handleMessageMenuKeydown);
  window.addEventListener("resize", closeMessageContextMenu);
};

const bindModalControls = () => {
  elements.videoModalAccept.addEventListener("click", () =>
    bus.publish("videoAccept", { userId: state.video.userId }),
  );
  elements.videoModalDecline.addEventListener("click", () =>
    bus.publish("videoDecline", { userId: state.video.userId }),
  );
  elements.videoModalClose.addEventListener("click", () => {
    state.video = defaultVideoState();
    renderVideo();
  });
  elements.videoModalCameraToggle.addEventListener("click", () =>
    toggleVideoSetting("cameraOn"),
  );
  elements.videoModalMicrophoneToggle.addEventListener("click", () =>
    toggleVideoSetting("microphoneOn"),
  );
  elements.videoModalEnd.addEventListener("click", () => {
    if (state.video.state === "idle") return;
    const payload = {
      ...(state.video.userId ? { userId: state.video.userId } : {}),
      ...(state.video.messageId ? { messageId: state.video.messageId } : {}),
    };
    handleVideoEvent("videoEnd", payload);
    bus.publish("videoEnd", payload);
  });
};

const bindMessageEditorControls = () => {
  elements.messageEditorForm?.addEventListener("submit", handleMessageEditorSubmit);
  elements.messageEditorCancel?.addEventListener("click", closeMessageEditor);
  elements.messageEditorClose?.addEventListener("click", closeMessageEditor);
  elements.messageEditorBackdrop?.addEventListener("click", closeMessageEditor);
  document.addEventListener("keydown", handleMessageEditorKeydown);
};

const getPendingVideoRequest = () => {
  if (
    state.video.state === "requested" &&
    state.video.userId &&
    state.video.messageId
  ) {
    return {
      userId: state.video.userId,
      messageId: state.video.messageId,
    };
  }
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const message = state.messages[index];
    if (!message || message.kind !== "videoRequest") continue;
    const status = message.videoStatus ?? "pending";
    if (status !== "pending") continue;
    if (!message.userId || !message.id) continue;
    return {
      userId: message.userId,
      messageId: message.id,
    };
  }
  return null;
};

const handleVideoHotkeys = (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable)
  ) {
    return;
  }
  if (isMessageEditorOpen()) return;

  const key = (event.key ?? "").toLowerCase();
  let action = null;
  switch (key) {
    case "a":
      action = "videoAccept";
      break;
    case "d":
      action = "videoDecline";
      break;
    case "e":
      action = "videoEnd";
      break;
    default:
      return;
  }

  if (action === "videoEnd") {
    if (state.video.state === "idle") return;
    event.preventDefault();
    const payload = {
      ...(state.video.userId ? { userId: state.video.userId } : {}),
      ...(state.video.messageId ? { messageId: state.video.messageId } : {}),
    };
    handleVideoEvent(action, payload);
    bus.publish(action, payload);
    return;
  }

  const pendingRequest = getPendingVideoRequest();
  if (!pendingRequest) return;

  event.preventDefault();
  handleVideoEvent(action, pendingRequest);
  bus.publish(action, pendingRequest);
};

const bindHotkeys = () => {
  window.addEventListener("keydown", handleVideoHotkeys);
};

const bindHeaderControls = () => {
  const back = elements.backToGroupButton;
  if (back) {
    back.addEventListener("click", () => {
      if (!isDirectMessageView()) return;
      returnToGroupChat({ focusComposer: true });
    });
  }
};

const cacheElements = () => {
  elements.appRoot = document.querySelector(".screen__app");
  elements.messageFeed = document.getElementById("messageFeed");
  elements.messageMenu = document.getElementById("messageMenu");
  elements.messageEditorModal = document.getElementById("messageEditorModal");
  elements.messageEditorBackdrop = document.getElementById("messageEditorBackdrop");
  elements.messageEditorForm = document.getElementById("messageEditorForm");
  elements.messageEditorTitle = document.getElementById("messageEditorTitle");
  elements.messageEditorMeta = document.getElementById("messageEditorMeta");
  elements.messageEditorInput = document.getElementById("messageEditorInput");
  elements.messageEditorError = document.getElementById("messageEditorError");
  elements.messageEditorCancel = document.getElementById("messageEditorCancel");
  elements.messageEditorClose = document.getElementById("messageEditorClose");
  elements.screenTitle = document.getElementById("screenTitle");
  elements.screenTopic = document.getElementById("screenTopic");
  elements.channelPrefix = document.querySelector(".screen__channelPrefix");
  elements.backToGroupButton = document.getElementById("backToGroupButton");
  elements.headerVideoButton = document.getElementById("headerVideoButton");
  elements.composerInput = document.getElementById("composerInput");
  elements.composerSend = document.getElementById("composerSend");
  elements.composerAvatar = document.getElementById("composerAvatar");
  elements.onlineRoster = document.getElementById("onlineRoster");
  elements.onlineCount = document.getElementById("onlineCount");
  elements.offlineRoster = document.getElementById("offlineRoster");
  elements.offlineCount = document.getElementById("offlineCount");
  elements.membersSection = document.querySelector(".sidebar__section--members");
  elements.sidebarSelf = document.getElementById("sidebarSelf");
  elements.selfAvatar = document.getElementById("selfAvatar");
  elements.selfName = document.getElementById("selfName");
  elements.selfPresence = document.getElementById("selfPresence");
  elements.selfSettingsButton = document.getElementById("selfSettingsButton");
  elements.selfPopover = document.getElementById("selfPopover");
  elements.selfPopoverPanel = document.getElementById("selfPopoverPanel");
  elements.selfPopoverList = document.getElementById("selfPopoverList");
  elements.selfPopoverClose = document.getElementById("selfPopoverClose");
  elements.typingIndicator = document.getElementById("typingIndicator");
  elements.videoModal = document.getElementById("videoModal");
  elements.videoModalTitle = document.getElementById("videoCallModalTitle");
  elements.videoModalAccept = document.getElementById("videoModalAccept");
  elements.videoModalDecline = document.getElementById("videoModalDecline");
  elements.videoModalClose = document.getElementById("videoModalClose");
  elements.videoModalPending = document.getElementById("videoModalPending");
  elements.videoModalActions = document.getElementById("videoModalActions");
  elements.videoModalToolbar = document.getElementById("videoModalToolbar");
  elements.videoModalCameraToggle = document.getElementById("videoModalCameraToggle");
  elements.videoModalMicrophoneToggle = document.getElementById("videoModalMicrophoneToggle");
  elements.videoModalEnd = document.getElementById("videoModalEnd");
  elements.userProfilePopover = document.getElementById("userProfilePopover");
  elements.userProfileCard = document.getElementById("userProfileCard");
  elements.userProfileBanner = document.getElementById("userProfileBanner");
  elements.userProfileAvatar = document.getElementById("userProfileAvatar");
  elements.userProfilePresence = document.getElementById("userProfilePresence");
  elements.userProfileStatus = document.getElementById("userProfileStatus");
  elements.userProfileName = document.getElementById("userProfileName");
  elements.userProfileBio = document.getElementById("userProfileBio");
  elements.userProfileBadges = document.getElementById("userProfileBadges");
  elements.userProfileMessageButton = document.getElementById("userProfileMessageButton");
  elements.userProfileVideoButton = document.getElementById("userProfileVideoButton");
  elements.userProfileClose = document.getElementById("userProfileClose");
  elements.dmProfilePanel = document.getElementById("dmProfilePanel");
  elements.dmProfileCard = document.getElementById("dmProfileCard");
  elements.dmProfileBanner = document.getElementById("dmProfileBanner");
  elements.dmProfileAvatar = document.getElementById("dmProfileAvatar");
  elements.dmProfilePresence = document.getElementById("dmProfilePresence");
  elements.dmProfileStatus = document.getElementById("dmProfileStatus");
  elements.dmProfileName = document.getElementById("dmProfileName");
  elements.dmProfileBio = document.getElementById("dmProfileBio");
  elements.dmProfileBadges = document.getElementById("dmProfileBadges");
  elements.dmProfileMessageButton = document.getElementById("dmProfileMessageButton");
  elements.dmProfileVideoButton = document.getElementById("dmProfileVideoButton");

  queueProfileNameFit(elements.userProfileName);
  queueProfileNameFit(elements.dmProfileName);
  queueProfileNameFit(elements.selfName);
};

const handleUiScale = ({ scale }) => {
  applyDocumentScale(scale ?? SCALE_DEFAULT);
};

const registerBusHandlers = () => {
  bus.subscribe("presence", handlePresence);
  bus.subscribe("userUpdated", handleUserUpdated);
  bus.subscribe("userRemoved", handleUserRemoved);
  bus.subscribe("message", (payload) => handleMessage(payload));
  bus.subscribe("messageDelete", handleMessageDeleted);
  bus.subscribe("messageEdit", handleMessageEdit);
  bus.subscribe("messageReorder", handleMessageReorder);
  bus.subscribe("typingStart", ({ userId }) => handleTyping(userId, true));
  bus.subscribe("typingStop", ({ userId }) => handleTyping(userId, false));
  bus.subscribe("switchView", handleSwitchView);
  ["videoRequest", "videoAccept", "videoDecline", "videoEnd"].forEach((event) => {
    bus.subscribe(event, (payload) => handleVideoEvent(event, payload));
  });
  bus.subscribe("takeStart", handleTakeStart);
  bus.subscribe("takeReset", handleTakeReset);
  bus.subscribe("uiScale", handleUiScale);
  bus.subscribe("activeUserChange", ({ userId }) =>
    setCurrentUser(userId, { focusComposer: false, announce: false }),
  );
  bus.subscribe("activeUserRequest", () => {
    bus.publish("activeUserChange", { userId: state.currentUserId });
  });
};

const determineDefaultUser = (users) => {
  const visible = users.filter((user) => !user.hidden);
  return visible[0]?.id ?? users[0]?.id ?? null;
};

const init = async () => {
  cacheElements();
  applyDocumentScale(currentScale);
  bindComposerControls();
  bindSelfControls();
  bindProfileControls();
  bindDmProfileControls();
  bindFeedControls();
  bindMessageMenuControls();
  bindModalControls();
  bindMessageEditorControls();
  bindHotkeys();
  bindHeaderControls();
  registerBusHandlers();
  announceReady();
  state.users = await loadUsers();
  updateCurrentUserId(determineDefaultUser(state.users));
  renderView();
  elements.composerInput?.focus();
};

window.addEventListener("DOMContentLoaded", init);
