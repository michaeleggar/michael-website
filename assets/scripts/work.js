"use strict";

(function () {
  const grid = document.querySelector(".work-grid");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll(".work-card"));
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
