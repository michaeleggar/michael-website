"use strict";

var gallery = document.getElementById("art-gallery");
var modal = document.getElementById("art-modal");
var modalImg = document.getElementById("modal-img");
var modalTitle = document.getElementById("modal-title");
var modalDetails = document.getElementById("modal-details");
var closeBtn = modal.querySelector(".modal-close");

var lastFocusedEl = null;

function openModal(btn) {
  modalImg.src = btn.getAttribute("data-src-large") || "";
  modalImg.alt = btn.getAttribute("data-alt") || btn.getAttribute("data-title") || "";

  modalTitle.textContent = btn.getAttribute("data-title") || "";

  var details = [
    btn.getAttribute("data-year"),
    btn.getAttribute("data-medium"),
    btn.getAttribute("data-dimensions"),
  ].filter(Boolean);
  modalDetails.textContent = details.join(" / ");
  modalDetails.style.display = details.length ? "" : "none";

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  modal.showModal();
  closeBtn.focus();
}

function closeModal() {
  modal.close();
  modalImg.src = "";

  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";

  if (lastFocusedEl && document.contains(lastFocusedEl)) {
    lastFocusedEl.focus();
  }
  lastFocusedEl = null;
}

gallery.addEventListener("click", function (event) {
  var btn = event.target.closest("button[data-src-large]");
  if (!btn) return;

  lastFocusedEl = btn;
  openModal(btn);
});

modal.addEventListener("click", function (event) {
  if (event.target === modal) {
    closeModal();
  }
});

closeBtn.addEventListener("click", closeModal);

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && modal.open) {
    closeModal();
  }
});

(function () {
  var images = gallery.querySelectorAll("img");
  var total = images.length;
  var loaded = 0;

  function check() {
    loaded++;
    if (loaded >= total) {
      gallery.classList.add("loaded");
    }
  }

  for (var j = 0; j < images.length; j++) {
    images[j].onload = images[j].onerror = check;
    if (images[j].complete) {
      loaded++;
    }
  }

  if (loaded >= total) {
    gallery.classList.add("loaded");
  }
})();
