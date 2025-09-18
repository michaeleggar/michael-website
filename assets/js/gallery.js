const MANIFEST_URL = "/assets/data/artworks.json";
const galleryEl = document.getElementById("art-gallery");
const dialog = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbCap = document.getElementById("lb-cap");
const lbClose = dialog.querySelector(".lb-close");

let manifestVersion = "";
let lastTrigger = null;

function withVersion(url, v) {
  if (!v) return url;
  return url + (url.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(v);
}

function renderItems(artworks) {
  const frag = document.createDocumentFragment();

  artworks
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .forEach((art) => {
      const fig = document.createElement("figure");
      fig.className = "masonry-item";

      const a = document.createElement("a");
      a.href = withVersion(art.src_large, manifestVersion);
      a.dataset.full = withVersion(art.src_large, manifestVersion);
      if (art.width_large) a.dataset.w = art.width_large;
      if (art.height_large) a.dataset.h = art.height_large;
      if (art.caption) a.dataset.caption = art.caption;

      const img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = art.alt || art.title || "";
      img.src = withVersion(art.src_thumb || art.src_large, manifestVersion);

      if (art.width_large && art.height_large) {
        img.width = art.width_large;
        img.height = art.height_large;
      }

      a.appendChild(img);
      fig.appendChild(a);

      //   if (art.title) {
      //     const cap = document.createElement("figcaption");
      //     cap.textContent = art.title;
      //     fig.appendChild(cap);
      //   }

      frag.appendChild(fig);
    });

  galleryEl.textContent = "";
  galleryEl.appendChild(frag);
}

function openLightbox(linkEl) {
  lbImg.src = linkEl.dataset.full || linkEl.href;
  lbImg.alt = linkEl.querySelector("img")?.alt || "";
  lbCap.textContent = linkEl.dataset.caption || "";
  lastTrigger = linkEl;
  dialog.showModal();
  lbClose.focus();
}

function closeLightbox() {
  dialog.close();
  lbImg.src = "";
  if (lastTrigger) lastTrigger.focus();
}

async function init() {
  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`manifest http ${res.status}`);
    const data = await res.json();

    manifestVersion = data.version || "";
    renderItems(data.artworks || []);
  } catch (err) {
    console.error("failed to load artworks manifest:", err);
    galleryEl.innerHTML = "<p>Unable to load gallery right now.</p>";
  }
}

galleryEl.addEventListener("click", (e) => {
  const link = e.target.closest("a[data-full]");
  if (!link) return;
  e.preventDefault();
  openLightbox(link);
});

dialog.addEventListener("click", (e) => {
  if (e.target === dialog) closeLightbox();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && dialog.open) closeLightbox();
});

lbClose.addEventListener("click", closeLightbox);

init();
