const CONTROL_URL = "./control.html";
const SCREEN_URL = "./screen.html";

const launchStates = {
  control: null,
  screen: null,
};

const openWindow = (url, name) => {
  try {
    const target = name ?? "_blank";
    const win = window.open(url, target);
    if (!win) {
      console.warn(`Popup blocked for ${name}`);
      return null;
    }
    return win;
  } catch (error) {
    console.error(`Failed to open window ${name}`, error);
    return null;
  }
};

const readyCheck = () => {
  const bothReady =
    launchStates.control && !launchStates.control.closed && launchStates.screen && !launchStates.screen.closed;
  if (bothReady) {
    document.body.classList.add("launcher--connected");
  } else {
    document.body.classList.remove("launcher--connected");
  }
};

const installChannel = () => {
  if (!window.BroadcastChannel) {
    console.warn("BroadcastChannel unsupported; launcher status limited.");
    return;
  }
  const channel = new BroadcastChannel("chat_app_legacy_presence");
  channel.addEventListener("message", (event) => {
    if (event.data?.type === "windowReady") {
      launchStates[event.data.window] = launchStates[event.data.window] ?? window.open("", event.data.window);
      readyCheck();
    }
  });
  window.addEventListener("beforeunload", () => channel.close());
};

const bindControls = () => {
  const auto = document.getElementById("launchAuto");
  const openControl = document.getElementById("openControl");
  const openScreen = document.getElementById("openScreen");

  auto?.addEventListener("click", () => {
    launchStates.control =
      launchStates.control && !launchStates.control.closed
        ? launchStates.control
        : openWindow(CONTROL_URL, "control");

    launchStates.screen =
      launchStates.screen && !launchStates.screen.closed
        ? launchStates.screen
        : openWindow(SCREEN_URL, "screen");

    readyCheck();
  });

  openControl?.addEventListener("click", () => {
    launchStates.control = openWindow(CONTROL_URL, "control");
    readyCheck();
  });

  openScreen?.addEventListener("click", () => {
    launchStates.screen = openWindow(SCREEN_URL, "screen");
    readyCheck();
  });
};

const init = () => {
  installChannel();
  bindControls();
};

window.addEventListener("DOMContentLoaded", init);
