// document.addEventListener("DOMContentLoaded", () => {
//   fetch("/assets/partials/nav.html")
//     .then((res) => res.text())
//     .then((html) => {
//       document.getElementById("nav-placeholder").innerHTML = html;

//       const currentPath = window.location.pathname.replace(
//         /\/index\.html$/,
//         "/"
//       );

//       document.querySelectorAll("nav a").forEach((link) => {
//         const href = link.getAttribute("href").replace(/\/index\.html$/, "/");
//         if (href === currentPath) {
//           link.classList.add("active-nav");
//         }
//       });
//     });
// });
const navUrl = "/assets/partials/nav.html";
const navEl = document.getElementById("nav-placeholder");

function loadPart(url, partEl) {
  return fetch(url)
    .then((part) => part.text())
    .then((html) => {
      partEl.innerHTML = html;
    });
}

function highlightNav() {
  const currentPath = window.location.pathname.replace(/\/index\.html$/, "/");

  document.querySelectorAll("nav a").forEach((link) => {
    const hrefPath = link.pathname
      .replace(/\/index\.html$/i, "/")
      .replace(/\/+$/, "/");

    if (hrefPath === currentPath) {
      link.classList.add("active-nav");
    }
  });
}
document.addEventListener("DOMContentLoaded", () => {
  loadPart(navUrl, navEl).then(() => {
    highlightNav();
  });
});
