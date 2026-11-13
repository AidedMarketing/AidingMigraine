// Comfort & color — resolve the chosen tone x brightness before the
// first paint, including on help pages.
//
// The preference lives under a NEW key ('colorTheme', JSON) so the
// retired single-axis 'theme' key is never rewritten: a stored legacy
// value only *seeds* the first-run default. Storage is this device
// only, like every other app preference.
var COLOR_THEME_KEY = 'colorTheme';
var COLOR_TONES = ['dusk', 'sage'];
var COLOR_BRIGHTNESSES = ['light', 'dim', 'dark'];

function defaultColorTheme() {
    var legacy = null;
    try { legacy = localStorage.getItem('theme'); } catch (e) { /* storage unavailable */ }
    if (legacy === 'high-contrast') {
        // Preserve an existing user's accessibility choice verbatim.
        return { tone: 'dusk', brightness: 'dim', contrast: true };
    }
    if (legacy === 'warm-light' || legacy === 'light') {
        return { tone: 'dusk', brightness: 'light', contrast: false };
    }
    if (legacy) {
        return { tone: 'dusk', brightness: 'dim', contrast: false };
    }
    // First run: Dusk, with brightness following the device.
    var brightness = 'dim';
    try {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            brightness = 'light';
        }
    } catch (e) { /* keep the dim default */ }
    return { tone: 'dusk', brightness: brightness, contrast: false };
}

function readColorTheme() {
    try {
        var raw = localStorage.getItem(COLOR_THEME_KEY);
        if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && COLOR_TONES.indexOf(parsed.tone) !== -1 &&
                COLOR_BRIGHTNESSES.indexOf(parsed.brightness) !== -1) {
                return { tone: parsed.tone, brightness: parsed.brightness, contrast: !!parsed.contrast };
            }
        }
    } catch (e) { /* corrupt or unavailable storage: fall through to the default */ }
    return defaultColorTheme();
}

function saveColorTheme(pref) {
    try {
        localStorage.setItem(COLOR_THEME_KEY, JSON.stringify({
            tone: pref.tone, brightness: pref.brightness, contrast: !!pref.contrast
        }));
    } catch (e) { /* the choice still applies for this session */ }
}

function colorThemeName(pref) {
    return pref.contrast ? 'high-contrast' : pref.tone + '-' + pref.brightness;
}

function paintColorTheme(pref) {
    var root = document.documentElement;
    root.setAttribute('data-theme', colorThemeName(pref));
    root.setAttribute('data-tone', pref.tone);
    root.setAttribute('data-brightness', pref.brightness);
}

function syncStoredTheme() {
    var pref = readColorTheme();
    // On the app page app.js owns the full apply (buttons, meta, charts);
    // everywhere else (help pages) painting the attributes is enough.
    if (typeof applyTheme === 'function') applyTheme(pref);
    else paintColorTheme(pref);
}
syncStoredTheme();
window.addEventListener('storage', function (event) {
    if (event.key === COLOR_THEME_KEY || event.key === 'theme') syncStoredTheme();
});
