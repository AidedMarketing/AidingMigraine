// Fixed actions replace executable onclick attributes. No string evaluation.
document.addEventListener('click', event => {
    const button = event.target.closest('[data-ui-action]');
    if (!button) return;
    const rawId = button.dataset.recordId;
    const id = rawId !== undefined && !isNaN(Number(rawId)) ? Number(rawId) : rawId;
    const actions = {
        'close-modal': () => closeModal(),
        'close-debug': () => closeDebugModal(),
        'copy-debug': () => copyDebugInfo(),
        'add-medication': () => showAddMedicationModal(),
        'restore': () => restoreEpisode(id),
        'permanent-delete': () => permanentlyDelete(id),
        'empty-trash': () => emptyTrash(),
        'view-trash': () => viewTrash(),
        'confirm-permanent-delete': () => confirmPermanentDelete(id),
        'confirm-empty-trash': () => confirmEmptyTrash(),
        'custom-pdf-range': () => showCustomDateRange(),
        'pdf-ranges': () => showPDFDateRangeModal(),
        'export-custom-pdf': () => exportCustomPDF(),
        'export-pdf': () => {
            if (['7days', '30days', '90days'].includes(button.dataset.period)) exportPDF(button.dataset.period, null, null, button);
        },
        'export-json-close': () => { exportJSON(); closeModal(); },
        'clear-all': () => confirmClearAll(),
        'close-welcome': () => closeWelcome(),
        'start-tour': () => startGuidedTour(),
        'skip-tour': () => skipTour(),
        'next-tour': () => nextTourStep()
    };
    if (Object.hasOwn(actions, button.dataset.uiAction)) {
        event.preventDefault();
        actions[button.dataset.uiAction]();
    }
});
