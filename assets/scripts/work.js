"use strict";

(function () {
  const grid = document.querySelector(".work-grid");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll(".work-card"));
  const filterButtons = Array.from(
    document.querySelectorAll("[data-work-filter]")
  );

  function getInitialFilter() {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get("filter") || "all";
    const validFilters = filterButtons.map((button) => {
      return button.dataset.workFilter;
    });
    return validFilters.includes(filter) ? filter : "all";
  }

  function setFilter(nextFilter, shouldUpdateUrl) {
    filterButtons.forEach((button) => {
      const isActive = button.dataset.workFilter === nextFilter;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    cards.forEach((card) => {
      const categories = (card.dataset.categories || "")
        .split(/\s+/)
        .filter(Boolean);
      card.hidden = nextFilter !== "all" && !categories.includes(nextFilter);
    });

    if (shouldUpdateUrl) {
      const url = new URL(window.location.href);
      if (nextFilter === "all") {
        url.searchParams.delete("filter");
      } else {
        url.searchParams.set("filter", nextFilter);
      }
      history.pushState({ workFilter: nextFilter }, "", url);
    }
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setFilter(button.dataset.workFilter, true);
    });
  });

  window.addEventListener("popstate", () => {
    setFilter(getInitialFilter(), false);
  });

  setFilter(getInitialFilter(), false);

  const srcs = cards
    .map((card) => {
      const style = card.getAttribute("style") || "";
      const match = style.match(/url\(["']?([^"')]+)["']?\)/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  if (srcs.length === 0) {
    grid.classList.add("loaded");
    return;
  }

  let loaded = 0;
  function check() {
    loaded++;
    if (loaded >= srcs.length) {
      grid.classList.add("loaded");
    }
  }

  srcs.forEach(function (src) {
    const img = new Image();
    img.onload = img.onerror = check;
    img.src = src;
  });
})();
