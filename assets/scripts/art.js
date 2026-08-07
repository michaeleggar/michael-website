"use strict";

const gallery = document.getElementById("art-gallery");
const modal = document.getElementById("art-modal");
const modalImg = document.getElementById("modal-img");
const modalTitle = document.getElementById("modal-title");
const modalDetails = document.getElementById("modal-details");
const closeBtn = modal.querySelector(".modal-close");
const reduceArtMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let lastFocusedEl = null;
let modalCloseTimer = null;
let isModalClosing = false;

function openModal(btn, shouldAnimate) {
  modalImg.src = btn.getAttribute("data-src-large") || "";
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
  modalImg.removeAttribute("src");

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
  const btn = event.target.closest("button[data-src-large]");
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
