(function() {
  try {
    var saved = localStorage.getItem('khabo_theme');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  } catch (e) {}
})();
