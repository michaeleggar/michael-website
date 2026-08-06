"use strict";

(function () {
  const carousel = document.querySelector("[data-project-carousel]");
  if (!carousel) return;

  const originals = Array.from(
    carousel.querySelectorAll("[data-carousel-slide]"),
  );
  const status = document.querySelector("[data-carousel-status]");
  const heading = document.querySelector(".portfolio-section-heading");
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  if (!status || !heading || originals.length === 0) {
    return;
  }

  originals.forEach((slide, index) => {
    slide.dataset.carouselIndex = String(index);
  });

  function makeClone(slide) {
    const clone = slide.cloneNode(true);
    clone.dataset.carouselClone = "true";
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("a, button").forEach((element) => {
      element.setAttribute("tabindex", "-1");
    });
    return clone;
  }

  const trailingClones = document.createDocumentFragment();

  originals.forEach((slide) => {
    trailingClones.append(makeClone(slide));
  });

  carousel.append(trailingClones);

  const slides = Array.from(
    carousel.querySelectorAll("[data-carousel-slide]"),
  );
  let currentIndex = 0;
  let scrollFrame;
  let settleTimer;
  let isRepositioning = false;
  let dragState = null;
  let suppressClick = false;
  const dragThreshold = 6;
  const flickVelocityThreshold = 0.45;
  const flickSampleWindow = 120;
  const flickDistanceThreshold = 12;

  function getAnchor() {
    const carouselBounds = carousel.getBoundingClientRect();
    const headingBounds = heading.getBoundingClientRect();
    return Math.max(0, headingBounds.left - carouselBounds.left);
  }

  function setAnchor() {
    carousel.style.setProperty("--portfolio-carousel-anchor", `${getAnchor()}px`);
  }

  function getNearestSlide() {
    const anchor = carousel.getBoundingClientRect().left + getAnchor();
    let nearestSlide = slides[0];
    let nearestDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide) => {
      const distance = Math.abs(slide.getBoundingClientRect().left - anchor);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestSlide = slide;
      }
    });

    return nearestSlide;
  }

  function updateStatus(slide) {
    currentIndex = Number(slide.dataset.carouselIndex);
    status.textContent = `${currentIndex + 1} / ${originals.length}`;
  }

  function getScrollTarget(slide) {
    return slide.offsetLeft - getAnchor();
  }

  function goToSlide(slide, behavior) {
    carousel.scrollTo({
      left: getScrollTarget(slide),
      behavior,
    });
  }

  function settleCarousel() {
    if (isRepositioning || dragState) return;

    const nearestSlide = getNearestSlide();
    updateStatus(nearestSlide);

    if (nearestSlide.dataset.carouselClone === "true") {
      const matchingOriginal =
        originals[Number(nearestSlide.dataset.carouselIndex)];
      isRepositioning = true;
      goToSlide(matchingOriginal, "auto");
      window.requestAnimationFrame(() => {
        isRepositioning = false;
        updateStatus(matchingOriginal);
      });
    }
  }

  function move(direction) {
    const nearestSlide = getNearestSlide();
    const position = slides.indexOf(nearestSlide);
    let target = slides[position + direction];

    if (!target && direction < 0) {
      const firstTrailingClone = slides[originals.length];
      goToSlide(firstTrailingClone, "auto");
      target = slides[originals.length - 1];
    }

    if (!target) return;

    goToSlide(target, reducedMotion.matches ? "auto" : "smooth");
    if (reducedMotion.matches) settleCarousel();
  }

  function recordPointerSample(event) {
    if (!dragState || !Number.isFinite(event.clientX)) return;

    dragState.samples.push({
      x: event.clientX,
      time: event.timeStamp,
    });

    const cutoff = event.timeStamp - flickSampleWindow;
    while (
      dragState.samples.length > 2 &&
      dragState.samples[0].time < cutoff
    ) {
      dragState.samples.shift();
    }
  }

  function getFlickDirection() {
    if (!dragState || dragState.samples.length < 2) return 0;

    const firstSample = dragState.samples[0];
    const lastSample = dragState.samples[dragState.samples.length - 1];
    const elapsed = lastSample.time - firstSample.time;
    const distance = lastSample.x - firstSample.x;

    if (
      elapsed <= 0 ||
      Math.abs(distance) < flickDistanceThreshold ||
      Math.abs(distance / elapsed) < flickVelocityThreshold
    ) {
      return 0;
    }

    return distance < 0 ? 1 : -1;
  }

  carousel.addEventListener("pointerdown", (event) => {
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      !event.isPrimary
    ) {
      return;
    }

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: carousel.scrollLeft,
      startSlide: getNearestSlide(),
      samples: [],
      moved: false,
    };
    recordPointerSample(event);
  });

  carousel.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    recordPointerSample(event);
    const distance = event.clientX - dragState.startX;
    if (Math.abs(distance) >= dragThreshold) {
      dragState.moved = true;
      carousel.classList.add("is-dragging");
      if (!carousel.hasPointerCapture(event.pointerId)) {
        carousel.setPointerCapture(event.pointerId);
      }
    }
    if (!dragState.moved) return;

    event.preventDefault();
    carousel.scrollLeft = dragState.startScrollLeft - distance;
  });

  function finishDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    if (event.type === "pointerup") {
      recordPointerSample(event);
    }

    const { pointerId, moved, startSlide } = dragState;
    const flickDirection =
      event.type === "pointerup" && moved ? getFlickDirection() : 0;
    dragState = null;
    carousel.classList.remove("is-dragging");

    if (carousel.hasPointerCapture(pointerId)) {
      carousel.releasePointerCapture(pointerId);
    }

    if (moved) {
      suppressClick = true;
      window.setTimeout(() => {
        suppressClick = false;
      }, 0);
    }

    window.clearTimeout(settleTimer);

    if (flickDirection) {
      const startPosition = slides.indexOf(startSlide);
      const target = slides[startPosition + flickDirection];

      if (target) {
        goToSlide(target, reducedMotion.matches ? "auto" : "smooth");
        if (reducedMotion.matches) settleCarousel();
        return;
      }
    }

    settleTimer = window.setTimeout(settleCarousel, 80);
  }

  carousel.addEventListener("pointerup", finishDrag);
  carousel.addEventListener("pointercancel", finishDrag);
  carousel.addEventListener("lostpointercapture", finishDrag);

  carousel.addEventListener(
    "click",
    (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  carousel.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });

  carousel.addEventListener(
    "wheel",
    (event) => {
      if (!event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }
      event.preventDefault();
      carousel.scrollLeft += event.deltaY;
    },
    { passive: false },
  );

  carousel.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  });

  carousel.addEventListener("scroll", () => {
    window.cancelAnimationFrame(scrollFrame);
    scrollFrame = window.requestAnimationFrame(() => {
      updateStatus(getNearestSlide());
    });

    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settleCarousel, 160);
  });

  carousel.addEventListener("scrollend", settleCarousel);

  window.addEventListener("resize", () => {
    setAnchor();
    goToSlide(originals[currentIndex], "auto");
  });

  setAnchor();
  goToSlide(originals[0], "auto");
  carousel.dataset.carouselReady = "true";
  updateStatus(originals[0]);
})();
