function loadPart(url, partEl) {
  return fetch(url)
    .then((part) => part.text())
    .then((html) => {
      partEl.innerHTML = html;
    });
}

function highlightNav() {
  const currentPath = window.location.pathname.replace(/\/index\.html$/, "/");
  document.querySelectorAll(".nav-link").forEach((link) => {
    if (link.getAttribute("href")?.endsWith("index.html")) {
      if (currentPath.endsWith("index.html") || currentPath === "/") {
        link.classList.add("active-nav");
      }
    }
  });
}

function hydrateInclude(el) {
  const url = el.getAttribute("data-include");
  if (!url) return Promise.resolve();
  return loadPart(url, el).then(() => {
    el.dispatchEvent(new CustomEvent("include:loaded", { detail: { url } }));
  });
}

function hydrateAllIncludes() {
  const targets = Array.from(document.querySelectorAll("[data-include]"));
  return Promise.all(targets.map(hydrateInclude));
}

function positionChipSeparators() {
  const chipBoards = document.querySelectorAll(".chip-rows");
  chipBoards.forEach((board) => {
    const firstLabel = board.querySelector(".chip-label");
    if (firstLabel) {
      const labelWidth = firstLabel.offsetWidth;
      board.style.setProperty("--separator-left", `${labelWidth}px`);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  hydrateAllIncludes().then(() => {
    highlightNav();
    positionChipSeparators();
  });
});

window.addEventListener("resize", positionChipSeparators);
