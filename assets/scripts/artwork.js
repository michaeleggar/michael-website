"use strict";

const MANIFEST_URL = "assets/data/artwork.json";
const gallery = document.getElementById("art-gallery");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lb-img");
const lightboxCaption = document.getElementById("lb-cap");
const closeButton = lightbox.querySelector(".lb-close");

let lastFocusedTrigger = null;

function openLightbox(fullSrc, altText, captionText, triggerElement) {
  lightboxImage.src = fullSrc;
  lightboxImage.alt = altText;

  if (typeof captionText === "string") {
    lightboxCaption.textContent = captionText;
  } else {
    lightboxCaption.textContent = "";
  }

  lastFocusedTrigger = triggerElement;

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  lightbox.showModal();
  closeButton.focus();
}

function closeLightbox() {
  lightbox.close();

  lightboxImage.src = "";

  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";

  if (lastFocusedTrigger && document.contains(lastFocusedTrigger)) {
    lastFocusedTrigger.focus();
  }
  lastFocusedTrigger = null;
}

function renderGallery(items) {
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < items.length; i++) {
    const art = items[i];

    const figure = document.createElement("figure");
    figure.className = "masonry-item";

    const link = document.createElement("a");
    link.setAttribute("href", art.src_large);
    link.setAttribute("data-full", art.src_large);
    if (art.caption) {
      link.setAttribute("data-caption", art.caption);
    }

    const img = document.createElement("img");
    img.setAttribute("loading", "lazy");
    img.setAttribute("src", art.src_thumb || art.src_large);

    const altText = art.alt || art.title || "";
    img.setAttribute("alt", altText);

    link.appendChild(img);
    figure.appendChild(link);
    fragment.appendChild(figure);
  }

  gallery.textContent = "";
  gallery.appendChild(fragment);
}

gallery.addEventListener("click", function (event) {
  let el = event.target;
  while (el && el !== gallery && el.tagName !== "A") {
    el = el.parentElement;
  }

  if (!el || el === gallery) {
    return;
  }

  if (el.hasAttribute("data-full")) {
    event.preventDefault();

    const fullSrc = el.getAttribute("data-full");
    const captionText = el.getAttribute("data-caption") || "";
    const imgEl = el.querySelector("img");
    const altText = imgEl ? imgEl.getAttribute("alt") || "" : "";

    openLightbox(fullSrc, altText, captionText, el);
  }
});

lightbox.addEventListener("click", function (event) {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

closeButton.addEventListener("click", closeLightbox);

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && lightbox.open) {
    closeLightbox();
  }
});

function loadManifest() {
  return fetch(MANIFEST_URL, { cache: "no-cache" }).then(function (response) {
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
    return response.json();
  });
}

function init() {
  loadManifest()
    .then(function (data) {
      const items = Array.isArray(data.artwork) ? data.artwork.slice() : [];

      items.sort(function (a, b) {
        const ao = typeof a.order === "number" ? a.order : 0;
        const bo = typeof b.order === "number" ? b.order : 0;
        return ao - bo;
      });

      renderGallery(items);
    })
    .catch(function (error) {
      console.error("Failed to load artwork manifest:", error);
      gallery.textContent = "";
      const errorMsg = document.createElement("p");
      errorMsg.textContent = "Sorry, the gallery did not load.";
      gallery.appendChild(errorMsg);
    });
}

init();
