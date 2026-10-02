"use strict";

const gallery = document.getElementById("art-gallery");
const modal = document.getElementById("art-modal");
const modalImg = document.getElementById("modal-img");
const modalTitle = document.getElementById("modal-title");
const modalDetails = document.getElementById("modal-details");
const closeButton = modal.querySelector(".modal-close");

gallery.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-modal-src]");
  if (!button) return;

  const data = button.dataset;
  modalImg.src = data.modalSrc;
  modalImg.alt = data.alt || data.title || "";
  modalTitle.textContent = data.title || "Artwork";
  modalDetails.textContent = [data.year, data.medium, data.dimensions]
    .filter(Boolean)
    .join(" / ");
  modalDetails.hidden = !modalDetails.textContent;

  // Give the native dialog a focus target to restore when it closes.
  button.focus({ preventScroll: true });
  document.documentElement.style.overflow = "hidden";
  modal.showModal();
  closeButton.focus();
});

closeButton.addEventListener("click", () => modal.close());
modal.addEventListener("click", (event) => {
  if (event.target === modal) modal.close();
});

// Escape, focus trapping, and focus restoration are handled by <dialog>.
modal.addEventListener("close", () => {
  document.documentElement.style.overflow = "";
  modalImg.removeAttribute("src");
});
