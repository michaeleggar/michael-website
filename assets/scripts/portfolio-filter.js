"use strict";

const portfolioFilters = Array.from(
  document.querySelectorAll("[data-portfolio-filter]"),
);
const portfolioPanels = Array.from(
  document.querySelectorAll("[data-portfolio-panel]"),
);
const portfolioControls = document.querySelector("[data-portfolio-controls]");
const reducePortfolioMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

let activePortfolioView = "hey";
let pendingPortfolioView = null;
let portfolioTransitionTimer = null;
let portfolioTransitionFrame = null;
let hashNavigationShouldAnimate = true;

function getPortfolioViewFromHash(fallback = activePortfolioView) {
  const hash = window.location.hash.toLowerCase();
  if (hash === "#hey" || hash === "#hello") return "hey";
  if (hash === "#art") return "art";
  if (hash === "#work") return "work";
  return fallback;
}

function updatePortfolioControls(view, shouldAnimateIndicator = true) {
  const shouldSwitchInstantly =
    !shouldAnimateIndicator || reducePortfolioMotion.matches;

  if (portfolioControls && shouldSwitchInstantly) {
    portfolioControls.classList.add("is-switch-instant");
  }

  portfolioFilters.forEach((filter) => {
    const isActive = filter.dataset.portfolioFilter === view;

    if (filter instanceof HTMLButtonElement) {
      filter.setAttribute("aria-pressed", String(isActive));
    } else if (isActive) {
      filter.setAttribute("aria-current", "page");
    } else {
      filter.removeAttribute("aria-current");
    }
  });

  if (portfolioControls && shouldSwitchInstantly) {
    window.requestAnimationFrame(() => {
      portfolioControls.classList.remove("is-switch-instant");
    });
  }
}

function finishPortfolioSwitch(view) {
  portfolioPanels.forEach((panel) => {
    panel.classList.remove("is-leaving", "is-entering");
    panel.removeAttribute("aria-hidden");
    panel.inert = false;
    panel.hidden = panel.dataset.portfolioPanel !== view;
  });

  activePortfolioView = view;
  pendingPortfolioView = null;
}

function showPortfolioView(view, options = {}) {
  const { animate = true, updateHistory = false } = options;
  if (!portfolioPanels.some((panel) => panel.dataset.portfolioPanel === view)) {
    return;
  }

  if (updateHistory && window.location.hash.toLowerCase() !== `#${view}`) {
    window.history.pushState(null, "", `#${view}`);
  }

  if (pendingPortfolioView === view) return;

  if (portfolioTransitionTimer) {
    window.clearTimeout(portfolioTransitionTimer);
    portfolioTransitionTimer = null;
  }
  if (portfolioTransitionFrame) {
    window.cancelAnimationFrame(portfolioTransitionFrame);
    portfolioTransitionFrame = null;
  }

  if (pendingPortfolioView) {
    finishPortfolioSwitch(pendingPortfolioView);
  }

  const outgoingPanel = portfolioPanels.find((panel) => !panel.hidden);
  const outgoingView = outgoingPanel?.dataset.portfolioPanel;
  const shouldAnimate = animate && outgoingView !== view;
  updatePortfolioControls(view, shouldAnimate);

  if (!outgoingPanel || !shouldAnimate || outgoingView === view) {
    finishPortfolioSwitch(view);
    return;
  }

  const incomingPanel = portfolioPanels.find(
    (panel) => panel.dataset.portfolioPanel === view,
  );
  pendingPortfolioView = view;

  portfolioPanels.forEach((panel) => {
    panel.classList.remove("is-leaving", "is-entering");
    panel.removeAttribute("aria-hidden");
    panel.inert = false;
  });

  incomingPanel.hidden = false;
  incomingPanel.classList.add("is-entering");
  outgoingPanel.classList.add("is-leaving");
  outgoingPanel.setAttribute("aria-hidden", "true");
  outgoingPanel.inert = true;

  portfolioTransitionFrame = window.requestAnimationFrame(() => {
    portfolioTransitionFrame = window.requestAnimationFrame(() => {
      portfolioTransitionFrame = null;
      incomingPanel.classList.remove("is-entering");
    });
  });

  portfolioTransitionTimer = window.setTimeout(
    () => {
      portfolioTransitionTimer = null;
      finishPortfolioSwitch(view);
    },
    reducePortfolioMotion.matches ? 130 : 280,
  );
}

portfolioFilters.forEach((filter) => {
  filter.addEventListener("click", (event) => {
    if (filter instanceof HTMLAnchorElement) event.preventDefault();

    showPortfolioView(filter.dataset.portfolioFilter, {
      animate: event.detail !== 0,
      updateHistory: true,
    });
  });
});

window.addEventListener("popstate", () => {
  showPortfolioView(getPortfolioViewFromHash(), { animate: false });
});

window.addEventListener("hashchange", () => {
  showPortfolioView(getPortfolioViewFromHash(), {
    animate: hashNavigationShouldAnimate,
  });
  hashNavigationShouldAnimate = true;
});

document.addEventListener("click", (event) => {
  const link = event.target.closest(
    'a[href$="#hey"], a[href$="#hello"], a[href$="#work"], a[href$="#art"]',
  );
  if (link) hashNavigationShouldAnimate = event.detail !== 0;
});

activePortfolioView = getPortfolioViewFromHash("hey");
finishPortfolioSwitch(activePortfolioView);
updatePortfolioControls(activePortfolioView, false);
