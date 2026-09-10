// Presentation state only. Records remain owned by the existing data layer.
let selectedInsight = 'overview';

function refreshInsightSections() {
    const empty = getActiveMigraines().length === 0;
    const tabs = document.querySelector('.insight-tabs');
    if (tabs) tabs.hidden = empty;
    document.querySelectorAll('.insight-panel').forEach(panel => {
        panel.hidden = empty || panel.id !== `insight-${selectedInsight}`;
        const grid = panel.querySelector('.insight-grid');
        const hasVisibleContent = [...grid.children].some(child => child.style.display !== 'none' && !child.hidden);
        panel.querySelector('.category-empty').hidden = hasVisibleContent;
        grid.hidden = !hasVisibleContent;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-insight]').forEach(button => {
        button.addEventListener('click', () => {
            selectedInsight = button.dataset.insight;
            document.querySelectorAll('[data-insight]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
            refreshInsightSections();
            // Charts initialized in hidden panels need the now-visible width.
            requestAnimationFrame(() => {
                Object.values(analyticsCharts).forEach(chart => { if (chart) chart.resize(); });
            });
        });
    });
    document.querySelector('.brand-lockup')?.addEventListener('click', event => {
        event.preventDefault();
        showPage('log');
    });
});

function refreshRecentEntry() {
    const title = document.getElementById('recent-entry-title');
    const detail = document.getElementById('recent-entry-detail');
    if (!title || !detail) return;
    const latest = [...getActiveMigraines()].sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0];
    title.textContent = latest ? 'Last saved migraine' : 'Your journal, at your pace';
    detail.textContent = latest
        ? `${new Date(latest.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${latest.duration == null ? 'Duration not recorded' : formatDuration(latest.duration)} · View history`
        : 'Saved attacks will be here when you need them.';
}

// The visual viewport shrinks when the iPhone keyboard is open.
function syncVisualViewport() {
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty('--visual-height', `${viewport ? viewport.height : window.innerHeight}px`);
    document.documentElement.style.setProperty('--visual-top', `${viewport ? viewport.offsetTop : 0}px`);
}
document.addEventListener('DOMContentLoaded', () => {
window.addEventListener('resize', syncVisualViewport);
window.visualViewport?.addEventListener('resize', syncVisualViewport);
window.visualViewport?.addEventListener('scroll', syncVisualViewport);
syncVisualViewport();
});

// Reserve the actual banner height, including large text and the status bar.
document.addEventListener('DOMContentLoaded', () => {
    const update = document.getElementById('update-banner');
    const status = document.getElementById('status-banner');
    const measure = () => {
        const updateHeight = update.getBoundingClientRect().height;
        const statusHeight = status.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--notice-space', `${updateHeight + statusHeight}px`);
        document.documentElement.style.setProperty('--status-top', `${updateHeight}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(update);
    observer.observe(status);
    measure();
});
