"use strict";

const gallery = document.getElementById("art-gallery");
const modal = document.getElementById("art-modal");
const modalSourceAvif = document.getElementById("modal-source-avif");
const modalSourceWebp = document.getElementById("modal-source-webp");
const modalImg = document.getElementById("modal-img");
const modalTitle = document.getElementById("modal-title");
const modalDetails = document.getElementById("modal-details");
const closeBtn = modal.querySelector(".modal-close");
const reduceArtMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let lastFocusedEl = null;
let modalCloseTimer = null;
let isModalClosing = false;

function openModal(btn, shouldAnimate) {
  modalSourceAvif.srcset = btn.getAttribute("data-modal-avif-srcset") || "";
  modalSourceAvif.sizes = "90vw";
  modalSourceWebp.srcset = btn.getAttribute("data-modal-webp-srcset") || "";
  modalSourceWebp.sizes = "90vw";
  modalImg.src = btn.getAttribute("data-modal-src") || "";
  modalImg.srcset = btn.getAttribute("data-modal-srcset") || "";
  modalImg.sizes = "90vw";
  modalImg.alt =
    btn.getAttribute("data-alt") || btn.getAttribute("data-title") || "";

  modalTitle.textContent = btn.getAttribute("data-title") || "";

  const details = [
    btn.getAttribute("data-year"),
    btn.getAttribute("data-medium"),
    btn.getAttribute("data-dimensions"),
  ].filter(Boolean);
  modalDetails.textContent = details.join(" / ");
  modalDetails.style.display = details.length ? "" : "none";

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  if (!shouldAnimate || reduceArtMotion.matches) {
    modal.classList.add("is-instant");
  }

  modal.showModal();
  closeBtn.focus();

  if (!shouldAnimate || reduceArtMotion.matches) {
    window.requestAnimationFrame(() => {
      modal.classList.remove("is-instant");
    });
  }
}

function finishModalClose({ shouldBeInstant = false } = {}) {
  if (modalCloseTimer) {
    window.clearTimeout(modalCloseTimer);
    modalCloseTimer = null;
  }

  modal.classList.remove("is-closing");
  modal.classList.toggle("is-instant", shouldBeInstant);
  isModalClosing = false;

  if (modal.open) modal.close();
  modalSourceAvif.removeAttribute("srcset");
  modalSourceAvif.removeAttribute("sizes");
  modalSourceWebp.removeAttribute("srcset");
  modalSourceWebp.removeAttribute("sizes");
  modalImg.removeAttribute("src");
  modalImg.removeAttribute("srcset");
  modalImg.removeAttribute("sizes");

  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";

  if (lastFocusedEl && document.contains(lastFocusedEl)) {
    lastFocusedEl.focus();
  }
  lastFocusedEl = null;

  if (shouldBeInstant) {
    window.requestAnimationFrame(() => {
      modal.classList.remove("is-instant");
    });
  }
}

function closeModal({ shouldAnimate = true } = {}) {
  if (!modal.open || isModalClosing) return;

  if (!shouldAnimate || reduceArtMotion.matches) {
    finishModalClose({ shouldBeInstant: true });
    return;
  }

  isModalClosing = true;
  modal.classList.add("is-closing");

  function handleTransitionEnd(event) {
    if (
      event.target !== modal ||
      event.pseudoElement === "::backdrop" ||
      event.propertyName !== "opacity"
    ) {
      return;
    }

    modal.removeEventListener("transitionend", handleTransitionEnd);
    finishModalClose();
  }

  modal.addEventListener("transitionend", handleTransitionEnd);
  modalCloseTimer = window.setTimeout(() => {
    modal.removeEventListener("transitionend", handleTransitionEnd);
    finishModalClose();
  }, 220);
}

gallery.addEventListener("click", function (event) {
  const btn = event.target.closest("button[data-modal-src]");
  if (!btn) return;

  lastFocusedEl = btn;
  openModal(btn, event.detail !== 0);
});

modal.addEventListener("click", function (event) {
  if (event.target === modal) {
    closeModal({ shouldAnimate: true });
  }
});

closeBtn.addEventListener("click", function (event) {
  closeModal({ shouldAnimate: event.detail !== 0 });
});

modal.addEventListener("cancel", function (event) {
  event.preventDefault();
  closeModal({ shouldAnimate: false });
});
