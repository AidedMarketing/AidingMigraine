async function beginAttack(migraine) {
    const buttons = ['start-attack-btn', 'log-btn'].map(id => document.getElementById(id));
    buttons.forEach(button => { button.disabled = true; });
    activeMigraine = migraine;
    try {
        await saveData();
    } catch (error) {
        activeMigraine = null;
        showToast('Could not save. Free device storage and try again.', { type: 'error', duration: 8000 });
        return false;
    } finally {
        buttons.forEach(button => { button.disabled = false; });
    }
    startDurationTracking();
    checkActiveMigraine();
    updateDashboard();
    renderCalendar();
    document.getElementById('detailed-log').open = false;
    document.getElementById('active-title').focus();
    scheduleActiveAttackCheckIn(migraine.id);
    schedulePostAttackFollowUp(migraine.id);
    showToast('Start time saved. Add details whenever you can.');
    return true;
}

function initializePainScale() {
    // Pain dropdown handler for Log page
    const painDropdown = document.getElementById('pain-select');
    if (painDropdown) {
        painDropdown.addEventListener('change', (e) => {
            const value = e.target.value;
            selectedPain = value === '' ? null : parseInt(value);
        });
    }
}

document.getElementById('toggle-details-btn')?.addEventListener('click', () => {
    const content = document.getElementById('optional-details-content');
    const arrow = document.getElementById('details-arrow');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.classList.add('rotated');
        document.getElementById('toggle-details-btn').setAttribute('aria-expanded', 'true');
    } else {
        content.style.display = 'none';
        arrow.classList.remove('rotated');
        document.getElementById('toggle-details-btn').setAttribute('aria-expanded', 'false');
    }
});

function initializeLogging() {
    document.getElementById('quick-medication-btn')?.addEventListener('click', () => showAddMedicationModal(activeMedicationContext()));
    document.getElementById('start-attack-btn')?.addEventListener('click', startAttackMode);
    document.getElementById('log-btn').addEventListener('click', logEpisode);
    document.getElementById('clear-btn').addEventListener('click', clearForm);
    document.getElementById('add-medication-btn').addEventListener('click', () => showAddMedicationModal(QUICKLOG_MED_CONTEXT));
    document.getElementById('update-pain-btn')?.addEventListener('click', updateActivePain);
    document.getElementById('end-episode-btn')?.addEventListener('click', endActiveMigraine);
    document.getElementById('edit-active-episode-btn')?.addEventListener('click', () => {
        if (activeMigraine) editEpisode(activeMigraine.id);
    });
    document.getElementById('active-add-medication-btn')?.addEventListener('click', () => {
        showAddMedicationModal(activeMedicationContext());
    });

    // One delegated wiring for every collapsible section on the
    // active card (Symptoms/Triggers/Medications) -- new sections
    // just need the data-toggle-target attribute, no extra JS.
    document.querySelectorAll('.toggle-details-btn[data-toggle-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            const content = document.getElementById(btn.dataset.toggleTarget);
            const arrow = btn.querySelector('.toggle-arrow');
            const isHidden = !content.style.display || content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            btn.setAttribute('aria-expanded', String(isHidden));
            if (arrow) arrow.classList.toggle('rotated', isHidden);
        });
    });

    renderMedicationsList(); // Initialize empty medication list
    renderHeadMap('log-head-map', selectedPainLocations);
    bindHeadMap('log-head-map', selectedPainLocations);
    renderQualityChips('log-quality-chips', selectedQuality);
    bindQualityChips('log-quality-chips', selectedQuality);
    renderProdromeChips('log-prodrome-chips', selectedProdrome);
    bindProdromeChips('log-prodrome-chips', selectedProdrome);
    renderSymptomChips('log-symptom-chips', selectedSymptoms);
    bindSymptomChips('log-symptom-chips', selectedSymptoms);
    renderTriggerChips('log-trigger-chips', selectedTriggers);
    bindTriggerChips('log-trigger-chips', selectedTriggers);
}

// Shared "you already have an active episode" prompt, reused by the
// detailed log form and the one-tap attack-mode button.
function showActiveEpisodeConflict() {
    showModal(
        'Episode Detected',
        'You already have an active episode. Please end it first, or clear it if you believe this is an error.',
        [
            {
                text: 'End Current Episode',
                class: 'btn-primary',
                action: () => {
                    endActiveMigraine();
                    closeModal();
                }
            },
            {
                text: 'Clear Stuck Episode',
                class: 'btn-danger',
                action: () => {
                    console.warn('[WARNING] User manually cleared stuck active episode');
                    activeMigraine = null;
                    saveData();
                    checkActiveMigraine();
                    closeModal();
                    showModal('Success', 'Stuck episode cleared. You can now log a new episode.');
                }
            },
            {
                text: 'Cancel',
                class: 'btn-secondary',
                action: closeModal
            }
        ]
    );
}

// One-tap "attack mode": start an episode NOW with no required fields.
// Pain is left unset (null) rather than a fabricated default so averages
// aren't polluted; the user refines pain/symptoms/triggers/relief on the
// active-episode card, and pain is required only when the episode ends.
async function startAttackMode() {
    if (activeMigraine) {
        showActiveEpisodeConflict();
        return;
    }

    const now = new Date().toISOString();
    const migraine = {
        id: Date.now(),
        startTime: now,
        painLevel: null,
        painHistory: [],
        status: 'active',
        notes: '',
        medications: null,
        medication: null,
        weather: getCurrentWeatherForEntry(),
        category: null,
        symptoms: [],
        triggers: [],
        prodrome: [],
        postdrome: [],
        painLocations: [],
        painQuality: []
    };

    await beginAttack(migraine);
}

async function logEpisode() {
    if (selectedPain === null) {
        showModal('Error', 'Please select a pain level.');
        return;
    }

    if (activeMigraine) {
        showActiveEpisodeConflict();
        return;
    }

    const notes = document.getElementById('notes-input').value.trim();

    const migraine = {
        id: Date.now(),
        startTime: new Date().toISOString(),
        painLevel: selectedPain,
        painHistory: [{ timestamp: new Date().toISOString(), level: selectedPain }],
        status: 'active',
        notes: notes,
        medications: currentEpisodeMedications.length > 0 ? [...currentEpisodeMedications] : null,
        // Keep old medication field for backwards compatibility
        medication: currentEpisodeMedications.length > 0
            ? currentEpisodeMedications.map(m => `${m.name}${m.dosage ? ' ' + m.dosage : ''}`).join(', ')
            : null,
        weather: getCurrentWeatherForEntry(),
        category: getPainCategory(selectedPain),
        symptoms: Array.from(selectedSymptoms),
        triggers: Array.from(selectedTriggers),
        prodrome: Array.from(selectedProdrome),
        postdrome: [],
        painLocations: Array.from(selectedPainLocations),
        painQuality: Array.from(selectedQuality)
    };

    if (await beginAttack(migraine)) clearForm();
}

function clearForm() {
    selectedPain = null;
    // Reset dropdown
    const painDropdown = document.getElementById('pain-select');
    if (painDropdown) {
        painDropdown.value = '';
    }
    // Reset buttons (for modals)
    document.querySelectorAll('.pain-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('notes-input').value = '';
    currentEpisodeMedications = [];
    renderMedicationsList();
    selectedPainLocations.clear();
    renderHeadMap('log-head-map', selectedPainLocations);
    selectedQuality.clear();
    renderQualityChips('log-quality-chips', selectedQuality);
    selectedProdrome.clear();
    renderProdromeChips('log-prodrome-chips', selectedProdrome);
    selectedSymptoms.clear();
    renderSymptomChips('log-symptom-chips', selectedSymptoms);
    selectedTriggers.clear();
    renderTriggerChips('log-trigger-chips', selectedTriggers);
}

function updateActivePain() {
    if (!activeMigraine) return;

    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');

    body.innerHTML = `
        <div class="form-group">
            <label>How strong is the pain?</label><p class="pain-helper">0 is no pain. 10 is the worst imaginable.</p>
            <div class="pain-scale">
                ${[0,1,2,3,4,5,6,7,8,9,10].map(i => 
                    `<button class="pain-btn" aria-label="Pain ${i} out of 10" aria-pressed="false" data-pain="${i}">${i}</button>`
                ).join('')}
            </div>
        </div>
    `;

    document.getElementById('modal-actions').innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="confirm-pain-update" disabled>Save pain</button>
    `;

    document.getElementById('modal-title').textContent = 'Update pain';
    openDialog(modal);

    body.querySelectorAll('.pain-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            body.querySelectorAll('.pain-btn').forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); });
            btn.classList.add('selected');
            btn.setAttribute('aria-pressed', 'true');
            document.getElementById('confirm-pain-update').disabled = false;
        });
    });

    document.getElementById('confirm-pain-update').addEventListener('click', async () => {
        if (!activeMigraine) return;
        const before = structuredClone(activeMigraine);
        const selected = body.querySelector('.pain-btn.selected');
        if (selected) {
            const newPain = parseInt(selected.dataset.pain);
            activeMigraine.painHistory.push({
                timestamp: new Date().toISOString(),
                level: newPain
            });
            activeMigraine.painLevel = newPain;
            activeMigraine.category = getPainCategory(newPain);
            const confirm = document.getElementById('confirm-pain-update');
            confirm.disabled = true;
            try { await saveData(); }
            catch (error) {
                activeMigraine = before;
                confirm.disabled = false;
                showToast('Could not save pain. Please try again.', { type: 'error' });
                return;
            }
            updateActiveMigraineeDisplay();
            closeModal();
            showToast(`Pain saved: ${newPain}/10`);
        }
    });
}

function endActiveMigraine() {
    if (!activeMigraine) return;

    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');

    // Attack-mode episodes may still have no pain level. Require one at
    // the end so the completed record (which enters analytics/history)
    // always carries a real, numeric pain value.
    const needsPain = activeMigraine.painLevel == null;

    body.innerHTML = `
        <p>We’ll save the end time now. You can edit it in History.</p>
        ${needsPain ? `
        <div class="form-group" style="margin-top: 16px;">
            <label>How bad was the pain? (required)</label>
            <div class="pain-scale" id="end-pain-scale">
                ${[0,1,2,3,4,5,6,7,8,9,10].map(i =>
                    `<button type="button" class="pain-btn" aria-label="Pain ${i} out of 10" aria-pressed="false" data-pain="${i}">${i}</button>`
                ).join('')}
            </div>
            <p id="end-pain-error" style="display: none; color: var(--accent-red); font-size: 0.85rem; margin-top: 8px;">Please choose a pain level (0–10) before ending.</p>
        </div>` : ''}
        <details class="quiet-disclosure"><summary>Add recovery details</summary>
        <div class="form-group" style="margin-top: 16px;">
            <label>After-effects (postdrome, optional)</label>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 2px 0 8px;">How you feel now that the headache has eased — the "migraine hangover".</p>
            <div id="end-postdrome-chips" class="chip-group"></div>
        </div>
        <div class="form-group" style="margin-top: 16px;">
            <label>Resolution Notes (optional)</label>
            <textarea id="end-notes" placeholder="How did it resolve? What helped?" rows="3"></textarea>
        </div>
        </details>
    `;

    document.getElementById('modal-actions').innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="confirm-end">Save &amp; end</button>
    `;

    document.getElementById('modal-title').textContent = 'End this migraine?';
    openDialog(modal);

    // Postdrome chips — a local set seeded from any existing value
    const endPostdrome = new Set(Array.isArray(activeMigraine.postdrome)
        ? activeMigraine.postdrome.filter(k => POSTDROME_KEYS.has(k)) : []);
    renderPostdromeChips('end-postdrome-chips', endPostdrome);
    bindPostdromeChips('end-postdrome-chips', endPostdrome);

    if (needsPain) {
        body.querySelectorAll('#end-pain-scale .pain-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                body.querySelectorAll('#end-pain-scale .pain-btn').forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); });
                btn.classList.add('selected');
            btn.setAttribute('aria-pressed', 'true');
                const err = document.getElementById('end-pain-error');
                if (err) err.style.display = 'none';
            });
        });
    }

    document.getElementById('confirm-end').addEventListener('click', async () => {
        if (!activeMigraine) return;
        const before = structuredClone(activeMigraine);
        if (needsPain) {
            const selected = body.querySelector('#end-pain-scale .pain-btn.selected');
            if (!selected) {
                const err = document.getElementById('end-pain-error');
                if (err) err.style.display = 'block';
                return;
            }
            const endPain = parseInt(selected.dataset.pain);
            activeMigraine.painLevel = endPain;
            activeMigraine.category = getPainCategory(endPain);
            activeMigraine.painHistory.push({ timestamp: new Date().toISOString(), level: endPain });
        }

        const endNotes = document.getElementById('end-notes').value.trim();

        activeMigraine.postdrome = Array.from(endPostdrome);
        activeMigraine.endTime = new Date().toISOString();
        activeMigraine.status = 'completed';
        activeMigraine.endNotes = endNotes;
        activeMigraine.duration = Math.floor((new Date(activeMigraine.endTime) - new Date(activeMigraine.startTime)) / 1000);
        activeMigraine.endWeather = getCurrentWeatherForEntry();

        const completedMigraineId = activeMigraine.id;
        migraines.push(activeMigraine);
        activeMigraine = null;

        const confirm = document.getElementById('confirm-end');
        confirm.disabled = true;
        try {
            await saveData();
        } catch (error) {
            migraines = migraines.filter(episode => episode.id !== completedMigraineId);
            activeMigraine = before;
            showToast('Could not save. Your attack is still open. Please try again.', { type: 'error', duration: 8000 });
            confirm.disabled = false;
            return;
        }
        cancelActiveAttackCheckIn(completedMigraineId);
        stopDurationTracking();
        checkActiveMigraine();
        updateDashboard();
        renderHistory();
        renderCalendar();

        closeModal();
        document.getElementById('attack-details').open = false;
        document.getElementById('start-attack-btn').focus();
        showToast('Migraine saved to History.');
    });
}

function checkActiveMigraine() {
    const section = document.getElementById('active-episode-section');
    const logging = document.getElementById('logging-section');

    if (activeMigraine) {
        section.style.display = 'block';
        logging.style.display = 'none';
        updateActiveMigraineeDisplay();
        startDurationTracking();
    } else {
        section.style.display = 'none';
        logging.style.display = 'block';
        stopDurationTracking();
    }
}

function updateActiveMigraineeDisplay() {
    if (!activeMigraine) return;

    document.getElementById('active-pain-display').textContent =
        activeMigraine.painLevel == null ? '—' : `${activeMigraine.painLevel}/10`;
    document.getElementById('active-category').textContent = activeMigraine.category || '—';
    updateDuration();
    updateReliefTimeline();
    updateActiveSymptomChips();
    updateActiveTriggerChips();
    updateActiveMedicationsList();
}

// Symptom chips on the active-episode card write straight to the
// in-progress episode so they can be adjusted as symptoms develop.
// The delegated listener reads activeMigraine live (not a captured
// set) so it stays correct across re-renders.
function updateActiveSymptomChips() {
    if (!activeMigraine) return;
    if (!Array.isArray(activeMigraine.symptoms)) activeMigraine.symptoms = [];
    renderSymptomChips('active-symptom-chips', new Set(activeMigraine.symptoms));
    const container = document.getElementById('active-symptom-chips');
    if (container && !container.dataset.delegated) {
        container.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-chip-key]');
            if (!chip || !activeMigraine) return;
            const key = chip.dataset.chipKey;
            if (!SYMPTOM_KEYS.has(key)) return;
            const set = new Set(activeMigraine.symptoms);
            const isOn = !set.has(key);
            if (isOn) set.add(key); else set.delete(key);
            activeMigraine.symptoms = Array.from(set);
            chip.classList.toggle('selected', isOn);
            chip.setAttribute('aria-pressed', String(isOn));
            saveData();
        });
        container.dataset.delegated = '1';
    }
}

// Trigger chips on the active-episode card (same live-binding pattern)
function updateActiveTriggerChips() {
    if (!activeMigraine) return;
    if (!Array.isArray(activeMigraine.triggers)) activeMigraine.triggers = [];
    renderTriggerChips('active-trigger-chips', new Set(activeMigraine.triggers));
    const container = document.getElementById('active-trigger-chips');
    if (container && !container.dataset.delegated) {
        container.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-chip-key]');
            if (!chip || !activeMigraine) return;
            const key = chip.dataset.chipKey;
            if (!TRIGGER_KEYS.has(key)) return;
            const set = new Set(activeMigraine.triggers);
            const isOn = !set.has(key);
            if (isOn) set.add(key); else set.delete(key);
            activeMigraine.triggers = Array.from(set);
            chip.classList.toggle('selected', isOn);
            chip.setAttribute('aria-pressed', String(isOn));
            saveData();
        });
        container.dataset.delegated = '1';
    }
}

// Medications on the active-episode card, same live-write pattern as
// symptoms/triggers above. Unlike those two this needs the picker
// rather than a plain chip toggle, so it goes through
// medicationPickerContext instead of a delegated chip listener.
function activeMedicationContext() {
    return {
        containerId: 'active-medications-list',
        getList: () => {
            if (!activeMigraine.medications) activeMigraine.medications = [];
            return activeMigraine.medications;
        },
        onChange: () => saveData()
    };
}

function updateActiveMedicationsList() {
    if (!activeMigraine) return;
    medicationPickerContext = activeMedicationContext();
    renderMedicationsList();
}

function startDurationTracking() {
    stopDurationTracking();
    updateDuration();
    durationInterval = setInterval(updateDuration, 60000);
}

function stopDurationTracking() {
    if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
    }
}

function updateDuration() {
    if (!activeMigraine) return;

    const start = new Date(activeMigraine.startTime);
    const now = new Date();
    const diff = now - start;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    document.getElementById('active-duration').textContent = `${hours}h ${minutes}m`;
}

// ============================================
// ENTRY EDITING FUNCTIONS
// ============================================

// (editAttack/saveEditedAttack removed - merged into editEpisode/saveEpisodeEdit below,
// which now handles both active and completed episodes.)

// Relief Method Tracking Functions
function initializeReliefMethods() {
    const addBtn = document.getElementById('add-relief-btn');
    const inputSection = document.getElementById('relief-input-section');
    const saveBtn = document.getElementById('save-relief-btn');
    const cancelBtn = document.getElementById('cancel-relief-btn');
    const quickBtns = document.querySelectorAll('.relief-quick-btn');
    const customInput = document.getElementById('custom-relief-input');

    if (!addBtn || !inputSection || !saveBtn || !cancelBtn) return;

    // Toggle relief input section
    addBtn.addEventListener('click', () => {
        inputSection.style.display = inputSection.style.display === 'none' ? 'block' : 'none';
        if (inputSection.style.display === 'block') {
            customInput.value = '';
            customInput.focus();
        }
    });

    // Handle quick button clicks
    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const reliefMethod = btn.dataset.relief;
            addReliefMethod(reliefMethod);
            inputSection.style.display = 'none';
        });
    });

    // Handle save custom relief
    saveBtn.addEventListener('click', () => {
        const customRelief = customInput.value.trim();
        if (customRelief) {
            addReliefMethod(customRelief);
            customInput.value = '';
            inputSection.style.display = 'none';
        } else {
            showModal('Error', 'Please enter a relief method or use a quick-add button.');
        }
    });

    // Handle cancel
    cancelBtn.addEventListener('click', () => {
        customInput.value = '';
        inputSection.style.display = 'none';
    });

    // Allow Enter key to save
    customInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });
}

function addReliefMethod(method) {
    if (!activeMigraine) {
        showModal('Error', 'No active episode found.');
        return;
    }

    // Initialize reliefMethods array if it doesn't exist
    if (!activeMigraine.reliefMethods) {
        activeMigraine.reliefMethods = [];
    }

    const reliefEntry = {
        method: method,
        timestamp: new Date().toISOString()
    };

    activeMigraine.reliefMethods.push(reliefEntry);
    saveData();
    updateReliefTimeline();
}

function updateReliefTimeline() {
    if (!activeMigraine || !activeMigraine.reliefMethods || activeMigraine.reliefMethods.length === 0) {
        document.getElementById('active-relief-timeline').style.display = 'none';
        return;
    }

    const timeline = document.getElementById('active-relief-timeline');
    const entriesContainer = document.getElementById('relief-timeline-entries');

    // Delegated click handler (attached once) - no inline onclick
    if (!entriesContainer.dataset.delegated) {
        entriesContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-relief-index]');
            if (btn) {
                deleteReliefMethod(Number(btn.dataset.reliefIndex));
            }
        });
        entriesContainer.dataset.delegated = '1';
    }

    timeline.style.display = 'block';
    entriesContainer.innerHTML = '';

    // Sort by timestamp (newest first)
    const sortedMethods = [...activeMigraine.reliefMethods].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    sortedMethods.forEach((relief, index) => {
        const entry = document.createElement('div');
        entry.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--accent-green);';

        const time = formatTime(new Date(relief.timestamp));
        // Find original index in unsorted array for deletion
        const originalIndex = activeMigraine.reliefMethods.findIndex(r =>
            r.timestamp === relief.timestamp && r.method === relief.method
        );

        entry.innerHTML = safeHTML(`
            <div style="font-size: 0.85rem; color: var(--text-secondary); min-width: 60px;">${time}</div>
            <div style="flex: 1; font-size: 0.9rem; color: var(--text-primary);">${safeText(relief.method)}</div>
            <button data-relief-index="${originalIndex}"
                    style="background: none; border: none; color: var(--text-secondary);
                           cursor: pointer; font-size: 1.1rem; padding: 4px 8px;
                           transition: var(--transition); line-height: 1;"
                    title="Remove this entry" aria-label="Remove this entry"><svg class="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        `);

        entriesContainer.appendChild(entry);
    });
}

function deleteReliefMethod(index) {
    if (!activeMigraine || !activeMigraine.reliefMethods) return;

    // Remove the relief method at the specified index
    activeMigraine.reliefMethods.splice(index, 1);
    saveData();
    updateReliefTimeline();
}

function updateDashboard() {
    if (typeof refreshRecentEntry === 'function') refreshRecentEntry();
    const activeMigraines = getActiveMigraines();
    const total = activeMigraines.length;
    const avgPain = total > 0
        ? (activeMigraines.reduce((sum, m) => sum + m.painLevel, 0) / total).toFixed(1)
        : '—';

    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    const thisWeek = activeMigraines.filter(m => new Date(m.startTime) >= weekAgo).length;
    const lastWeek = activeMigraines.filter(m => {
        const date = new Date(m.startTime);
        return date >= twoWeeksAgo && date < weekAgo;
    }).length;

    const lastEpisode = total > 0
        ? formatRelativeTime([...activeMigraines].sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0].startTime)
        : '-';

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = activeMigraines.filter(m => new Date(m.startTime) >= monthStart).length;

    // Check if dashboard elements exist before updating
    const totalElem = document.getElementById('total-episodes');
    const avgPainElem = document.getElementById('avg-pain');
    const weekCountElem = document.getElementById('week-count');
    if (!totalElem || !avgPainElem || !weekCountElem) {
        console.warn('[WARNING] Dashboard elements not found in DOM');
        return;
    }

    totalElem.textContent = total;
    avgPainElem.textContent = avgPain;
    weekCountElem.textContent = thisWeek;

    const dateLabel = document.getElementById('today-date-label');
    const weekChip = document.getElementById('today-week-chip');
    const lastChip = document.getElementById('today-last-chip');
    const monthDays = document.getElementById('mobile-care-days');
    const mobileAverage = document.getElementById('mobile-care-average');

    if (dateLabel) {
        dateLabel.textContent = now.toLocaleDateString([], {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
    }
    if (weekChip) weekChip.textContent = `${thisWeek} this week`;
    if (lastChip) lastChip.textContent = `Last episode: ${lastEpisode}`;
    if (monthDays) monthDays.textContent = thisMonth;
    if (mobileAverage) mobileAverage.textContent = avgPain;

    const comparison = document.getElementById('week-comparison');
    if (comparison) {
        if (lastWeek > 0) {
            const diff = thisWeek - lastWeek;
            if (diff > 0) {
                comparison.textContent = `↑ +${diff} from last week`;
                comparison.style.color = 'var(--accent-red)';
            } else if (diff < 0) {
                comparison.textContent = `↓ ${diff} from last week`;
                comparison.style.color = 'var(--accent-green)';
            } else {
                comparison.textContent = `→ Same as last week`;
                comparison.style.color = 'var(--text-secondary)';
            }
        } else {
            comparison.textContent = '';
        }
    }

    // Refresh the Today outlook card (covers the load/render path when
    // weather data is already present but no fresh fetch has fired).
    updateTodayRiskCard();

    // Keep the optional cycle line in sync
    updateCycleTodayLine();
}

