"use strict";

const MANIFEST_URL = "/assets/data/artwork.json";
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

  if (lastFocusedTrigger) {
    lastFocusedTrigger.focus();
  }
}

function renderGallery(items) {
  var fragment = document.createDocumentFragment();

  for (var i = 0; i < items.length; i++) {
    var art = items[i];

    var figure = document.createElement("figure");
    figure.className = "masonry-item";

    var link = document.createElement("a");
    link.setAttribute("href", art.src_large);
    link.setAttribute("data-full", art.src_large);
    if (art.caption) {
      link.setAttribute("data-caption", art.caption);
    }

    var img = document.createElement("img");
    img.setAttribute("loading", "lazy");
    if (art.src_thumb) {
      img.setAttribute("src", art.src_thumb);
    } else {
      img.setAttribute("src", art.src_large);
    }

    var altText = "";
    if (art.alt) {
      altText = art.alt;
    } else if (art.title) {
      altText = art.title;
    } else {
      altText = "";
    }
    img.setAttribute("alt", altText);

    link.appendChild(img);
    figure.appendChild(link);
    fragment.appendChild(figure);
  }

  gallery.textContent = "";
  gallery.appendChild(fragment);
}

gallery.addEventListener("click", function (event) {
  var el = event.target;
  while (el && el !== gallery && el.tagName !== "A") {
    el = el.parentElement;
  }

  if (!el || el === gallery) {
    return;
  }

  if (el.hasAttribute("data-full")) {
    event.preventDefault();

    var fullSrc = el.getAttribute("data-full");
    var captionText = el.getAttribute("data-caption") || "";

    var imgEl = el.querySelector("img");
    var altText = "";
    if (imgEl) {
      altText = imgEl.getAttribute("alt") || "";
    }

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
      var items;
      if (Array.isArray(data.artwork)) {
        items = data.artwork.slice();
      } else {
        items = [];
      }

      items.sort(function (a, b) {
        var ao = typeof a.order === "number" ? a.order : 0;
        var bo = typeof b.order === "number" ? b.order : 0;
        return ao - bo;
      });

      renderGallery(items);
    })
    .catch(function (error) {
      console.error("Failed to load artwork manifest:", error);
      gallery.innerHTML = "<p>Sorry, the gallery did not load.</p>";
    });
}

init();
