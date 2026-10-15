const STATUS = {
  online: "online",
  offline: "offline",
};

const normalizeStatus = (user) => (user?.online ? STATUS.online : STATUS.offline);

export const applyProfileStatus = (element, user) => {
  if (!(element instanceof HTMLElement)) return;
  if (!user) {
    element.hidden = true;
    element.textContent = "";
    element.removeAttribute("data-status");
    element.removeAttribute("title");
    return;
  }
  const nextStatus = normalizeStatus(user);
  element.hidden = false;
  element.textContent = nextStatus;
  element.dataset.status = nextStatus;
  element.title = `Currently ${nextStatus}`;
};

export const profileStatusText = normalizeStatus;
