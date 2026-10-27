// Lets a host page drive an embedded demo the way the crew did on set: cue
// scripted lines with a typing delay, and reset the scene between takes.
//
//   import { connect } from "/projects/chatapp/demo/bridge.js";
//   const demo = connect("v2");
//   demo.reset(openingLines);
//   demo.cue({ userId: "user_friend", text: "hey", delayMs: 1500 });
//   demo.close();
//
// Both apps sync their windows over BroadcastChannel, so the host joins the
// same channel and speaks each version's own protocol. Every open window of
// that version (the embedded screen, a popped-out control panel) follows along.

const MINUTE = 60 * 1000;

const createId = () => `msg_${crypto.randomUUID().slice(0, 8)}`;

const message = (userId, text, timestamp = Date.now()) => ({
  id: createId(),
  thread: "main",
  userId,
  text,
  timestamp,
});

// v1 (the original): one event per change.
const v1 = (channel) => ({
  typing: (userId, typing) => channel.postMessage({ type: typing ? "typingStart" : "typingStop", userId }),
  send: (payload) => channel.postMessage({ type: "message", ...payload }),
  clear: () => {
    channel.postMessage({ type: "takeReset" });
    channel.postMessage({ type: "switchView", view: "main" });
  },
});

// v2 (the rebuild): windows replay each other's reducer actions.
const v2 = (channel) => {
  const act = (type, payload) => channel.postMessage({ type: "action", action: { type, payload } });
  return {
    typing: (userId, typing) => act("SET_TYPING", { userId, typing }),
    send: (payload) => act("ADD_MESSAGE", payload),
    clear: () => {
      act("SET_CURRENT_ROOM", { roomId: "main" });
      act("CLEAR_MESSAGES", {});
    },
  };
};

const VERSIONS = {
  v1: { channel: "chat_app_legacy_bus", protocol: v1 },
  v2: { channel: "chat_app_bus", protocol: v2 },
};

export function connect(version) {
  const { channel: name, protocol } = VERSIONS[version];
  const channel = new BroadcastChannel(name);
  const app = protocol(channel);
  const timers = new Set();
  const typingUsers = new Set();

  const later = (ms, fn) =>
    new Promise((resolve) => {
      const id = setTimeout(() => {
        timers.delete(id);
        resolve(fn());
      }, ms);
      timers.add(id);
    });

  const cancelPending = () => {
    timers.forEach(clearTimeout);
    timers.clear();
    typingUsers.forEach((userId) => app.typing(userId, false));
    typingUsers.clear();
  };

  return {
    // Shows the user typing for delayMs, then sends the line.
    async cue({ userId, text, delayMs = 0 }) {
      if (delayMs > 0) {
        typingUsers.add(userId);
        app.typing(userId, true);
        await later(delayMs, () => {
          typingUsers.delete(userId);
          app.typing(userId, false);
        });
      }
      app.send(message(userId, text));
    },

    // Clears the conversation and replays the opening lines, a minute apart.
    reset(lines = []) {
      cancelPending();
      app.clear();
      const start = Date.now() - lines.length * MINUTE;
      lines.forEach(([userId, text], index) => app.send(message(userId, text, start + index * MINUTE)));
    },

    close() {
      cancelPending();
      channel.close();
    },
  };
}
