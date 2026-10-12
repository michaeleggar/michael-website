(() => {
  const button = document.querySelector(".header-email-copy");
  if (!button) return;

  const container = button.closest(".header-email");
  const tooltip = container.querySelector(".header-email-tooltip");
  const status = container.querySelector(".header-email-status");
  let dismissTimer;
  let copying = false;

  function copyWithSelection(email) {
    const field = document.createElement("textarea");
    const focused = document.activeElement;
    field.value = email;
    field.readOnly = true;
    field.style.cssText = "position:fixed;top:0;left:-9999px;";
    document.body.append(field);
    field.select();
    try {
      if (!document.execCommand("copy")) throw new Error("Copy failed");
    } finally {
      field.remove();
      focused?.focus({ preventScroll: true });
    }
  }

  async function copyEmail(email) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(email);
        return;
      } catch {
        // Selection copying also works where clipboard permissions are denied.
      }
    }
    copyWithSelection(email);
  }

  button.addEventListener("click", async event => {
    if (copying) return;
    copying = true;
    clearTimeout(dismissTimer);
    status.textContent = "";
    container.toggleAttribute("data-instant", event.detail === 0);

    try {
      await copyEmail(button.dataset.email);
      tooltip.textContent = "Copied!";
      status.textContent = "Email address copied.";
    } catch {
      tooltip.textContent = "Couldn't copy";
      status.textContent = `Couldn't copy. Email address: ${button.dataset.email}`;
    } finally {
      copying = false;
    }

    container.setAttribute("data-visible", "");
    dismissTimer = setTimeout(() => {
      container.removeAttribute("data-visible");
    }, 2000);
  });

  button.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      clearTimeout(dismissTimer);
      container.removeAttribute("data-visible");
    }
  });
})();
