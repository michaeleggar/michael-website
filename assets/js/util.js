const currentPath = window.location.pathname;
document.querySelectorAll('nav a').forEach(link => {
  if (link.getAttribute('href') === currentPath) {
    link.classList.add('active-nav');
  }
});