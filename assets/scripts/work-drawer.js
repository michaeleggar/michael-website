"use strict";

const workDrawer = document.querySelector("[data-work-drawer]");

if (workDrawer) {
  const drawerScroll = workDrawer.querySelector("[data-work-drawer-scroll]");
  const drawerContent = workDrawer.querySelector("[data-work-drawer-content]");
  const drawerLoading = workDrawer.querySelector("[data-work-drawer-loading]");
  const reduceDrawerMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const projectCache = new Map();
  const homeTitle = document.title;

  let activeUrl = null;
  let closeTimer = null;
  let fetchController = null;
  let isClosing = false;
  let lastFocusedElement = null;
  let pendingCloseAnimation = true;

  function getHistoryState(extraState = {}) {
    const currentState =
      history.state && typeof history.state === "object" ? history.state : {};
    return { ...currentState, ...extraState };
  }

  function isWorkUrl(url) {
    return (
      url.origin === window.location.origin &&
      /^\/work\/[^/]+\/$/.test(url.pathname)
    );
  }

  function shouldHandleLink(event, link) {
    return (
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      !link.hasAttribute("download") &&
      (!link.target || link.target === "_self")
    );
  }

  function setLoading(isLoading) {
    drawerLoading.hidden = !isLoading;
    drawerScroll.setAttribute("aria-busy", String(isLoading));
  }

  function showDrawer({ animate = true } = {}) {
    if (workDrawer.open) return;

    workDrawer.classList.toggle("is-instant", !animate);
    document.documentElement.classList.toggle("work-drawer-instant", !animate);
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    workDrawer.showModal();
    workDrawer.focus();

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!workDrawer.open || isClosing) return;
        workDrawer.classList.add("is-open");
        document.documentElement.classList.add("work-drawer-visible");

        if (!animate) {
          window.requestAnimationFrame(() => {
            workDrawer.classList.remove("is-instant");
            document.documentElement.classList.remove("work-drawer-instant");
          });
        }
      });
    });
  }

  function finishDrawerClose({ restoreFocus = true } = {}) {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }

    if (fetchController) {
      fetchController.abort();
      fetchController = null;
    }

    workDrawer.classList.remove("is-open", "is-closing", "is-instant");
    document.documentElement.classList.remove("work-drawer-visible");
    isClosing = false;
    activeUrl = null;

    if (workDrawer.open) workDrawer.close();

    drawerContent.replaceChildren();
    setLoading(false);
    drawerScroll.scrollTop = 0;
    workDrawer.setAttribute("aria-label", "Project details");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.title = homeTitle;

    if (
      restoreFocus &&
      lastFocusedElement &&
      document.contains(lastFocusedElement)
    ) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  }

  function closeDrawer({ animate = true, restoreFocus = true } = {}) {
    if (!workDrawer.open || isClosing) return;

    if (!animate) {
      document.documentElement.classList.add("work-drawer-instant");
      finishDrawerClose({ restoreFocus });
      window.requestAnimationFrame(() => {
        document.documentElement.classList.remove("work-drawer-instant");
      });
      return;
    }

    isClosing = true;
    workDrawer.classList.add("is-closing");
    workDrawer.classList.remove("is-open");
    document.documentElement.classList.remove("work-drawer-visible");

    const closingProperty = reduceDrawerMotion.matches
      ? "opacity"
      : "transform";

    function handleTransitionEnd(event) {
      if (
        event.target !== workDrawer ||
        event.pseudoElement === "::backdrop" ||
        event.propertyName !== closingProperty
      ) {
        return;
      }

      workDrawer.removeEventListener("transitionend", handleTransitionEnd);
      finishDrawerClose({ restoreFocus });
    }

    workDrawer.addEventListener("transitionend", handleTransitionEnd);
    closeTimer = window.setTimeout(() => {
      workDrawer.removeEventListener("transitionend", handleTransitionEnd);
      finishDrawerClose({ restoreFocus });
    }, 520);
  }

  async function getProject(url) {
    const cacheKey = url.pathname;
    if (projectCache.has(cacheKey)) return projectCache.get(cacheKey);

    if (fetchController) fetchController.abort();
    fetchController = new AbortController();

    const response = await fetch(url.href, {
      headers: { "X-Requested-With": "work-drawer" },
      signal: fetchController.signal,
    });

    if (!response.ok) {
      throw new Error(`Project request failed with ${response.status}`);
    }

    const projectDocument = new DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );
    const projectMain = projectDocument.querySelector(".portfolio-case-study");

    if (!projectMain) {
      throw new Error("Project page is missing its case study content");
    }

    projectMain.removeAttribute("id");

    const project = {
      content: projectMain,
      title: projectDocument.title,
      label:
        projectMain.querySelector("h1")?.textContent?.trim() || "Project details",
    };

    projectCache.set(cacheKey, project);
    fetchController = null;
    return project;
  }

  async function openProject(
    url,
    { animate = true, historyMode = "push", trigger = null } = {},
  ) {
    if (!isWorkUrl(url)) {
      window.location.assign(url.href);
      return;
    }

    if (isClosing) finishDrawerClose({ restoreFocus: false });
    if (activeUrl === url.pathname && workDrawer.open) return;

    activeUrl = url.pathname;
    if (trigger) lastFocusedElement = trigger;
    drawerContent.replaceChildren();
    setLoading(true);
    showDrawer({ animate });

    try {
      const project = await getProject(url);
      if (!workDrawer.open || activeUrl !== url.pathname) return;

      const importedContent = document.importNode(project.content, true);
      drawerContent.replaceChildren(importedContent);
      drawerScroll.scrollTop = 0;
      setLoading(false);
      workDrawer.setAttribute("aria-label", project.label);
      document.title = project.title || homeTitle;
      importedContent.querySelector(".portfolio-back-link")?.focus();

      if (historyMode === "push") {
        history.pushState(
          getHistoryState({ workDrawer: true, workUrl: url.pathname }),
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );
      }
    } catch (error) {
      if (error.name === "AbortError") return;

      finishDrawerClose({ restoreFocus: false });
      window.location.assign(url.href);
    }
  }

  function requestDrawerClose({ animate = true } = {}) {
    pendingCloseAnimation = animate;

    if (history.state?.workDrawer) {
      history.back();
    } else {
      closeDrawer({ animate });
    }
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest(".portfolio-project-card a[href]");
    if (!link || !shouldHandleLink(event, link)) return;

    const url = new URL(link.href, window.location.href);
    if (!isWorkUrl(url)) return;

    event.preventDefault();
    openProject(url, {
      animate: event.detail !== 0,
      historyMode: "push",
      trigger: link,
    });
  });

  workDrawer.addEventListener("click", (event) => {
    const backLink = event.target.closest(".portfolio-back-link");
    if (backLink && shouldHandleLink(event, backLink)) {
      event.preventDefault();
      requestDrawerClose({ animate: event.detail !== 0 });
      return;
    }

    if (event.target === workDrawer) {
      requestDrawerClose({ animate: true });
    }
  });

  workDrawer.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestDrawerClose({ animate: false });
  });

  window.addEventListener("popstate", (event) => {
    const url = new URL(window.location.href);

    if (event.state?.workDrawer && isWorkUrl(url)) {
      openProject(url, { animate: true, historyMode: "none" });
      return;
    }

    closeDrawer({ animate: pendingCloseAnimation });
    pendingCloseAnimation = true;
  });

  history.replaceState(
    getHistoryState({ workDrawer: false, workUrl: null }),
    "",
    window.location.href,
  );
}
