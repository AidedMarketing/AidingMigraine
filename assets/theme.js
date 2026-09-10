// Apply the chosen theme before the first paint, including on help pages.
function syncStoredTheme() {
    let theme = 'warm-dark';
    try {
        const saved = localStorage.getItem('theme');
        const aliases = { dark: 'warm-dark', light: 'warm-light' };
        if (['warm-dark', 'warm-light', 'high-contrast'].includes(saved)) theme = saved;
        else if (aliases[saved]) theme = aliases[saved];
    } catch { /* Browsing with unavailable storage still has a readable default. */ }
    if (typeof applyTheme === 'function') applyTheme(theme);
    else document.documentElement.setAttribute('data-theme', theme);
}
syncStoredTheme();
window.addEventListener('storage', event => {
    if (event.key === 'theme') syncStoredTheme();
});
