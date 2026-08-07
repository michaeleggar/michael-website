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

let activePortfolioView = "work";
let pendingPortfolioView = null;
let portfolioTransitionTimer = null;
let portfolioTransitionFrame = null;
let hashNavigationShouldAnimate = true;

function getPortfolioViewFromHash(fallback = activePortfolioView) {
  const hash = window.location.hash.toLowerCase();
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
    filter.setAttribute(
      "aria-pressed",
      String(filter.dataset.portfolioFilter === view),
    );
  });

  if (portfolioControls && shouldSwitchInstantly) {
    window.requestAnimationFrame(() => {
      portfolioControls.classList.remove("is-switch-instant");
    });
  }
}

function getPortfolioDirection(fromView, toView) {
  const fromIndex = portfolioFilters.findIndex(
    (filter) => filter.dataset.portfolioFilter === fromView,
  );
  const toIndex = portfolioFilters.findIndex(
    (filter) => filter.dataset.portfolioFilter === toView,
  );
  return toIndex >= fromIndex ? "forward" : "backward";
}

function finishPortfolioSwitch(view, shouldAnimate, direction = "forward") {
  portfolioPanels.forEach((panel) => {
    panel.classList.remove("is-leaving", "is-entering");
    delete panel.dataset.portfolioDirection;
    panel.hidden = panel.dataset.portfolioPanel !== view;
  });

  const incomingPanel = portfolioPanels.find(
    (panel) => panel.dataset.portfolioPanel === view,
  );

  if (shouldAnimate && incomingPanel) {
    incomingPanel.dataset.portfolioDirection = direction;
    incomingPanel.classList.add("is-entering");
    portfolioTransitionFrame = window.requestAnimationFrame(() => {
      portfolioTransitionFrame = window.requestAnimationFrame(() => {
        incomingPanel.classList.remove("is-entering");
      });
    });
  }

  activePortfolioView = view;
  pendingPortfolioView = null;
}

function showPortfolioView(view, options = {}) {
  const { animate = true, updateHistory = false } = options;
  if (!portfolioPanels.some((panel) => panel.dataset.portfolioPanel === view)) {
    return;
  }

  const shouldAnimate = animate && activePortfolioView !== view;
  updatePortfolioControls(view, shouldAnimate);

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

  const outgoingPanel = portfolioPanels.find((panel) => !panel.hidden);
  const outgoingView = outgoingPanel?.dataset.portfolioPanel;

  if (!outgoingPanel || !shouldAnimate || outgoingView === view) {
    finishPortfolioSwitch(view, false);
    return;
  }

  pendingPortfolioView = view;
  const direction = getPortfolioDirection(outgoingView, view);

  portfolioPanels.forEach((panel) => {
    panel.classList.remove("is-leaving", "is-entering");
    delete panel.dataset.portfolioDirection;
  });
  outgoingPanel.dataset.portfolioDirection = direction;
  outgoingPanel.classList.add("is-leaving");

  portfolioTransitionTimer = window.setTimeout(
    () => {
      portfolioTransitionTimer = null;
      finishPortfolioSwitch(view, true, direction);
    },
    reducePortfolioMotion.matches ? 80 : 90,
  );
}

portfolioFilters.forEach((filter) => {
  filter.addEventListener("click", (event) => {
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
  const link = event.target.closest('a[href$="#work"], a[href$="#art"]');
  if (link) hashNavigationShouldAnimate = event.detail !== 0;
});

activePortfolioView = getPortfolioViewFromHash("work");
finishPortfolioSwitch(activePortfolioView, false);
updatePortfolioControls(activePortfolioView, false);
