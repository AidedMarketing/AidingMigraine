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
