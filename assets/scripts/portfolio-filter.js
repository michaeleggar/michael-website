"use strict";

const portfolioFilters = Array.from(
  document.querySelectorAll("[data-portfolio-filter]"),
);
const portfolioPanels = Array.from(
  document.querySelectorAll("[data-portfolio-panel]"),
);
const reducePortfolioMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

let activePortfolioView = "work";
let portfolioTransitionTimer = null;
let portfolioTransitionFrame = null;

function getPortfolioViewFromHash(fallback = activePortfolioView) {
  const hash = window.location.hash.toLowerCase();
  if (hash === "#art") return "art";
  if (hash === "#work") return "work";
  return fallback;
}

function updatePortfolioControls(view) {
  portfolioFilters.forEach((filter) => {
    filter.setAttribute(
      "aria-pressed",
      String(filter.dataset.portfolioFilter === view),
    );
  });
}

function finishPortfolioSwitch(view, shouldAnimate) {
  portfolioPanels.forEach((panel) => {
    panel.classList.remove("is-leaving", "is-entering");
    panel.hidden = panel.dataset.portfolioPanel !== view;
  });

  const incomingPanel = portfolioPanels.find(
    (panel) => panel.dataset.portfolioPanel === view,
  );

  if (shouldAnimate && incomingPanel) {
    incomingPanel.classList.add("is-entering");
    portfolioTransitionFrame = window.requestAnimationFrame(() => {
      portfolioTransitionFrame = window.requestAnimationFrame(() => {
        incomingPanel.classList.remove("is-entering");
      });
    });
  }

  activePortfolioView = view;
}

function showPortfolioView(view, options = {}) {
  const { animate = true, updateHistory = false } = options;
  if (!portfolioPanels.some((panel) => panel.dataset.portfolioPanel === view)) {
    return;
  }

  updatePortfolioControls(view);

  if (updateHistory && window.location.hash.toLowerCase() !== `#${view}`) {
    window.history.pushState(null, "", `#${view}`);
  }

  if (portfolioTransitionTimer) {
    window.clearTimeout(portfolioTransitionTimer);
    portfolioTransitionTimer = null;
  }
  if (portfolioTransitionFrame) {
    window.cancelAnimationFrame(portfolioTransitionFrame);
    portfolioTransitionFrame = null;
  }

  const outgoingPanel = portfolioPanels.find((panel) => !panel.hidden);
  const shouldAnimate = animate && activePortfolioView !== view;

  if (!outgoingPanel || !shouldAnimate) {
    finishPortfolioSwitch(view, false);
    return;
  }

  portfolioPanels.forEach((panel) =>
    panel.classList.remove("is-leaving", "is-entering"),
  );
  outgoingPanel.classList.add("is-leaving");

  portfolioTransitionTimer = window.setTimeout(
    () => {
      portfolioTransitionTimer = null;
      finishPortfolioSwitch(view, true);
    },
    reducePortfolioMotion.matches ? 100 : 130,
  );
}

portfolioFilters.forEach((filter) => {
  filter.addEventListener("click", () => {
    showPortfolioView(filter.dataset.portfolioFilter, {
      animate: true,
      updateHistory: true,
    });
  });
});

window.addEventListener("popstate", () => {
  showPortfolioView(getPortfolioViewFromHash(), { animate: true });
});

window.addEventListener("hashchange", () => {
  showPortfolioView(getPortfolioViewFromHash(), { animate: true });
});

activePortfolioView = getPortfolioViewFromHash("work");
finishPortfolioSwitch(activePortfolioView, false);
updatePortfolioControls(activePortfolioView);
