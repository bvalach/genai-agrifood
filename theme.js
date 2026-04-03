/* Theme detection — runs synchronously before first paint */
(function () {
    var saved = localStorage.getItem('foodai-theme');
    var prefers = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', saved || prefers);
})();

/* Toggle handler — waits for DOM */
document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        var next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('foodai-theme', next);
    });
});
