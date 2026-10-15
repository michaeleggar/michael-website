const CHANNEL_NAME = "chat_app_legacy_bus";

let broadcastChannel = null;
let messageTarget = null;
let messageListener = null;
const listeners = new Map();

const ensureChannel = () => {
  if (broadcastChannel || messageListener) return;
  if (window.BroadcastChannel) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.addEventListener("message", (event) => {
      dispatch(event.data);
    });
  } else {
    const fallbackTarget = window.opener ?? (window.parent !== window ? window.parent : null);
    if (!fallbackTarget) {
      console.warn("No broadcast channel support and no window target available.");
      return;
    }
    messageTarget = fallbackTarget;
    messageListener = (event) => dispatch(event.data);
    window.addEventListener("message", messageListener);
  }
};

const dispatch = (payload) => {
  if (!payload?.type) return;
  const callbacks = listeners.get(payload.type);
  if (!callbacks) return;
  callbacks.forEach((cb) => cb(payload));
};

export const bus = {
  publish(type, payload) {
    ensureChannel();
    const message = { ...payload, type };
    if (broadcastChannel) {
      broadcastChannel.postMessage(message);
    } else if (messageTarget) {
      messageTarget.postMessage(message, "*");
    } else {
      console.warn("No message target for bus publish");
    }
  },
  subscribe(type, callback) {
    ensureChannel();
    if (!listeners.has(type)) {
      listeners.set(type, new Set());
    }
    listeners.get(type).add(callback);
    return () => listeners.get(type)?.delete(callback);
  },
  destroy() {
    listeners.clear();
    if (broadcastChannel) {
      broadcastChannel.close();
      broadcastChannel = null;
    }
    if (messageListener) {
      window.removeEventListener("message", messageListener);
      messageListener = null;
    }
    messageTarget = null;
  },
};
