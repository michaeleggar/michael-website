"use strict";

const portfolioFilters = Array.from(
  document.querySelectorAll("[data-portfolio-filter]"),
);
const portfolioPanels = Array.from(
  document.querySelectorAll("[data-portfolio-panel]"),
);
function getPortfolioViewFromHash() {
  return window.location.hash.toLowerCase() === "#art" ? "art" : "work";
}

function setPortfolioView(view) {
  portfolioFilters.forEach((filter) => {
    const isActive = filter.dataset.portfolioFilter === view;
    filter.setAttribute("aria-pressed", String(isActive));
  });

  portfolioPanels.forEach((panel) => {
    panel.hidden = panel.dataset.portfolioPanel !== view;
  });
}

portfolioFilters.forEach((filter) => {
  filter.addEventListener("click", () => {
    const view = filter.dataset.portfolioFilter;
    if (window.location.hash.toLowerCase() === `#${view}`) {
      setPortfolioView(view);
      return;
    }

    window.location.hash = view;
  });
});

window.addEventListener("hashchange", () => {
  setPortfolioView(getPortfolioViewFromHash());
});

setPortfolioView(getPortfolioViewFromHash());
