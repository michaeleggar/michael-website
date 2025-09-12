document.addEventListener("DOMContentLoaded", () => {
  fetch("/assets/partials/nav.html")
    .then((res) => res.text())
    .then((html) => {
      document.getElementById("nav-placeholder").innerHTML = html;

      const currentPath = window.location.pathname.replace(
        /\/index\.html$/,
        "/"
      );

      document.querySelectorAll("nav a").forEach((link) => {
        const href = link.getAttribute("href").replace(/\/index\.html$/, "/");
        if (href === currentPath) {
          link.classList.add("active-nav");
        }
      });
    });
});
