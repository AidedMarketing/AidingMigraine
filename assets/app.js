// Optional reports must not block attack logging on a slow connection.
const optionalLibraries = new Map();
function loadOptionalLibrary(name) {
    const specs = {
        jspdf: { src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', integrity: 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk' },
        chart: { src: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js', integrity: 'sha384-dug+JxfBvklEQdJ4AYuBBAIScUz0bVN73xpy273gcAwHjb3qI0fXmuYNaNfdyYJG' },
    };
    if (optionalLibraries.has(name)) return optionalLibraries.get(name);
    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        Object.assign(script, specs[name], { crossOrigin: 'anonymous' });
        const timeout = setTimeout(() => {
            script.remove();
            reject(new Error('Library loading timed out'));
        }, 10000);
        script.onload = () => { clearTimeout(timeout); resolve(); };
        script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('Library unavailable')); };
        document.head.append(script);
    }).catch(error => { optionalLibraries.delete(name); throw error; });
    optionalLibraries.set(name, promise);
    return promise;
}

const APP_VERSION = '5.8.0-draft.1';

let migraines = [];
let selectedPain = null;

// ============================================
// DISABILITY ASSESSMENTS (MIDAS + HIT-6)
// ============================================
// Standardized questionnaires clinicians use to gauge migraine
// disability. Stored locally as periodic self-assessments.
let assessments = [];

// Menstrual cycle tracking (opt-in, off by default, device-only).
// periods = [{ id, startDate: 'YYYY-MM-DD' }] — start dates only.
let cycleData = { enabled: false, periods: [] };

const MIDAS_QUESTIONS = [
    'On how many days in the last 3 months did you MISS work or school because of your headaches?',
    'On how many days was your productivity at work or school REDUCED BY HALF or more (do not include the days counted above)?',
    'On how many days did you NOT DO household work because of your headaches?',
    'On how many days was your household productivity REDUCED BY HALF or more (do not include the days counted above)?',
    'On how many days did you MISS family, social, or leisure activities because of your headaches?'
];

const HIT6_QUESTIONS = [
    'When you have headaches, how often is the pain severe?',
    'How often do headaches limit your ability to do usual daily activities including household work, work, school, or social activities?',
    'When you have a headache, how often do you wish you could lie down?',
    'In the past 4 weeks, how often have you felt too tired to do work or daily activities because of your headaches?',
    'In the past 4 weeks, how often have you felt fed up or irritated because of your headaches?',
    'In the past 4 weeks, how often did headaches limit your ability to concentrate on work or daily activities?'
];
const HIT6_OPTIONS = [
    { label: 'Never', value: 6 },
    { label: 'Rarely', value: 8 },
    { label: 'Sometimes', value: 10 },
    { label: 'Very often', value: 11 },
    { label: 'Always', value: 13 }
];

function midasGrade(score) {
    if (score <= 5) return { grade: 'I', label: 'Little or no disability' };
    if (score <= 10) return { grade: 'II', label: 'Mild disability' };
    if (score <= 20) return { grade: 'III', label: 'Moderate disability' };
    return { grade: 'IV', label: 'Severe disability' };
}

function hit6Grade(score) {
    if (score <= 49) return { grade: 'Little/none', label: 'Little or no impact' };
    if (score <= 55) return { grade: 'Some', label: 'Some impact' };
    if (score <= 59) return { grade: 'Substantial', label: 'Substantial impact' };
    return { grade: 'Severe', label: 'Severe impact' };
}

function loadAssessments() {
    if (encEnabled()) return; // vault already populated assessments
    const stored = localStorage.getItem('assessments');
    if (!stored) return;
    try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) assessments = parsed;
    } catch (e) {
        console.error('[ERROR] Corrupt assessments, resetting:', e);
        localStorage.removeItem('assessments');
    }
}

function saveAssessments() {
    if (encEnabled()) { persistVault(); return; }
    localStorage.setItem('assessments', JSON.stringify(assessments));
}

function latestAssessment(type) {
    return assessments
        .filter(a => a.type === type)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;
}

// Merge imported assessments, de-duplicating by id
function mergeAssessments(incoming) {
    if (!Array.isArray(incoming)) return 0;
    const known = new Set(assessments.map(a => a.id));
    let added = 0;
    incoming.forEach(a => {
        if (a && a.id && !known.has(a.id) &&
            (a.type === 'midas' || a.type === 'hit6') &&
            typeof a.score === 'number') {
            assessments.push(a);
            known.add(a.id);
            added++;
        }
    });
    if (added > 0) saveAssessments();
    return added;
}

// ============================================
// MENSTRUAL CYCLE TRACKING (opt-in, device-only)
// ============================================

function loadCycleData() {
    if (encEnabled()) return; // vault already populated cycleData
    const stored = localStorage.getItem('cycleData');
    if (!stored) return;
    try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
            cycleData = {
                enabled: !!parsed.enabled,
                periods: Array.isArray(parsed.periods)
                    ? parsed.periods.filter(p => p && typeof p.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.startDate))
                    : []
            };
        }
    } catch (e) {
        console.error('[ERROR] Corrupt cycleData, resetting:', e);
        localStorage.removeItem('cycleData');
        cycleData = { enabled: false, periods: [] };
    }
}

function saveCycleData() {
    if (encEnabled()) { persistVault(); return; }
    localStorage.setItem('cycleData', JSON.stringify(cycleData));
}

// Restore cycle data from a backup: merge period dates (de-duped) and
// adopt the backup's enabled flag. Returns the number of periods added.
function mergeCycleData(incoming) {
    if (!incoming || typeof incoming !== 'object') return 0;
    if (typeof incoming.enabled === 'boolean') cycleData.enabled = incoming.enabled;
    const known = new Set(cycleData.periods.map(p => p.startDate));
    let added = 0;
    if (Array.isArray(incoming.periods)) {
        incoming.periods.forEach(p => {
            if (p && typeof p.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.startDate) && !known.has(p.startDate)) {
                cycleData.periods.push({ id: p.id || Date.now() + added, startDate: p.startDate });
                known.add(p.startDate);
                added++;
            }
        });
    }
    saveCycleData();
    return added;
}

// Parse a 'YYYY-MM-DD' string at LOCAL midnight (avoids the UTC/DST
// off-by-one that new Date('YYYY-MM-DD') causes in some timezones).
function parseLocalDate(str) {
    if (typeof str !== 'string') return null;
    const [y, m, d] = str.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}
function toLocalDateStr(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function daysBetween(a, b) {
    return Math.round((a - b) / 86400000);
}

// Period starts as ascending Date objects
function sortedPeriodStarts() {
    return cycleData.periods
        .map(p => parseLocalDate(p.startDate))
        .filter(Boolean)
        .sort((a, b) => a - b);
}

// Median of the last ~6 consecutive gaps; clamp 21-35; default 28
function averageCycleLength() {
    const starts = sortedPeriodStarts();
    if (starts.length < 2) return 28;
    const gaps = [];
    for (let i = 1; i < starts.length; i++) gaps.push(daysBetween(starts[i], starts[i - 1]));
    const recent = gaps.slice(-6).filter(g => g >= 15 && g <= 60).sort((a, b) => a - b);
    if (recent.length === 0) return 28;
    const mid = Math.floor(recent.length / 2);
    const median = recent.length % 2 ? recent[mid] : Math.round((recent[mid - 1] + recent[mid]) / 2);
    return Math.min(35, Math.max(21, median));
}

// Cycle day for a given date: days since the most recent start on/before
// it, +1 (so the start day itself is day 1). null if none prior.
function cycleDayFor(date) {
    const starts = sortedPeriodStarts();
    let last = null;
    for (const s of starts) { if (s <= date) last = s; else break; }
    if (!last) return null;
    return daysBetween(date, last) + 1;
}

// Days until the next estimated period (last start + avg length)
function nextPeriodEstimate() {
    const starts = sortedPeriodStarts();
    if (starts.length === 0) return null;
    const last = starts[starts.length - 1];
    const next = new Date(last);
    next.setDate(next.getDate() + averageCycleLength());
    const today = parseLocalDate(toLocalDateStr(new Date()));
    return { date: next, daysUntil: daysBetween(next, today) };
}

// Perimenstrual window: within [start-2, start+3] of any logged start
// (ICHD-3 menstrual-migraine window: day -2 to +3).
function isPerimenstrual(date) {
    const starts = sortedPeriodStarts();
    return starts.some(s => {
        const diff = daysBetween(date, s);
        return diff >= -2 && diff <= 3;
    });
}

// Menstrual-migraine correlation over a date range. Mirrors the
// trigger x weather baseline honesty: compare the share of migraine
// days that fall in a perimenstrual window against the share of ALL
// days in range that are perimenstrual (expected by chance).
function calculateMenstrualCorrelation(migraines, startDate, endDate) {
    const starts = sortedPeriodStarts();
    if (starts.length < 2) return { level: 'insufficient', reason: 'periods' };

    const migraineDays = new Set();
    migraines.forEach(m => getMigraineDays(m).forEach(d => migraineDays.add(d)));
    const migDayList = Array.from(migraineDays)
        .map(parseLocalDate).filter(Boolean)
        .filter(d => d >= startDate && d <= endDate);
    if (migDayList.length < 3) return { level: 'insufficient', reason: 'migraines' };

    const totalDays = Math.max(1, daysBetween(endDate, startDate) + 1);
    let windowDays = 0;
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        if (isPerimenstrual(d)) windowDays++;
    }
    const migraineInWindow = migDayList.filter(isPerimenstrual).length;
    const observedShare = migraineInWindow / migDayList.length;
    const expectedShare = windowDays / totalDays;
    const relativeRisk = expectedShare > 0 ? observedShare / expectedShare : 0;

    let level;
    if (migraineInWindow >= 2 && relativeRisk >= 2) level = 'strong';
    else if (migraineInWindow >= 2 && relativeRisk >= 1.4) level = 'moderate';
    else level = 'low';

    return {
        level,
        migraineDays: migDayList.length,
        migraineInWindow,
        observedShare, expectedShare, relativeRisk
    };
}

// --- Cycle UI ---

function addPeriod(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    const todayStr = toLocalDateStr(new Date());
    if (dateStr > todayStr) {
        showModal('Future date', 'Please choose a period start date that is today or earlier.');
        return;
    }
    if (cycleData.periods.some(p => p.startDate === dateStr)) {
        showModal('Already logged', 'That period start date is already recorded.');
        return;
    }
    cycleData.periods.push({ id: Date.now(), startDate: dateStr });
    saveCycleData();
    renderCycleCard();
    updateCycleTodayLine();
}

function removePeriod(dateStr) {
    cycleData.periods = cycleData.periods.filter(p => p.startDate !== dateStr);
    saveCycleData();
    renderCycleCard();
    updateCycleTodayLine();
}

function renderCycleCard() {
    const statusEl = document.getElementById('cycle-status');
    const recentEl = document.getElementById('cycle-recent');
    if (!statusEl || !recentEl) return;

    const starts = sortedPeriodStarts();
    if (starts.length === 0) {
        statusEl.innerHTML = safeHTML('<p style="color: var(--text-secondary); font-size: 0.9rem;">No periods logged yet. Add your most recent period start date to begin.</p>');
        recentEl.innerHTML = '';
    } else {
        const today = parseLocalDate(toLocalDateStr(new Date()));
        const day = cycleDayFor(today);
        const est = nextPeriodEstimate();
        let statusHtml = `<div style="font-size: 1.05rem; font-weight: 600;">${day != null ? `Cycle day ${day}` : 'Cycle started'}</div>`;
        if (est) {
            if (est.daysUntil > 0) statusHtml += `<div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 2px;">Next period in ~${est.daysUntil} days (estimated, ${averageCycleLength()}-day cycle)</div>`;
            else if (est.daysUntil === 0) statusHtml += `<div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 2px;">A period is estimated around today</div>`;
            else statusHtml += `<div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 2px;">Estimated period was ~${Math.abs(est.daysUntil)} days ago — log it if it has started</div>`;
        }
        statusEl.innerHTML = safeHTML(statusHtml);

        const recent = starts.slice(-6).reverse();
        const rows = recent.map(d => {
            const ds = toLocalDateStr(d);
            const label = d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
            return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                <span style="font-size: 0.9rem;">${safeText(label)}</span>
                <button class="btn btn-secondary" data-remove-period="${safeText(ds)}" style="padding: 4px 10px; font-size: 0.8rem;" aria-label="Remove ${safeText(label)}">Remove</button>
            </div>`;
        }).join('');
        recentEl.innerHTML = safeHTML(`<div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px;">Recent period starts</div>${rows}`);
    }

    renderCycleCorrelation();
}

// Menstrual-migraine correlation verdict on the Cycle card. Uses the
// full logged span (first period/episode → today) and the baseline-
// honest comparison from calculateMenstrualCorrelation.
function renderCycleCorrelation() {
    const el = document.getElementById('cycle-correlation');
    if (!el) return;

    const migraines = getActiveMigraines();
    const starts = sortedPeriodStarts();
    if (starts.length < 2) { el.innerHTML = ''; return; }

    const earliestMig = migraines.reduce((min, m) => {
        const t = parseLocalDate(new Date(m.startTime).toISOString().split('T')[0]);
        return (!min || (t && t < min)) ? t : min;
    }, null);
    const startDate = new Date(Math.min(starts[0].getTime(), earliestMig ? earliestMig.getTime() : starts[0].getTime()));
    const endDate = parseLocalDate(toLocalDateStr(new Date()));

    const corr = calculateMenstrualCorrelation(migraines, startDate, endDate);

    if (corr.level === 'insufficient') {
        const msg = corr.reason === 'periods'
            ? 'Log at least two period starts to check for a menstrual pattern.'
            : 'Keep logging migraines and periods — a few more attacks will reveal whether they track your cycle.';
        el.innerHTML = safeHTML(`<p style="color: var(--text-secondary); font-size: 0.85rem;">${msg}</p>`);
        return;
    }

    const obs = Math.round(corr.observedShare * 100);
    const exp = Math.round(corr.expectedShare * 100);
    let color, verdict;
    if (corr.level === 'strong') {
        color = 'var(--accent-red)';
        verdict = `Your migraines cluster around your period: ${obs}% fell in the perimenstrual window (2 days before to 3 days after your period start), vs ${exp}% expected by chance. This looks like menstrually-related migraine — worth discussing with your clinician.`;
    } else if (corr.level === 'moderate') {
        color = 'var(--pain-moderate)';
        verdict = `Some of your migraines line up with your period: ${obs}% fell in the perimenstrual window vs ${exp}% expected by chance. There may be a menstrual component.`;
    } else {
        color = 'var(--accent-green)';
        verdict = `Your migraines don't cluster around your period so far: ${obs}% fell in the perimenstrual window vs ${exp}% expected by chance. Other triggers may matter more.`;
    }
    el.innerHTML = safeHTML(`<div style="padding: 12px 14px; border-radius: 10px; background: var(--bg-tertiary); border-left: 3px solid ${color};">
        <strong>Menstrual-migraine pattern:</strong> ${verdict}
        <span style="display: block; color: var(--text-secondary); font-size: 0.78rem; margin-top: 6px;">${corr.migraineInWindow} of ${corr.migraineDays} migraine days were perimenstrual.</span>
    </div>`);
}

function updateCycleTodayLine() {
    const el = document.getElementById('today-cycle-line');
    if (!el) return;
    if (!cycleData.enabled || cycleData.periods.length === 0) {
        el.style.display = 'none';
        return;
    }
    const today = parseLocalDate(toLocalDateStr(new Date()));
    const day = cycleDayFor(today);
    const est = nextPeriodEstimate();
    let text = day != null ? `Cycle day ${day}` : '';
    if (est && est.daysUntil >= 0) text += `${text ? ' · ' : ''}next period in ~${est.daysUntil} days`;
    el.textContent = text;
    el.style.display = text ? 'block' : 'none';
}

// Toggle the Care card + Today line to match the enabled state, then
// repaint them.
function refreshCycleViews() {
    const card = document.getElementById('cycle-card');
    if (card) card.style.display = cycleData.enabled ? 'block' : 'none';
    renderCycleCard();
    updateCycleTodayLine();
}

function setupCycleUI() {
    const toggle = document.getElementById('cycle-tracking-enabled');
    if (toggle) {
        toggle.checked = cycleData.enabled;
        toggle.addEventListener('change', () => {
            cycleData.enabled = toggle.checked;
            saveCycleData();
            refreshCycleViews();
        });
    }
    const dateInput = document.getElementById('cycle-date-input');
    if (dateInput) {
        const todayStr = toLocalDateStr(new Date());
        dateInput.max = todayStr;
        dateInput.value = todayStr;
    }
    document.getElementById('cycle-add-btn')?.addEventListener('click', () => {
        const v = document.getElementById('cycle-date-input')?.value;
        if (v) addPeriod(v);
    });
    document.getElementById('cycle-today-btn')?.addEventListener('click', () => addPeriod(toLocalDateStr(new Date())));

    const recentEl = document.getElementById('cycle-recent');
    if (recentEl && !recentEl.dataset.delegated) {
        recentEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-remove-period]');
            if (btn) removePeriod(btn.dataset.removePeriod);
        });
        recentEl.dataset.delegated = '1';
    }

    refreshCycleViews();
}

// --- Questionnaire modals ---
// showModal sanitizes the body; select/option/input are allowed tags.
// Values are read from the DOM inside the programmatic submit action.

function openMidasModal() {
    const rows = MIDAS_QUESTIONS.map((q, i) => `
        <div class="form-group" style="margin-bottom: 14px;">
            <label for="midas-q${i}" style="display:block; margin-bottom:6px; font-size:0.9rem;">${i + 1}. ${q}</label>
            <input type="number" id="midas-q${i}" value="0"
                   style="width: 100px; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary);">
            <span style="color: var(--text-secondary); font-size: 0.85rem;"> days</span>
        </div>`).join('');

    showModal('MIDAS Questionnaire', `
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 16px;">
            Answer for the <strong>last 3 months</strong>. Enter a number of days (0 if none).
        </p>
        ${rows}
    `, [
        { text: 'Cancel', class: 'btn-secondary', action: closeModal },
        { text: 'Save Score', class: 'btn-primary', action: submitMidas }
    ]);
}

function submitMidas() {
    const answers = MIDAS_QUESTIONS.map((_, i) => {
        const v = parseInt(document.getElementById(`midas-q${i}`).value, 10);
        return isNaN(v) || v < 0 ? 0 : Math.min(v, 365);
    });
    const score = answers.reduce((s, v) => s + v, 0);
    const { grade, label } = midasGrade(score);
    assessments.push({ id: Date.now(), type: 'midas', date: new Date().toISOString(), answers, score, grade });
    saveAssessments();
    closeModal();
    renderAssessments();
    showModal('MIDAS Result', `<p>Your MIDAS score is <strong>${score}</strong> — Grade ${grade} (${label}).</p><p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 8px;">Saved. It will be included in your doctor report.</p>`);
}

function openHit6Modal() {
    const optionsHtml = HIT6_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    const rows = HIT6_QUESTIONS.map((q, i) => `
        <div class="form-group" style="margin-bottom: 14px;">
            <label for="hit6-q${i}" style="display:block; margin-bottom:6px; font-size:0.9rem;">${i + 1}. ${q}</label>
            <select id="hit6-q${i}" style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary);">
                ${optionsHtml}
            </select>
        </div>`).join('');

    showModal('HIT-6 Questionnaire', `
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 16px;">
            Think about how you have felt over the <strong>past 4 weeks</strong>.
        </p>
        ${rows}
    `, [
        { text: 'Cancel', class: 'btn-secondary', action: closeModal },
        { text: 'Save Score', class: 'btn-primary', action: submitHit6 }
    ]);
}

function submitHit6() {
    const valid = new Set(HIT6_OPTIONS.map(o => o.value));
    const answers = HIT6_QUESTIONS.map((_, i) => {
        const v = parseInt(document.getElementById(`hit6-q${i}`).value, 10);
        return valid.has(v) ? v : 6;
    });
    const score = answers.reduce((s, v) => s + v, 0);
    const { grade, label } = hit6Grade(score);
    assessments.push({ id: Date.now(), type: 'hit6', date: new Date().toISOString(), answers, score, grade });
    saveAssessments();
    closeModal();
    renderAssessments();
    showModal('HIT-6 Result', `<p>Your HIT-6 score is <strong>${score}</strong> (${label}).</p><p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 8px;">Saved. It will be included in your doctor report.</p>`);
}

// Render the latest MIDAS/HIT-6 results on the Care page card
function renderAssessments() {
    const content = document.getElementById('assessments-content');
    if (!content) return;
    const midas = latestAssessment('midas');
    const hit6 = latestAssessment('hit6');
    const fmt = (a, extra) => a
        ? `<div style="font-size:0.85rem; color: var(--text-secondary); margin-top:4px;">Latest: <strong>${a.score}</strong>${extra(a)} · ${formatDate(new Date(a.date))}</div>`
        : `<div style="font-size:0.85rem; color: var(--text-secondary); margin-top:4px;">Not taken yet</div>`;
    content.innerHTML = safeHTML(`
        <div style="margin-bottom: 12px;">
            <div style="font-weight:600;">MIDAS <span style="font-weight:400; color:var(--text-secondary); font-size:0.8rem;">— disability over 3 months</span></div>
            ${fmt(midas, a => ` (Grade ${safeText(a.grade)})`)}
        </div>
        <div>
            <div style="font-weight:600;">HIT-6 <span style="font-weight:400; color:var(--text-secondary); font-size:0.8rem;">— headache impact</span></div>
            ${fmt(hit6, a => ` (${safeText(hit6Grade(a.score).label)})`)}
        </div>
    `);
}
let activeMigraine = null;
let durationInterval = null;
let currentMonth = new Date();
let currentPage = 'log';

// Medication Library
let medicationLibrary = [];
let userMedications = [];
let currentEpisodeMedications = []; // Temporary storage for medications being logged

// The "Add Medication" flow (search/select/dosage/confirm) writes
// wherever this points. Each genuine entry point sets it explicitly
// before opening the modal; navigating "Back" mid-flow calls
// showAddMedicationModal() with no argument, which leaves it as-is so
// the same context carries through. Quick-log is the default so the
// page-load render and clearForm() (which call renderMedicationsList()
// directly, not through the modal) target the right list.
const QUICKLOG_MED_CONTEXT = {
    containerId: 'medications-list',
    getList: () => currentEpisodeMedications,
    onChange: null
};
let medicationPickerContext = QUICKLOG_MED_CONTEXT;

// Import flow state (avoids serializing datasets into DOM attributes)
let pendingImportAnalysis = null;

// Associated symptoms & aura (controlled list, ICHD-3 aligned).
// Episodes store the keys; UI renders the labels.
const SYMPTOM_OPTIONS = [
    { key: 'nausea', label: 'Nausea' },
    { key: 'vomiting', label: 'Vomiting' },
    { key: 'photophobia', label: 'Light sensitivity' },
    { key: 'phonophobia', label: 'Sound sensitivity' },
    { key: 'osmophobia', label: 'Smell sensitivity' },
    { key: 'aura_visual', label: 'Visual aura' },
    { key: 'aura_sensory', label: 'Sensory aura (tingling/numbness)' },
    { key: 'aura_speech', label: 'Speech/language aura' },
    { key: 'neck_pain', label: 'Neck pain' },
    { key: 'dizziness', label: 'Dizziness/vertigo' },
    { key: 'blurred_vision', label: 'Blurred vision' },
    { key: 'fatigue', label: 'Fatigue' }
];
const SYMPTOM_KEYS = new Set(SYMPTOM_OPTIONS.map(s => s.key));
const SYMPTOM_LABELS = Object.fromEntries(SYMPTOM_OPTIONS.map(s => [s.key, s.label]));

// Possible triggers (controlled list). Episodes store keys; UI renders labels.
const TRIGGER_OPTIONS = [
    { key: 'stress', label: 'Stress' },
    { key: 'poor_sleep', label: 'Poor sleep' },
    { key: 'oversleep', label: 'Too much sleep' },
    { key: 'skipped_meal', label: 'Skipped meal' },
    { key: 'dehydration', label: 'Dehydration' },
    { key: 'alcohol', label: 'Alcohol' },
    { key: 'caffeine', label: 'Caffeine' },
    { key: 'caffeine_withdrawal', label: 'Caffeine withdrawal' },
    { key: 'chocolate', label: 'Chocolate' },
    { key: 'aged_cheese', label: 'Aged cheese' },
    { key: 'processed_food', label: 'MSG/processed food' },
    { key: 'bright_light', label: 'Bright light' },
    { key: 'loud_noise', label: 'Loud noise' },
    { key: 'strong_smell', label: 'Strong smells' },
    { key: 'screen_time', label: 'Screen time' },
    { key: 'exertion', label: 'Physical exertion' },
    { key: 'hormonal', label: 'Hormonal/menstrual' },
    { key: 'weather', label: 'Weather change' },
    { key: 'travel', label: 'Travel' }
];
const TRIGGER_KEYS = new Set(TRIGGER_OPTIONS.map(t => t.key));
const TRIGGER_LABELS = Object.fromEntries(TRIGGER_OPTIONS.map(t => [t.key, t.label]));

// Prodrome — premonitory warning signs in the hours/days BEFORE the
// headache. Controlled list; episodes store keys, UI renders labels.
const PRODROME_OPTIONS = [
    { key: 'yawning', label: 'Excessive yawning' },
    { key: 'food_cravings', label: 'Food cravings' },
    { key: 'mood_change', label: 'Mood changes' },
    { key: 'irritability', label: 'Irritability' },
    { key: 'neck_stiffness', label: 'Neck stiffness' },
    { key: 'fatigue', label: 'Fatigue / low energy' },
    { key: 'difficulty_concentrating', label: 'Difficulty concentrating' },
    { key: 'frequent_urination', label: 'Frequent urination' },
    { key: 'light_sensitivity', label: 'Early light sensitivity' }
];
const PRODROME_KEYS = new Set(PRODROME_OPTIONS.map(p => p.key));
const PRODROME_LABELS = Object.fromEntries(PRODROME_OPTIONS.map(p => [p.key, p.label]));

// Postdrome — the "migraine hangover" AFTER the pain resolves.
const POSTDROME_OPTIONS = [
    { key: 'fatigue', label: 'Fatigue / drained' },
    { key: 'brain_fog', label: 'Brain fog' },
    { key: 'mood_change', label: 'Mood changes' },
    { key: 'neck_stiffness', label: 'Neck stiffness' },
    { key: 'dizziness', label: 'Dizziness' },
    { key: 'weakness', label: 'Weakness' },
    { key: 'body_aches', label: 'Body aches' },
    { key: 'sensitivity_lingering', label: 'Lingering light/sound sensitivity' }
];
const POSTDROME_KEYS = new Set(POSTDROME_OPTIONS.map(p => p.key));
const POSTDROME_LABELS = Object.fromEntries(POSTDROME_OPTIONS.map(p => [p.key, p.label]));

// Head-pain location zones (controlled list). Keys carry _left/_right
// suffixes where sided, so laterality can be derived. Episodes store
// keys; the interactive head map + text render labels.
const HEAD_ZONES = [
    { key: 'forehead', label: 'Forehead' },
    { key: 'temple_left', label: 'Left temple' },
    { key: 'temple_right', label: 'Right temple' },
    { key: 'eye_left', label: 'Behind left eye' },
    { key: 'eye_right', label: 'Behind right eye' },
    { key: 'crown', label: 'Top of head' },
    { key: 'side_left', label: 'Left side' },
    { key: 'side_right', label: 'Right side' },
    { key: 'occiput', label: 'Back of head' },
    { key: 'neck', label: 'Neck / base of skull' }
];
const HEAD_ZONE_KEYS = new Set(HEAD_ZONES.map(z => z.key));
const HEAD_ZONE_LABELS = Object.fromEntries(HEAD_ZONES.map(z => [z.key, z.label]));

// Pain quality (ICHD-3-aligned descriptors), a chip multi-select.
const PAIN_QUALITY_OPTIONS = [
    { key: 'pulsating', label: 'Pulsating / throbbing' },
    { key: 'pressing', label: 'Pressing / tight' },
    { key: 'stabbing', label: 'Stabbing / sharp' },
    { key: 'burning', label: 'Burning' },
    { key: 'dull', label: 'Dull ache' }
];
const PAIN_QUALITY_KEYS = new Set(PAIN_QUALITY_OPTIONS.map(q => q.key));
const PAIN_QUALITY_LABELS = Object.fromEntries(PAIN_QUALITY_OPTIONS.map(q => [q.key, q.label]));

// Selections on the quick-log form (for the next new episode)
let selectedSymptoms = new Set();
let selectedTriggers = new Set();
let selectedProdrome = new Set();
let selectedPainLocations = new Set();
let selectedQuality = new Set();

// Map stored keys -> display labels for a controlled option list
function optionLabels(keys, keySet, labelMap) {
    if (!Array.isArray(keys)) return [];
    return keys.filter(k => keySet.has(k)).map(k => labelMap[k]);
}
const symptomLabels = (keys) => optionLabels(keys, SYMPTOM_KEYS, SYMPTOM_LABELS);
const triggerLabels = (keys) => optionLabels(keys, TRIGGER_KEYS, TRIGGER_LABELS);
const prodromeLabels = (keys) => optionLabels(keys, PRODROME_KEYS, PRODROME_LABELS);
const postdromeLabels = (keys) => optionLabels(keys, POSTDROME_KEYS, POSTDROME_LABELS);
const headZoneLabels = (keys) => optionLabels(keys, HEAD_ZONE_KEYS, HEAD_ZONE_LABELS);
const qualityLabels = (keys) => optionLabels(keys, PAIN_QUALITY_KEYS, PAIN_QUALITY_LABELS);

// Derive laterality from the selected head zones (no stored field):
// any _left + any _right -> Bilateral; only one side -> Left/Right;
// only central zones -> Central; none -> ''.
function deriveLaterality(keys) {
    if (!Array.isArray(keys)) return '';
    const valid = keys.filter(k => HEAD_ZONE_KEYS.has(k));
    if (valid.length === 0) return '';
    const hasLeft = valid.some(k => k.endsWith('_left'));
    const hasRight = valid.some(k => k.endsWith('_right'));
    if (hasLeft && hasRight) return 'Bilateral';
    if (hasLeft) return 'Left';
    if (hasRight) return 'Right';
    return 'Central';
}

// Render a chip multi-select. Chips carry data-chip-key; toggling is
// handled by one delegated listener (bindOptionChips). No inline onclick
// (safeHTML strips event-handler attributes).
function renderOptionChips(containerId, options, selectedSet) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = safeHTML(options.map(o => {
        const on = selectedSet.has(o.key) ? ' selected' : '';
        return `<button type="button" class="chip${on}" data-chip-key="${safeText(o.key)}" aria-pressed="${selectedSet.has(o.key)}">${safeText(o.label)}</button>`;
    }).join(''));
}

// Attach one delegated toggle listener (idempotent). onToggle(key, isOn)
// lets the caller react (e.g. persist). validKeys guards the toggle.
function bindOptionChips(containerId, options, selectedSet, onToggle) {
    const container = document.getElementById(containerId);
    if (!container || container.dataset.delegated) return;
    const validKeys = new Set(options.map(o => o.key));
    container.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-chip-key]');
        if (!chip) return;
        const key = chip.dataset.chipKey;
        if (!validKeys.has(key)) return;
        const isOn = !selectedSet.has(key);
        if (isOn) selectedSet.add(key); else selectedSet.delete(key);
        chip.classList.toggle('selected', isOn);
        chip.setAttribute('aria-pressed', String(isOn));
        if (onToggle) onToggle(key, isOn);
    });
    container.dataset.delegated = '1';
}

// Thin wrappers keep existing symptom call sites unchanged
const renderSymptomChips = (containerId, selectedSet) => renderOptionChips(containerId, SYMPTOM_OPTIONS, selectedSet);
const bindSymptomChips = (containerId, selectedSet, onToggle) => bindOptionChips(containerId, SYMPTOM_OPTIONS, selectedSet, onToggle);
const renderTriggerChips = (containerId, selectedSet) => renderOptionChips(containerId, TRIGGER_OPTIONS, selectedSet);
const bindTriggerChips = (containerId, selectedSet, onToggle) => bindOptionChips(containerId, TRIGGER_OPTIONS, selectedSet, onToggle);
const renderProdromeChips = (containerId, selectedSet) => renderOptionChips(containerId, PRODROME_OPTIONS, selectedSet);
const bindProdromeChips = (containerId, selectedSet, onToggle) => bindOptionChips(containerId, PRODROME_OPTIONS, selectedSet, onToggle);
const renderPostdromeChips = (containerId, selectedSet) => renderOptionChips(containerId, POSTDROME_OPTIONS, selectedSet);
const bindPostdromeChips = (containerId, selectedSet, onToggle) => bindOptionChips(containerId, POSTDROME_OPTIONS, selectedSet, onToggle);
const renderQualityChips = (containerId, selectedSet) => renderOptionChips(containerId, PAIN_QUALITY_OPTIONS, selectedSet);
const bindQualityChips = (containerId, selectedSet, onToggle) => bindOptionChips(containerId, PAIN_QUALITY_OPTIONS, selectedSet, onToggle);

// Interactive head-pain map. Authored once as a constant SVG (no user
// data) so it can be injected via direct innerHTML — it must NOT pass
// through safeHTML, which strips <svg>. Two head outlines (front + back)
// with tappable elliptical hotspot zones. Left-labelled zones sit on the
// screen-left of both views (mirror style); the label text + the derived
// laterality are authoritative. Selected zones from left→right for both.
const HEAD_MAP_SVG = `
    <svg viewBox="0 0 300 165" class="head-map" role="group" aria-label="Head pain location map" xmlns="http://www.w3.org/2000/svg">
        <ellipse class="head-outline" cx="85" cy="78" rx="44" ry="54"></ellipse>
        <ellipse class="head-outline" cx="215" cy="78" rx="44" ry="54"></ellipse>
        <ellipse class="head-zone" data-zone="forehead" role="button" tabindex="0" cx="85" cy="46" rx="27" ry="14"><title>Forehead</title></ellipse>
        <ellipse class="head-zone" data-zone="temple_left" role="button" tabindex="0" cx="50" cy="68" rx="13" ry="17"><title>Left temple</title></ellipse>
        <ellipse class="head-zone" data-zone="temple_right" role="button" tabindex="0" cx="120" cy="68" rx="13" ry="17"><title>Right temple</title></ellipse>
        <ellipse class="head-zone" data-zone="eye_left" role="button" tabindex="0" cx="68" cy="92" rx="12" ry="9"><title>Behind left eye</title></ellipse>
        <ellipse class="head-zone" data-zone="eye_right" role="button" tabindex="0" cx="102" cy="92" rx="12" ry="9"><title>Behind right eye</title></ellipse>
        <ellipse class="head-zone" data-zone="crown" role="button" tabindex="0" cx="215" cy="44" rx="29" ry="15"><title>Top of head</title></ellipse>
        <ellipse class="head-zone" data-zone="side_left" role="button" tabindex="0" cx="180" cy="76" rx="13" ry="21"><title>Left side</title></ellipse>
        <ellipse class="head-zone" data-zone="side_right" role="button" tabindex="0" cx="250" cy="76" rx="13" ry="21"><title>Right side</title></ellipse>
        <ellipse class="head-zone" data-zone="occiput" role="button" tabindex="0" cx="215" cy="94" rx="24" ry="18"><title>Back of head</title></ellipse>
        <ellipse class="head-zone" data-zone="neck" role="button" tabindex="0" cx="215" cy="128" rx="17" ry="12"><title>Neck / base of skull</title></ellipse>
        <text class="head-map-caption" x="85" y="150" text-anchor="middle">Front</text>
        <text class="head-map-caption" x="215" y="150" text-anchor="middle">Back</text>
    </svg>
    <p class="head-map-echo"></p>`;

function updateHeadMapEcho(container, selectedSet) {
    const echo = container && container.querySelector('.head-map-echo');
    if (!echo) return;
    const arr = Array.from(selectedSet);
    const labels = headZoneLabels(arr);
    if (labels.length === 0) {
        echo.textContent = 'Tap the areas where it hurts.';
    } else {
        const lat = deriveLaterality(arr);
        echo.textContent = `Selected: ${labels.join(', ')}${lat ? ` (${lat})` : ''}`;
    }
}

// Paint the map into a container and reflect the current selection.
// interactive=false leaves it read-only (e.g. Episode Details view).
function renderHeadMap(containerId, selectedSet, interactive = true) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = HEAD_MAP_SVG; // constant markup, no user data
    container.classList.toggle('head-map-readonly', !interactive);
    container.querySelectorAll('.head-zone').forEach(zone => {
        const on = selectedSet.has(zone.dataset.zone);
        zone.classList.toggle('selected', on);
        zone.setAttribute('aria-pressed', String(on));
        if (!interactive) zone.removeAttribute('tabindex');
    });
    updateHeadMapEcho(container, selectedSet);
}

// One idempotent delegated listener; handles click + Enter/Space.
function bindHeadMap(containerId, selectedSet, onToggle) {
    const container = document.getElementById(containerId);
    if (!container || container.dataset.delegated) return;
    const toggleZone = (zone) => {
        const key = zone.dataset.zone;
        if (!HEAD_ZONE_KEYS.has(key)) return;
        const isOn = !selectedSet.has(key);
        if (isOn) selectedSet.add(key); else selectedSet.delete(key);
        zone.classList.toggle('selected', isOn);
        zone.setAttribute('aria-pressed', String(isOn));
        updateHeadMapEcho(container, selectedSet);
        if (onToggle) onToggle(key, isOn);
    };
    container.addEventListener('click', (e) => {
        const zone = e.target.closest('[data-zone]');
        if (zone) toggleZone(zone);
    });
    container.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const zone = e.target.closest('[data-zone]');
        if (zone) { e.preventDefault(); toggleZone(zone); }
    });
    container.dataset.delegated = '1';
}

// XSS Protection Helper
// Sanitizes HTML to prevent XSS attacks when using innerHTML
function safeHTML(html) {
    if (typeof DOMPurify !== 'undefined') {
        // No event-handler attributes (onclick/onchange) may pass
        // through here - interactivity uses addEventListener with
        // data-* attributes instead
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['div', 'span', 'p', 'b', 'i', 'strong', 'em', 'br', 'ul', 'ol', 'li', 'a', 'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'select', 'option', 'input', 'label', 'textarea', 'form'],
            ALLOWED_ATTR: ['class', 'style', 'href', 'target', 'id', 'value', 'type', 'placeholder', 'checked', 'selected', 'disabled', 'name', 'for', 'title'],
            ALLOW_DATA_ATTR: true
        });
    }
    // Fallback: basic escaping if DOMPurify not available
    return String(html)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Safe text rendering - escapes all HTML
function safeText(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function episodeIdMatches(episode, id) {
    return episode && String(episode.id) === String(id);
}

function getNotificationEpisodeId(rawId) {
    return String(rawId || '').split('-')[0];
}

// Robust retry helper for DOM-dependent operations
function retryUntilSuccess(fn, checkFn, maxAttempts = 15, delayMs = 10, attemptNum = 1) {
    // checkFn returns true if we should execute fn
    if (checkFn()) {
        fn();
        return;
    }

    if (attemptNum >= maxAttempts) {
        console.warn(`[WARNING] Max attempts reached for ${fn.name}, giving up`);
        return;
    }

    // Aggressive early retries, then exponential backoff
    // Attempt 1: immediate, 2: 10ms, 3: 20ms, 4: 40ms, 5: 80ms, 6: 160ms, etc.
    let nextDelay;
    if (attemptNum === 1) {
        // First retry happens almost immediately via requestAnimationFrame
        nextDelay = 0;
    } else if (attemptNum <= 4) {
        // Fast retries for first 4 attempts: 10ms, 20ms, 40ms
        nextDelay = delayMs * Math.pow(2, attemptNum - 2);
    } else {
        // Then slower exponential backoff: 80ms, 160ms, 320ms, etc.
        nextDelay = delayMs * Math.pow(2, attemptNum - 2);
    }

    console.log(`[PENDING] ${fn.name} - elements not ready, retrying in ${Math.round(nextDelay)}ms (attempt ${attemptNum}/${maxAttempts})`);

    if (nextDelay === 0) {
        // Use requestAnimationFrame for the first retry (almost immediate)
        requestAnimationFrame(() => {
            retryUntilSuccess(fn, checkFn, maxAttempts, delayMs, attemptNum + 1);
        });
    } else {
        setTimeout(() => {
            retryUntilSuccess(fn, checkFn, maxAttempts, delayMs, attemptNum + 1);
        }, nextDelay);
    }
}

// Loading screen progress management
function updateLoadingProgress(percent, status) {
    const progressBar = document.getElementById('loading-progress-bar');
    const statusText = document.getElementById('loading-status');

    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }
    if (statusText) {
        statusText.textContent = status;
    }

    console.log(`[ANALYTICS] Loading: ${percent}% - ${status}`);
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('app-loading-screen');
    if (loadingScreen) {
        // Add hidden class to trigger fade out animation
        loadingScreen.classList.add('hidden');

        // Remove from DOM after animation completes
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);

        console.log('[SUCCESS] Loading complete - app ready');
    }
}

// Main app initialization (called after IndexedDB is ready)
async function initApp() {
    // If at-rest encryption is on, unlock (derive the key from the
    // passphrase) BEFORE loading — the plaintext stores are wiped and
    // the vault can't be read without the key.
    loadEncMeta();
    if (encEnabled() && !encUnlocked) {
        updateLoadingProgress(8, 'Waiting for unlock...');
        await showEncryptionUnlockGate();
    }

    updateLoadingProgress(10, 'Loading your data...');
    await loadData();

    updateLoadingProgress(20, 'Cleaning up old records...');
    purgeOldDeletedEpisodes();

    updateLoadingProgress(25, 'Initializing medication library...');
    initializeMedicationLibrary();
    loadAssessments();
    loadCycleData();

    updateLoadingProgress(30, 'Setting up theme...');
    initializeTheme();

    updateLoadingProgress(35, 'Configuring navigation...');
    initializeNavigation();

    updateLoadingProgress(40, 'Setting up pain scale...');
    initializePainScale();

    updateLoadingProgress(45, 'Initializing logging system...');
    initializeLogging();

    updateLoadingProgress(50, 'Preparing history...');
    initializeHistory();

    updateLoadingProgress(55, 'Setting up calendar...');
    initializeCalendar();

    updateLoadingProgress(60, 'Loading settings...');
    initializeSettings();
    setupCycleUI();
    setupEncryptionUI();

    updateLoadingProgress(65, 'Configuring notifications...');
    await initializeNotifications();

    updateLoadingProgress(70, 'Setting up weather tracking...');
    await initWeatherTracking();

    updateLoadingProgress(75, 'Initializing relief methods...');
    initializeReliefMethods();

    updateLoadingProgress(80, 'Checking active migraine...');
    checkActiveMigraine();

    // CRITICAL FIX: Ensure log page is shown first so DOM elements are accessible
    updateLoadingProgress(85, 'Preparing dashboard...');
    console.log('[RELOAD] Initializing UI - showing log page first');
    showPage('log');

    // Apply any notification/shortcut deep-link AFTER the default page
    // is set, so ?action=analytics/care/log lands on the right screen.
    handleNotificationDeepLink();

    // Use robust retry mechanism to ensure UI updates when DOM is ready
    console.log('[RELOAD] Starting robust UI initialization with retry logic...');

    updateLoadingProgress(90, 'Loading statistics...');
    // Retry dashboard update until elements are found
    retryUntilSuccess(
        updateDashboard,
        () => {
            const totalElem = document.getElementById('total-episodes');
            const avgPainElem = document.getElementById('avg-pain');
            const weekCountElem = document.getElementById('week-count');
            return !!(totalElem && avgPainElem && weekCountElem);
        }
    );

    updateLoadingProgress(93, 'Rendering calendar...');
    // Retry calendar render until elements are found
    retryUntilSuccess(
        renderCalendar,
        () => {
            const currentMonthElem = document.getElementById('current-month');
            const calendarGridElem = document.getElementById('calendar-grid');
            return !!(currentMonthElem && calendarGridElem);
        }
    );

    updateLoadingProgress(96, 'Loading history...');
    // Retry history render until element is found
    retryUntilSuccess(
        renderHistory,
        () => !!document.getElementById('history-list')
    );

    updateLoadingProgress(98, 'Finalizing setup...');
    // First visit opens directly on the logging surface; tour remains in Settings.

    // Hide loading screen after a brief moment to ensure UI is stable
    updateLoadingProgress(100, 'Ready!');
    setTimeout(() => {
        hideLoadingScreen();
    }, 300);
}

// Validate active migraine to prevent stuck states
function validateActiveMigraine(migraine) {
    if (!migraine || !migraine.id || !migraine.startTime) return false;
    const start = new Date(migraine.startTime).getTime();
    if (!Number.isFinite(start)) return false;
    // Unknown pain is intentional in one-tap logging; zero is also valid.
    return migraine.painLevel == null ||
(Number.isInteger(migraine.painLevel) && migraine.painLevel >= 0 && migraine.painLevel <= 10);
}

// ============================================
// AT-REST ENCRYPTION (WebCrypto, passphrase → AES-GCM vault)
// ============================================
// Real zero-knowledge encryption of the core health vault. The master
// key is derived from the user's passphrase via PBKDF2 and held ONLY in
// memory after unlock — never persisted in plaintext. encMeta (salt,
// iterations, verifier) is stored unencrypted; the vault ciphertext holds
// migraines/activeMigraine/cycleData/assessments/userMedications.

const ENC_KDF_ITERATIONS = 310000;   // PBKDF2-SHA256 rounds
const ENC_VERIFIER_TEXT = 'aiding-migraine-vault-v1';
let encMasterKey = null;              // CryptoKey, in memory only after unlock
let encMeta = null;                   // { enabled, salt, iterations, verifier, kdf, v }
let encUnlocked = false;              // true once the key is loaded this session

function loadEncMeta() {
    try {
        const raw = localStorage.getItem('encMeta');
        encMeta = raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.error('[ERROR] Corrupt encMeta:', e);
        encMeta = null;
    }
    return encMeta;
}
// Encryption is "on" once meta says enabled. Callers that read/write the
// vault additionally require encUnlocked (the key present in memory).
function encEnabled() {
    return !!(encMeta && encMeta.enabled);
}

// --- base64 <-> ArrayBuffer helpers ---
function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}
function b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
}

// Derive an AES-GCM CryptoKey from a passphrase + salt via PBKDF2.
async function deriveKey(passphrase, saltBuf, iterations) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        'raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: saltBuf, iterations: iterations || ENC_KDF_ITERATIONS, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

// Encrypt an object → { iv, ct } (base64). A fresh 12-byte IV per write.
async function encryptWithKey(obj, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))
    );
    return { iv: bufToB64(iv), ct: bufToB64(ct) };
}

// Decrypt { iv, ct } → object. Throws if the key/passphrase is wrong
// (GCM authentication tag mismatch), which we use to validate unlock.
async function decryptWithKey(blob, key) {
    const iv = new Uint8Array(b64ToBuf(blob.iv));
    const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv }, key, b64ToBuf(blob.ct)
    );
    return JSON.parse(new TextDecoder().decode(pt));
}

// Validate a candidate passphrase by decrypting the stored verifier.
async function verifyPassphrase(passphrase) {
    if (!encMeta || !encMeta.salt || !encMeta.verifier) return null;
    const key = await deriveKey(passphrase, b64ToBuf(encMeta.salt), encMeta.iterations);
    try {
        const check = await decryptWithKey(encMeta.verifier, key);
        return check === ENC_VERIFIER_TEXT ? key : null;
    } catch (e) {
        return null; // wrong passphrase
    }
}

// Serialize writes so overlapping saves can't interleave (each write
// re-encrypts the whole vault; a queue makes last-call-wins deterministic).
let vaultWriteChain = Promise.resolve();

// Encrypt the in-memory sensitive state and write it as one blob to the
// IndexedDB settings store + a localStorage mirror. No-op if locked.
function persistVault() {
    if (!encEnabled() || !encMasterKey) return Promise.resolve(false);
    vaultWriteChain = vaultWriteChain.then(async () => {
        const vault = {
            migraines,
            activeMigraine,
            cycleData,
            assessments,
            userMedications
        };
        const blob = await encryptWithKey(vault, encMasterKey);
        const json = JSON.stringify(blob);
        let persisted = false;
        if (useIndexedDB && db) {
            try { await IDB.put(DB_STORES.SETTINGS, { key: 'encVault', value: blob }); persisted = true; }
            catch (e) { console.error('[ERROR] vault IDB write failed:', e); }
        }
        try { localStorage.setItem('encVault', json); }
        catch (error) { if (!persisted) throw error; }
        return true;
    }).catch(e => { console.error('[ERROR] persistVault failed:', e); return false; });
    return vaultWriteChain;
}

// Decrypt the vault into the in-memory state. Requires the master key.
async function loadVault() {
    if (!encEnabled() || !encMasterKey) return false;
    let blob = null;
    if (useIndexedDB && db) {
        try {
            const rec = await IDB.get(DB_STORES.SETTINGS, 'encVault');
            if (rec && rec.value) blob = rec.value;
        } catch (e) { console.error('[ERROR] vault IDB read failed:', e); }
    }
    if (!blob) {
        const raw = localStorage.getItem('encVault');
        if (raw) { try { blob = JSON.parse(raw); } catch (e) {} }
    }
    if (!blob) return false; // nothing stored yet (just enabled)
    const vault = await decryptWithKey(blob, encMasterKey);
    migraines = Array.isArray(vault.migraines) ? vault.migraines : [];
    activeMigraine = vault.activeMigraine || null;
    if (vault.cycleData && typeof vault.cycleData === 'object') cycleData = vault.cycleData;
    assessments = Array.isArray(vault.assessments) ? vault.assessments : [];
    userMedications = Array.isArray(vault.userMedications) ? vault.userMedications : [];
    return true;
}

// Remove all plaintext copies of the sensitive stores (called when
// encryption is turned on, so the vault becomes the sole source).
async function wipePlaintextStores() {
    ['migraines', 'activeMigraine', 'cycleData', 'assessments', 'userMedications'].forEach(k => localStorage.removeItem(k));
    if (useIndexedDB && db) {
        try {
            const keys = await IDB.getAllKeys(DB_STORES.MIGRAINES);
            for (const key of keys) await IDB.delete(DB_STORES.MIGRAINES, key);
            await IDB.delete(DB_STORES.SETTINGS, 'activeMigraine');
        } catch (e) { console.error('[ERROR] wipePlaintextStores failed:', e); }
    }
}

// Remove the encrypted vault (called when encryption is turned off,
// after the plaintext has been written back).
async function removeVault() {
    localStorage.removeItem('encVault');
    if (useIndexedDB && db) {
        try { await IDB.delete(DB_STORES.SETTINGS, 'encVault'); } catch (e) {}
    }
}

function saveEncMeta() {
    localStorage.setItem('encMeta', JSON.stringify(encMeta));
}

// Turn encryption ON: derive a key from the passphrase, encrypt the
// current in-memory data into the vault, and wipe the plaintext copies.
async function enableEncryption(passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(passphrase, salt.buffer, ENC_KDF_ITERATIONS);
    const verifier = await encryptWithKey(ENC_VERIFIER_TEXT, key);
    encMeta = { enabled: true, salt: bufToB64(salt.buffer), iterations: ENC_KDF_ITERATIONS, verifier, kdf: 'PBKDF2', v: 1 };
    encMasterKey = key;
    encUnlocked = true;
    saveEncMeta();
    await persistVault();
    await wipePlaintextStores();
}

// Turn encryption OFF: write the in-memory data back as plaintext and
// remove the vault + metadata. Requires the key in memory (unlocked).
async function disableEncryption() {
    if (!encMasterKey) return false;
    encMeta = null; // encEnabled() now false → saves take the plaintext path
    localStorage.removeItem('encMeta');
    await saveData();
    saveCycleData();
    saveAssessments();
    saveMedicationLibrary();
    await removeVault();
    encMasterKey = null;
    encUnlocked = false;
    return true;
}

// Re-key the vault with a new passphrase (old passphrase required).
async function changePassphrase(oldPass, newPass) {
    const key = await verifyPassphrase(oldPass);
    if (!key) return false;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const newKey = await deriveKey(newPass, salt.buffer, ENC_KDF_ITERATIONS);
    const verifier = await encryptWithKey(ENC_VERIFIER_TEXT, newKey);
    encMeta = { enabled: true, salt: bufToB64(salt.buffer), iterations: ENC_KDF_ITERATIONS, verifier, kdf: 'PBKDF2', v: 1 };
    encMasterKey = newKey;
    saveEncMeta();
    await persistVault();
    return true;
}

// --- Encryption Settings UI ---

function syncEncryptionUI() {
    const toggle = document.getElementById('encryption-toggle');
    const status = document.getElementById('encryption-status');
    const actions = document.getElementById('encryption-actions');
    if (toggle) toggle.checked = encEnabled();
    if (status) status.textContent = encEnabled()
        ? 'On — your data is encrypted at rest with AES-256.'
        : 'Off';
    if (actions) actions.style.display = encEnabled() ? 'block' : 'none';
}

function openEnableEncryptionModal() {
    const body = `
        <div style="padding: 12px 14px; border-radius: 10px; background: var(--bg-tertiary); border-left: 3px solid var(--accent-red); margin-bottom: 14px; font-size: 0.9rem;">
            <strong>Important:</strong> your data will be encrypted with this passphrase. If you forget it, <strong>it cannot be recovered</strong> — there is no backdoor. Keep an unencrypted JSON backup (Export in Settings) somewhere safe first.
        </div>
        <div class="form-group">
            <label for="enc-pass">Passphrase (at least 8 characters)</label>
            <input type="password" id="enc-pass" placeholder="Choose a strong passphrase" autocomplete="new-password" style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 1rem;">
        </div>
        <div class="form-group">
            <label for="enc-pass2">Confirm passphrase</label>
            <input type="password" id="enc-pass2" placeholder="Re-enter passphrase" autocomplete="new-password" style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 1rem;">
        </div>
        <p id="enc-error" style="display: none; color: var(--accent-red); font-size: 0.85rem;"></p>`;
    showModal('Encrypt your data', body, [
        { text: 'Cancel', class: 'btn-secondary', action: () => { closeModal(); syncEncryptionUI(); } },
        { text: 'Encrypt', class: 'btn-primary', action: async (e) => {
            const p1 = document.getElementById('enc-pass').value;
            const p2 = document.getElementById('enc-pass2').value;
            const err = document.getElementById('enc-error');
            const fail = (msg) => { if (err) { err.textContent = msg; err.style.display = 'block'; } };
            if (p1.length < 8) return fail('Passphrase must be at least 8 characters.');
            if (p1 !== p2) return fail('Passphrases do not match.');
            try {
                await withBusy(e.currentTarget, 'Encrypting...', () => enableEncryption(p1));
                closeModal();
                syncEncryptionUI();
                showModal('Encryption on', 'Your data is now encrypted at rest. You will be asked for your passphrase when you open the app.');
            } catch (e) {
                console.error('[ERROR] enableEncryption failed:', e);
                fail('Something went wrong enabling encryption. Your data was not changed.');
            }
        }}
    ]);
}

function openDisableEncryptionModal() {
    showModal('Turn off encryption', '<p>Your data will be stored unencrypted again on this device. Continue?</p>', [
        { text: 'Cancel', class: 'btn-secondary', action: () => { closeModal(); syncEncryptionUI(); } },
        { text: 'Turn off', class: 'btn-danger', action: async (e) => {
            try {
                await withBusy(e.currentTarget, 'Decrypting...', () => disableEncryption());
                closeModal();
                syncEncryptionUI();
                showModal('Encryption off', 'Your data is no longer encrypted at rest.');
            } catch (e) {
                console.error('[ERROR] disableEncryption failed:', e);
                closeModal();
                syncEncryptionUI();
            }
        }}
    ]);
}

function openChangePassphraseModal() {
    const body = `
        <div class="form-group">
            <label for="enc-old">Current passphrase</label>
            <input type="password" id="enc-old" autocomplete="current-password" style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 1rem;">
        </div>
        <div class="form-group">
            <label for="enc-new">New passphrase (at least 8 characters)</label>
            <input type="password" id="enc-new" autocomplete="new-password" style="width: 100%; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 1rem;">
        </div>
        <p id="enc-error" style="display: none; color: var(--accent-red); font-size: 0.85rem;"></p>`;
    showModal('Change passphrase', body, [
        { text: 'Cancel', class: 'btn-secondary', action: closeModal },
        { text: 'Change', class: 'btn-primary', action: async (e) => {
            const oldP = document.getElementById('enc-old').value;
            const newP = document.getElementById('enc-new').value;
            const err = document.getElementById('enc-error');
            const fail = (msg) => { if (err) { err.textContent = msg; err.style.display = 'block'; } };
            if (newP.length < 8) return fail('New passphrase must be at least 8 characters.');
            const ok = await withBusy(e.currentTarget, 'Re-encrypting...', () => changePassphrase(oldP, newP));
            if (!ok) return fail('Current passphrase is incorrect.');
            closeModal();
            showModal('Passphrase changed', 'Your data has been re-encrypted with the new passphrase.');
        }}
    ]);
}

function setupEncryptionUI() {
    const toggle = document.getElementById('encryption-toggle');
    if (toggle) {
        toggle.addEventListener('change', () => {
            if (toggle.checked && !encEnabled()) openEnableEncryptionModal();
            else if (!toggle.checked && encEnabled()) openDisableEncryptionModal();
        });
    }
    document.getElementById('change-passphrase-btn')?.addEventListener('click', openChangePassphraseModal);
    syncEncryptionUI();
}

async function loadData() {
    let dataLoaded = false;

    // Encrypted mode: the sole source of truth is the vault, which is
    // decrypted after unlock. If still locked, load nothing (the startup
    // gate ensures unlock happens first); plaintext stores are wiped.
    if (encEnabled()) {
        if (encUnlocked) await loadVault();
        return;
    }

    // Try IndexedDB first
    if (useIndexedDB && db) {
        try {
            const migrainesFromDB = await IDB.getAll(DB_STORES.MIGRAINES);

            // Migration runs before this read; an empty primary store is authoritative.
            migraines = Array.isArray(migrainesFromDB) ? migrainesFromDB : [];
            dataLoaded = true;

            // Load active migraine from settings store
            const activeMigraineData = await IDB.get(DB_STORES.SETTINGS, 'activeMigraine');
            activeMigraine = null;
            if (activeMigraineData) {
                activeMigraine = activeMigraineData.value;
                // Validate active migraine
                if (!validateActiveMigraine(activeMigraine)) {
                    console.warn('[WARNING] Invalid active migraine found in IndexedDB, clearing...');
                    activeMigraine = null;
                    await IDB.delete(DB_STORES.SETTINGS, 'activeMigraine');
                }
            }

            if (dataLoaded) {
                return;
            }
        } catch (error) {
            console.error('Error loading from IndexedDB:', error);
            // Fall through to localStorage
        }
    }

    // Fallback to localStorage (if IndexedDB not available or had no data)
    try {
        const stored = localStorage.getItem('migraines');

        if (stored && !dataLoaded) {
            migraines = JSON.parse(stored);
        }

        const active = localStorage.getItem('activeMigraine');
        if (active) {
            activeMigraine = JSON.parse(active);
            // Validate active migraine
            if (!validateActiveMigraine(activeMigraine)) {
                console.warn('[WARNING] Invalid active migraine found in localStorage, clearing...');
                activeMigraine = null;
                localStorage.removeItem('activeMigraine');
            }
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
}

async function saveData() {
    // Encrypted mode: write the whole vault as one ciphertext blob and
    // skip the plaintext IndexedDB/localStorage writes entirely.
    if (encEnabled()) {
        if (!await persistVault()) throw new Error("Encrypted record could not be saved");
        return;
    }

    let savedToIndexedDB = false;
    // Save to IndexedDB if available
    if (useIndexedDB && db) {
        try {
            // Reconcile deletions: any stored record whose id is no
            // longer in the in-memory array has been hard-deleted
            // (permanent delete, empty trash, purge, clear all) and
            // must be removed from IndexedDB too, otherwise it
            // resurrects on next load.
            const keepIds = new Set(migraines.map(m => m.id));
            const storedKeys = await IDB.getAllKeys(DB_STORES.MIGRAINES);
            for (const key of storedKeys) {
                if (!keepIds.has(key)) {
                    await IDB.delete(DB_STORES.MIGRAINES, key);
                }
            }

            // Save all migraines
            for (const migraine of migraines) {
                await IDB.put(DB_STORES.MIGRAINES, migraine);
            }

            // Save active migraine
            if (activeMigraine) {
                await IDB.put(DB_STORES.SETTINGS, {
                    key: 'activeMigraine',
                    value: activeMigraine
                });
            } else {
                await IDB.delete(DB_STORES.SETTINGS, 'activeMigraine');
            }
            savedToIndexedDB = true;
        } catch (error) {
            console.error('[ERROR] Error saving to IndexedDB:', error);
        }
    }

    // The mirror is a fallback, not an additional requirement for success.
    try {
        localStorage.setItem('migraines', JSON.stringify(migraines));
        if (activeMigraine) localStorage.setItem('activeMigraine', JSON.stringify(activeMigraine));
        else localStorage.removeItem('activeMigraine');
    } catch (error) {
        if (!savedToIndexedDB) throw error;
        console.warn('Local backup unavailable; records saved in IndexedDB.');
    }
}

// ============================================
// MEDICATION LIBRARY SYSTEM
// ============================================

function initializeMedicationLibrary() {
    // Load user-added medications (skipped when encrypted — the vault
    // already populated userMedications on unlock)
    if (!encEnabled()) {
        const stored = localStorage.getItem('userMedications');
        if (stored) {
            userMedications = JSON.parse(stored);
        }
    }

    // Pre-populated medication library (common migraine medications)
    medicationLibrary = [
        // Triptans (Abortive)
        { name: "Sumatriptan", type: "abortive", category: "triptan", dosages: ["25mg", "50mg", "100mg"], forms: ["tablet", "nasal spray", "injection"] },
        { name: "Rizatriptan", type: "abortive", category: "triptan", dosages: ["5mg", "10mg"], forms: ["tablet", "disintegrating tablet"] },
        { name: "Eletriptan", type: "abortive", category: "triptan", dosages: ["20mg", "40mg"], forms: ["tablet"] },
        { name: "Zolmitriptan", type: "abortive", category: "triptan", dosages: ["2.5mg", "5mg"], forms: ["tablet", "nasal spray"] },
        { name: "Almotriptan", type: "abortive", category: "triptan", dosages: ["6.25mg", "12.5mg"], forms: ["tablet"] },
        { name: "Naratriptan", type: "abortive", category: "triptan", dosages: ["1mg", "2.5mg"], forms: ["tablet"] },

        // NSAIDs (Abortive)
        { name: "Ibuprofen", type: "abortive", category: "nsaid", dosages: ["200mg", "400mg", "600mg", "800mg"], forms: ["tablet", "liquid gel"] },
        { name: "Naproxen", type: "abortive", category: "nsaid", dosages: ["220mg", "375mg", "500mg"], forms: ["tablet"] },
        { name: "Aspirin", type: "abortive", category: "nsaid", dosages: ["325mg", "500mg", "650mg"], forms: ["tablet"] },
        { name: "Diclofenac", type: "abortive", category: "nsaid", dosages: ["50mg", "75mg"], forms: ["tablet"] },
        { name: "Indomethacin", type: "abortive", category: "nsaid", dosages: ["25mg", "50mg"], forms: ["capsule"] },

        // Combination Drugs (Abortive)
        { name: "Excedrin Migraine", type: "abortive", category: "combination", dosages: ["2 tablets"], forms: ["tablet"] },
        { name: "Fioricet", type: "abortive", category: "combination", dosages: ["1-2 tablets"], forms: ["tablet"] },
        { name: "Treximet", type: "abortive", category: "combination", dosages: ["85mg/500mg"], forms: ["tablet"] },

        // CGRP Antagonists (Abortive)
        { name: "Ubrogepant", type: "abortive", category: "cgrp", dosages: ["50mg", "100mg"], forms: ["tablet"] },
        { name: "Rimegepant", type: "abortive", category: "cgrp", dosages: ["75mg"], forms: ["disintegrating tablet"] },

        // Preventive - Beta Blockers
        { name: "Propranolol", type: "preventive", category: "beta-blocker", dosages: ["40mg", "80mg", "120mg"], forms: ["tablet", "extended release"] },
        { name: "Metoprolol", type: "preventive", category: "beta-blocker", dosages: ["25mg", "50mg", "100mg"], forms: ["tablet"] },
        { name: "Timolol", type: "preventive", category: "beta-blocker", dosages: ["10mg", "20mg"], forms: ["tablet"] },

        // Preventive - Antidepressants
        { name: "Amitriptyline", type: "preventive", category: "antidepressant", dosages: ["10mg", "25mg", "50mg", "75mg"], forms: ["tablet"] },
        { name: "Venlafaxine", type: "preventive", category: "antidepressant", dosages: ["37.5mg", "75mg", "150mg"], forms: ["capsule"] },
        { name: "Duloxetine", type: "preventive", category: "antidepressant", dosages: ["30mg", "60mg"], forms: ["capsule"] },

        // Preventive - Anticonvulsants
        { name: "Topiramate", type: "preventive", category: "anticonvulsant", dosages: ["25mg", "50mg", "100mg"], forms: ["tablet"] },
        { name: "Valproate", type: "preventive", category: "anticonvulsant", dosages: ["250mg", "500mg"], forms: ["tablet"] },

        // Preventive - CGRP Monoclonal Antibodies
        { name: "Erenumab (Aimovig)", type: "preventive", category: "cgrp-mab", dosages: ["70mg", "140mg"], forms: ["injection"] },
        { name: "Fremanezumab (Ajovy)", type: "preventive", category: "cgrp-mab", dosages: ["225mg"], forms: ["injection"] },
        { name: "Galcanezumab (Emgality)", type: "preventive", category: "cgrp-mab", dosages: ["120mg"], forms: ["injection"] },

        // Other
        { name: "Acetaminophen", type: "abortive", category: "other", dosages: ["325mg", "500mg", "650mg"], forms: ["tablet", "liquid"] },
        { name: "Caffeine", type: "abortive", category: "other", dosages: ["100mg", "200mg"], forms: ["tablet", "liquid"] },
        { name: "Magnesium", type: "preventive", category: "supplement", dosages: ["400mg", "500mg"], forms: ["tablet", "capsule"] },
        { name: "Riboflavin (B2)", type: "preventive", category: "supplement", dosages: ["400mg"], forms: ["tablet"] },
        { name: "CoQ10", type: "preventive", category: "supplement", dosages: ["100mg", "300mg"], forms: ["capsule"] }
    ];

    // Combine with user medications
    medicationLibrary = [...medicationLibrary, ...userMedications];
}

function saveMedicationLibrary() {
    if (encEnabled()) { persistVault(); return; }
    localStorage.setItem('userMedications', JSON.stringify(userMedications));
}

function showAddMedicationModal(context) {
    if (context) medicationPickerContext = context;
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');

    body.innerHTML = `
        <div class="form-group">
            <label for="med-search">Search Medication</label>
            <input type="text" id="med-search" placeholder="Type to search..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); font-size: 1rem;" autofocus>
        </div>

        <div id="med-search-results" style="max-height: 300px; overflow-y: auto; margin-bottom: 16px;">
            <p style="color: var(--text-secondary); text-align: center; padding: 20px;">Type to search medications...</p>
        </div>

        <div style="border-top: 1px solid var(--border-color); padding-top: 16px;">
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 8px;">Or enter custom medication:</p>
            <input type="text" id="custom-med-name" placeholder="Medication name" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); margin-bottom: 8px;">
            <button class="btn btn-secondary" id="add-custom-med-btn" style="width: 100%;">Add Custom Medication</button>
        </div>
    `;

    document.getElementById('modal-actions').innerHTML = `
        <button class="btn btn-secondary" id="med-picker-cancel">Cancel</button>
    `;

    document.getElementById('modal-title').textContent = 'Add Medication';
    openDialog(modal);

    // Callers editing a longer form (the episode-edit modal) pass
    // onDone so Cancel returns to that form instead of closing
    // everything and discarding unrelated in-progress edits.
    document.getElementById('med-picker-cancel').addEventListener('click', () => {
        if (medicationPickerContext.onDone) medicationPickerContext.onDone();
        else closeModal();
    });

    // Search functionality
    const searchInput = document.getElementById('med-search');
    searchInput.addEventListener('input', (e) => {
        searchMedications(e.target.value);
    });

    // Custom medication
    document.getElementById('add-custom-med-btn').addEventListener('click', () => {
        const customName = document.getElementById('custom-med-name').value.trim();
        if (customName) {
            addMedicationToEpisode({ name: customName, custom: true });
        }
    });
}

function searchMedications(query) {
    const resultsDiv = document.getElementById('med-search-results');

    // Delegated click handler (attached once) - no inline onclick
    if (!resultsDiv.dataset.delegated) {
        resultsDiv.addEventListener('click', (e) => {
            const item = e.target.closest('[data-med-name]');
            if (item) {
                selectMedication(item.dataset.medName);
            }
        });
        resultsDiv.dataset.delegated = '1';
    }

    if (!query || query.length < 2) {
        resultsDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Type at least 2 characters...</p>';
        return;
    }

    const matches = medicationLibrary.filter(med =>
        med.name.toLowerCase().includes(query.toLowerCase())
    );

    if (matches.length === 0) {
        resultsDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No medications found. Try adding a custom medication below.</p>';
        return;
    }

    resultsDiv.innerHTML = safeHTML(matches.slice(0, 10).map(med => `
        <div class="med-result-item" data-med-name="${safeText(med.name)}" style="padding: 12px; margin-bottom: 8px; background: var(--bg-tertiary); border-radius: 8px; cursor: pointer; border: 1px solid var(--border-color);">
            <div style="font-weight: 600;">${safeText(med.name)}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
                ${med.type === 'abortive' ? 'Abortive' : 'Preventive'} • ${safeText(med.category)}
            </div>
        </div>
    `).join(''));
}

function selectMedication(medName) {
    const med = medicationLibrary.find(m => m.name === medName);
    if (!med) return;

    // Show dosage/form selection modal
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');

    body.innerHTML = safeHTML(`
        <h3 style="margin-bottom: 16px;">${safeText(med.name)}</h3>

        <div class="form-group">
            <label for="med-dosage">Dosage</label>
            <select id="med-dosage" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
                ${med.dosages ? med.dosages.map(d => `<option value="${safeText(d)}">${safeText(d)}</option>`).join('') : '<option value="">Not specified</option>'}
                <option value="custom">Custom...</option>
            </select>
            <input type="text" id="custom-dosage" placeholder="Enter custom dosage" style="width: 100%; padding: 10px; margin-top: 8px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); display: none;">
        </div>

        <div class="form-group">
            <label for="med-form">Form</label>
            <select id="med-form" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
                ${med.forms ? med.forms.map(f => `<option value="${safeText(f)}">${safeText(f)}</option>`).join('') : '<option value="tablet">Tablet</option>'}
            </select>
        </div>
    `);

    document.getElementById('modal-actions').innerHTML = `
        <button class="btn btn-secondary" onclick="showAddMedicationModal()">Back</button>
        <button class="btn btn-primary" id="confirm-add-med">Add to Episode</button>
    `;

    // Show custom dosage input if selected
    document.getElementById('med-dosage').addEventListener('change', (e) => {
        const customInput = document.getElementById('custom-dosage');
        customInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });

    document.getElementById('confirm-add-med').addEventListener('click', () => {
        const dosageSelect = document.getElementById('med-dosage');
        let dosage = dosageSelect.value;
        if (dosage === 'custom') {
            dosage = document.getElementById('custom-dosage').value.trim();
        }
        const form = document.getElementById('med-form').value;

        addMedicationToEpisode({
            name: med.name,
            dosage: dosage,
            formulation: form,
            type: med.type,
            category: med.category
        });
    });
}

function addMedicationToEpisode(medData) {
    const medication = {
        name: medData.name,
        dosage: medData.dosage || null,
        formulation: medData.formulation || null,
        type: medData.type || null,
        category: medData.category || null,
        timeTaken: new Date().toISOString()
    };

    medicationPickerContext.getList().push(medication);
    // onDone (the edit-episode modal) fully rebuilds its own form,
    // which recreates the medications list container along with
    // everything else, so redrawing it here first would be wasted
    // work on a node that's about to be discarded.
    if (medicationPickerContext.onDone) {
        medicationPickerContext.onDone();
    } else {
        renderMedicationsList();
        closeModal();
    }
    if (medicationPickerContext.onChange) medicationPickerContext.onChange();
}

function removeMedicationFromEpisode(index) {
    medicationPickerContext.getList().splice(index, 1);
    renderMedicationsList();
    if (medicationPickerContext.onChange) medicationPickerContext.onChange();
}

function renderMedicationsList() {
    const listDiv = document.getElementById(medicationPickerContext.containerId);
    if (!listDiv) return;
    const list = medicationPickerContext.getList();

    // Delegated click handler (attached once) - no inline onclick
    if (!listDiv.dataset.delegated) {
        listDiv.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-med-index]');
            if (btn) {
                removeMedicationFromEpisode(Number(btn.dataset.medIndex));
            }
        });
        listDiv.dataset.delegated = '1';
    }

    if (list.length === 0) {
        listDiv.innerHTML = '';
        return;
    }

    listDiv.innerHTML = safeHTML(list.map((med, index) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px; border-left: 3px solid var(--accent-blue);">
            <div>
                <div style="font-weight: 600;">${safeText(med.name)}${med.dosage ? ` ${safeText(med.dosage)}` : ''}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                    ${safeText(med.formulation || 'Not specified')} • ${new Date(med.timeTaken).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
            </div>
            <button data-med-index="${index}" class="btn-inline danger">Remove</button>
        </div>
    `).join(''));
}

function showMedicationEffectivenessModal(completedMigraine) {
    // Check if migraine has medications to rate
    if (!completedMigraine.medications || completedMigraine.medications.length === 0) {
        return false; // No medications to rate
    }

    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');

    let currentMedIndex = 0;
    const medications = completedMigraine.medications;

    function showMedicationRating(index) {
        if (index >= medications.length) {
            // All medications rated, save and close
            saveData();
            closeModal();
            showModal('Episode Ended', 'Your migraine episode and medication effectiveness have been saved.');
            return;
        }

        const med = medications[index];

        document.getElementById('modal-title').textContent = 'Rate Medication Effectiveness';
        body.innerHTML = `
            <p style="margin-bottom: 20px; color: var(--text-secondary);">
                Medication ${index + 1} of ${medications.length}
            </p>

            <h3 style="margin-bottom: 24px;">${med.name}${med.dosage ? ' ' + med.dosage : ''}</h3>

            <div class="form-group">
                <label>How effective was this medication?</label>
                <div id="effectiveness-stars" style="display: flex; gap: 8px; font-size: 2rem; margin-top: 8px;">
                    ${[1, 2, 3, 4, 5].map(star => `
                        <span class="star-rating" data-rating="${star}" style="cursor: pointer; color: var(--text-tertiary);">⭐</span>
                    `).join('')}
                </div>
                <div id="effectiveness-label" style="margin-top: 8px; color: var(--text-secondary); font-size: 0.9rem; min-height: 20px;"></div>
            </div>

            <div class="form-group" style="margin-top: 24px;">
                <label for="time-to-relief">Time to relief (optional)</label>
                <select id="time-to-relief" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
                    <option value="">Not sure / No relief</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="240">4 hours</option>
                    <option value="480">8+ hours</option>
                </select>
            </div>

            <div class="form-group" style="margin-top: 24px;">
                <label>Any side effects? (optional)</label>
                <div id="side-effects" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" value="nausea" style="width: 18px; height: 18px;">
                        <span>Nausea</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" value="dizziness" style="width: 18px; height: 18px;">
                        <span>Dizziness</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" value="drowsiness" style="width: 18px; height: 18px;">
                        <span>Drowsiness</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" value="fatigue" style="width: 18px; height: 18px;">
                        <span>Fatigue</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" value="chest-tightness" style="width: 18px; height: 18px;">
                        <span>Chest Tightness</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" value="dry-mouth" style="width: 18px; height: 18px;">
                        <span>Dry Mouth</span>
                    </label>
                </div>
            </div>
        `;

        document.getElementById('modal-actions').innerHTML = `
            <button class="btn btn-secondary" id="skip-rating">Skip</button>
            <button class="btn btn-primary" id="save-rating" disabled>Save & ${index < medications.length - 1 ? 'Next' : 'Finish'}</button>
        `;

        // Star rating interaction
        let selectedRating = 0;
        const stars = document.querySelectorAll('.star-rating');
        const label = document.getElementById('effectiveness-label');
        const saveBtn = document.getElementById('save-rating');

        const ratingLabels = {
            1: '⭐ No relief',
            2: '⭐⭐ Slight relief',
            3: '⭐⭐⭐ Moderate relief',
            4: '⭐⭐⭐⭐ Good relief',
            5: '⭐⭐⭐⭐⭐ Complete relief'
        };

        stars.forEach(star => {
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.dataset.rating);

                // Update star colors
                stars.forEach(s => {
                    const rating = parseInt(s.dataset.rating);
                    s.style.color = rating <= selectedRating ? 'var(--accent-gold)' : 'var(--text-tertiary)';
                });

                // Update label
                label.textContent = ratingLabels[selectedRating];
                saveBtn.disabled = false;
            });

            // Hover effect
            star.addEventListener('mouseenter', () => {
                const rating = parseInt(star.dataset.rating);
                stars.forEach(s => {
                    const r = parseInt(s.dataset.rating);
                    s.style.color = r <= rating ? 'var(--accent-gold)' : 'var(--text-tertiary)';
                });
            });
        });

        document.getElementById('effectiveness-stars').addEventListener('mouseleave', () => {
            // Restore selected rating
            stars.forEach(s => {
                const rating = parseInt(s.dataset.rating);
                s.style.color = rating <= selectedRating ? 'var(--accent-gold)' : 'var(--text-tertiary)';
            });
        });

        // Skip button
        document.getElementById('skip-rating').addEventListener('click', () => {
            currentMedIndex++;
            showMedicationRating(currentMedIndex);
        });

        // Save button
        document.getElementById('save-rating').addEventListener('click', () => {
            const timeToRelief = document.getElementById('time-to-relief').value;
            const sideEffects = Array.from(document.querySelectorAll('#side-effects input:checked'))
                .map(cb => cb.value);

            // Save effectiveness data to medication
            medications[index].effectiveness = selectedRating;
            if (timeToRelief) {
                medications[index].timeToRelief = parseInt(timeToRelief);
            }
            if (sideEffects.length > 0) {
                medications[index].sideEffects = sideEffects;
            }

            currentMedIndex++;
            showMedicationRating(currentMedIndex);
        });
    }

    // Start rating the first medication
    openDialog(modal);
    showMedicationRating(0);

    return true; // Indicates effectiveness modal was shown
}

// Themes the picker offers. Anything else in storage (notably the
// retired 'light' theme) is migrated to its closest surviving match so
// it can't leave the app on a data-theme with no token block behind it.
const VALID_THEMES = new Set(['warm-dark', 'warm-light', 'high-contrast']);
const THEME_MIGRATIONS = { light: 'warm-light', dark: 'warm-dark' };

function normalizeTheme(theme) {
    if (VALID_THEMES.has(theme)) return theme;
    return THEME_MIGRATIONS[theme] || 'warm-dark';
}

function initializeTheme() {
    const storedTheme = localStorage.getItem('theme') || 'warm-dark';
    const savedTheme = normalizeTheme(storedTheme);
    if (savedTheme !== storedTheme) {
        localStorage.setItem('theme', savedTheme);
    }
    applyTheme(savedTheme);

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === savedTheme) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            applyTheme(theme);
            localStorage.setItem('theme', theme);

            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function initializeNavigation() {
    document.querySelectorAll('[data-destination]').forEach(button => {
        button.addEventListener('click', () => showPage(button.dataset.destination));
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            showPage(page);
        });
    });

    const carePdf = document.getElementById('care-export-pdf-btn');
    const careCsv = document.getElementById('care-export-csv-btn');

    if (carePdf) {
        carePdf.addEventListener('click', () => {
            const exportBtn = document.getElementById('export-pdf-btn');
            if (exportBtn) exportBtn.click();
        });
    }

    if (careCsv) {
        careCsv.addEventListener('click', () => {
            const exportBtn = document.getElementById('export-csv-btn');
            if (exportBtn) exportBtn.click();
        });
    }

    document.getElementById('take-midas-btn')?.addEventListener('click', openMidasModal);
    document.getElementById('take-hit6-btn')?.addEventListener('click', openHit6Modal);
}

function showPage(pageName) {
    if (!document.getElementById(`${pageName}-page`)) return;
    currentPage = pageName;

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${pageName}-page`).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        const destination = ['analytics', 'care', 'settings'].includes(pageName) ? 'more' : pageName;
        const isCurrent = btn.dataset.page === destination;
        btn.classList.toggle('active', isCurrent);
        // Colour alone doesn't tell a screen reader (or a colour-blind
        // user) which tab they're on.
        if (isCurrent) {
            btn.setAttribute('aria-current', 'page');
        } else {
            btn.removeAttribute('aria-current');
        }
    });

    // Each page is its own view, so start it at the top. Without this,
    // switching from the bottom of a long History list landed you
    // partway down Insights.
    window.scrollTo(0, 0);
    document.querySelector(`#${pageName}-page h1`)?.setAttribute('tabindex', '-1');
    document.querySelector(`#${pageName}-page h1`)?.focus({ preventScroll: true });

    if (pageName === 'history') {
        updateDashboard();
        renderCalendar();
        renderHistory();
    } else if (pageName === 'settings') {
        updateStorageInfo();
        // Set up UI for settings-specific features when page is shown
        // Use retry mechanism to ensure elements are ready
        retryUntilSuccess(
            setupWeatherUI,
            () => {
                const enableToggle = document.getElementById('weather-tracking-enabled');
                const weatherSettings = document.getElementById('weather-settings');
                return !!(enableToggle && weatherSettings);
            }
        );
        retryUntilSuccess(
            setupNotificationUI,
            () => {
                const statusText = document.getElementById('notification-status-text');
                const enableSection = document.getElementById('notification-enable-section');
                return !!(statusText && enableSection);
            }
        );
        initializePhase1Settings();
        initializeDebugMode();
    } else if (pageName === 'log') {
        // Log page contains both the dashboard and the calendar
        // Use retry mechanism to ensure elements are ready
        retryUntilSuccess(
            updateDashboard,
            () => {
                const totalElem = document.getElementById('total-episodes');
                const avgPainElem = document.getElementById('avg-pain');
                return !!(totalElem && avgPainElem);
            }
        );

        retryUntilSuccess(
            renderCalendar,
            () => {
                const currentMonthElem = document.getElementById('current-month');
                const calendarGridElem = document.getElementById('calendar-grid');
                return !!(currentMonthElem && calendarGridElem);
            }
        );

        updateLogWeatherDisplay();
    } else if (pageName === 'analytics') {
        initializeAnalytics();
    } else if (pageName === 'care') {
        updateDashboard();
        renderAssessments();
    }
}

function initializeHistory() {}

function renderHistory() {
    const list = document.getElementById('history-list');
    const activeMigraines = getActiveMigraines();

    // Delegated click handler (attached once) - no inline onclick
    if (!list.dataset.delegated) {
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action][data-id]');
            if (!btn) return;
            const raw = btn.dataset.id;
            const id = isNaN(Number(raw)) ? raw : Number(raw);
            if (btn.dataset.action === 'view') viewEpisode(id);
            else if (btn.dataset.action === 'edit') editEpisode(id);
            else if (btn.dataset.action === 'delete') deleteEpisode(id);
        });
        list.dataset.delegated = '1';
    }

    if (activeMigraines.length === 0) {
        list.innerHTML = `
            <div class="section-card" style="text-align: center; padding: 40px;">
                <div style="display: flex; justify-content: center; margin-bottom: 16px;">
                    <svg class="icon" style="width: 48px; height: 48px; stroke: var(--text-secondary);" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                </div>
                <h2>No Episodes Yet</h2>
                <p style="color: var(--text-secondary); margin-top: 12px;">
                    Your migraine history will appear here after you log your first episode.
                </p>
            </div>
        `;
        return;
    }

    const sorted = [...activeMigraines].reverse();

    list.innerHTML = safeHTML(sorted.map(m => {
        const start = new Date(m.startTime);
        const painProgress = getPainProgression(m);

        return `
            <div class="history-item">
                <div class="history-header">
                    <div>
                        <div class="history-date">${formatDate(start)}</div>
                        <div class="history-time">${formatTime(start)}</div>
                    </div>
                </div>
                <div class="history-details">
                    <div class="history-detail">
                        <span class="detail-label">Pain</span>
                        <span class="detail-value">${safeText(painProgress)}</span>
                    </div>
                    <div class="history-detail">
                        <span class="detail-label">Duration</span>
                        <span class="detail-value">${formatDuration(m.duration)}</span>
                    </div>
                    <div class="history-detail">
                        <span class="detail-label">Category</span>
                        <span class="detail-value">${safeText(m.category)}</span>
                    </div>
                </div>
                ${headZoneLabels(m.painLocations).length > 0 ? `<p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 8px;"><strong>Location:</strong> ${safeText(headZoneLabels(m.painLocations).join(', '))}${deriveLaterality(m.painLocations) ? ` (${deriveLaterality(m.painLocations)})` : ''}</p>` : ''}
                ${qualityLabels(m.painQuality).length > 0 ? `<p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 8px;"><strong>Quality:</strong> ${safeText(qualityLabels(m.painQuality).join(', '))}</p>` : ''}
                ${prodromeLabels(m.prodrome).length > 0 ? `<p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 8px;"><strong>Warning signs:</strong> ${safeText(prodromeLabels(m.prodrome).join(', '))}</p>` : ''}
                ${symptomLabels(m.symptoms).length > 0 ? `<p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 8px;"><strong>Symptoms:</strong> ${safeText(symptomLabels(m.symptoms).join(', '))}</p>` : ''}
                ${triggerLabels(m.triggers).length > 0 ? `<p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 8px;"><strong>Triggers:</strong> ${safeText(triggerLabels(m.triggers).join(', '))}</p>` : ''}
                ${postdromeLabels(m.postdrome).length > 0 ? `<p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 8px;"><strong>After-effects:</strong> ${safeText(postdromeLabels(m.postdrome).join(', '))}</p>` : ''}
                ${m.notes ? `<p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 8px;">${safeText(m.notes)}</p>` : ''}
                <div class="history-actions">
                    <button class="btn btn-secondary" data-action="view" data-id="${safeText(String(m.id))}">View Details</button>
                    <button class="btn btn-secondary" data-action="edit" data-id="${safeText(String(m.id))}">Edit</button>
                    <button class="btn btn-secondary" data-action="delete" data-id="${safeText(String(m.id))}">Delete</button>
                </div>
            </div>
        `;
    }).join(''));
}

function viewEpisode(id) {
    const migraine = migraines.find(m => m.id === id);
    if (!migraine) return;

    const start = new Date(migraine.startTime);
    const end = migraine.endTime ? new Date(migraine.endTime) : null;

    let content = `
        <p><strong>Started:</strong> ${formatDate(start)} at ${formatTime(start)}</p>
        ${end ? `<p><strong>Ended:</strong> ${formatDate(end)} at ${formatTime(end)}</p>` : ''}
        <p><strong>Duration:</strong> ${formatDuration(migraine.duration)}</p>
        <p><strong>Pain Level:</strong> ${migraine.painLevel}/10 (${safeText(migraine.category)})</p>
        ${migraine.medication ? `<p><strong>Medication:</strong> ${safeText(migraine.medication)}</p>` : ''}
    `;

    if (migraine.painHistory && migraine.painHistory.length > 1) {
        content += `<h3>Pain Progression</h3><ul>`;
        migraine.painHistory.forEach(p => {
            content += `<li>${formatTime(new Date(p.timestamp))}: ${p.level}/10</li>`;
        });
        content += `</ul>`;
    }

    // Pain location — read-only head map painted after the modal opens
    // (the map's <svg> can't pass through showModal's safeHTML)
    const viewLocations = headZoneLabels(migraine.painLocations);
    if (viewLocations.length > 0) {
        const lat = deriveLaterality(migraine.painLocations);
        content += `<h3>Pain Location${lat ? ` (${lat})` : ''}</h3>`;
        content += `<div id="view-head-map"></div>`;
        content += `<p style="color: var(--text-secondary); font-size: 0.9rem;">${safeText(viewLocations.join(', '))}</p>`;
    }

    const viewQuality = qualityLabels(migraine.painQuality);
    if (viewQuality.length > 0) {
        content += `<h3>Pain Quality</h3><p>${safeText(viewQuality.join(', '))}</p>`;
    }

    const viewProdrome = prodromeLabels(migraine.prodrome);
    if (viewProdrome.length > 0) {
        content += `<h3>Warning signs (prodrome)</h3><ul>`;
        viewProdrome.forEach(label => {
            content += `<li>${safeText(label)}</li>`;
        });
        content += `</ul>`;
    }

    const viewSymptoms = symptomLabels(migraine.symptoms);
    if (viewSymptoms.length > 0) {
        content += `<h3>Symptoms</h3><ul>`;
        viewSymptoms.forEach(label => {
            content += `<li>${safeText(label)}</li>`;
        });
        content += `</ul>`;
    }

    const viewTriggers = triggerLabels(migraine.triggers);
    if (viewTriggers.length > 0) {
        content += `<h3>Possible Triggers</h3><ul>`;
        viewTriggers.forEach(label => {
            content += `<li>${safeText(label)}</li>`;
        });
        content += `</ul>`;
    }

    const viewPostdrome = postdromeLabels(migraine.postdrome);
    if (viewPostdrome.length > 0) {
        content += `<h3>After-effects (postdrome)</h3><ul>`;
        viewPostdrome.forEach(label => {
            content += `<li>${safeText(label)}</li>`;
        });
        content += `</ul>`;
    }

    if (migraine.reliefMethods && migraine.reliefMethods.length > 0) {
        content += `<h3>Relief Methods</h3><ul>`;
        migraine.reliefMethods.forEach(r => {
            content += `<li>${formatTime(new Date(r.timestamp))}: ${safeText(r.method)}</li>`;
        });
        content += `</ul>`;
    }

    if (migraine.notes) {
        content += `<h3>Notes</h3><p>${safeText(migraine.notes)}</p>`;
    }

    if (migraine.endNotes) {
        content += `<h3>Resolution Notes</h3><p>${safeText(migraine.endNotes)}</p>`;
    }

    showModal('Episode Details', content);

    // Paint the read-only head map now that the placeholder exists
    if (viewLocations.length > 0) {
        renderHeadMap('view-head-map', new Set(migraine.painLocations), false);
    }
}

// Temporary storage for relief methods being edited
let tempReliefMethods = [];
// Structured medications being edited (mirrors currentEpisodeMedications
// in the quick-log form; the legacy `medication` string is derived from
// this on save rather than edited directly, so there's one source of
// truth instead of two fields that can disagree).
let tempEditMedications = [];
// Symptoms being edited (rebuilt each time an edit modal opens)
let tempEditSymptoms = new Set();
let tempEditTriggers = new Set();
let tempEditProdrome = new Set();
let tempEditPostdrome = new Set();
let tempEditPainLocations = new Set();
let tempEditQuality = new Set();

// The single edit surface for an episode, active or completed.
// Reachable from the calendar day-detail, the history list, the
// notification deep-link, and (once opened) the active-episode
// card's "Edit details" button -- all of them call this the same way.
function editEpisode(id) {
    // Find the episode to edit -- check the active one first, since
    // it won't be in `migraines` yet.
    let episode = migraines.find(m => m.id === id);
    const isActive = !!(activeMigraine && activeMigraine.id === id);
    if (isActive) episode = activeMigraine;

    if (!episode) {
        showToast('Episode not found.', { type: 'error' });
        return;
    }

    // If we were opened from another dialog (day-details, the active
    // card), close it first -- the modal system shows one at a time.
    closeModal();

    tempReliefMethods = episode.reliefMethods ? [...episode.reliefMethods] : [];
    tempEditMedications = episode.medications ? [...episode.medications] : [];
    tempEditSymptoms = new Set(Array.isArray(episode.symptoms)
        ? episode.symptoms.filter(k => SYMPTOM_KEYS.has(k)) : []);
    tempEditTriggers = new Set(Array.isArray(episode.triggers)
        ? episode.triggers.filter(k => TRIGGER_KEYS.has(k)) : []);
    tempEditProdrome = new Set(Array.isArray(episode.prodrome)
        ? episode.prodrome.filter(k => PRODROME_KEYS.has(k)) : []);
    tempEditPostdrome = new Set(Array.isArray(episode.postdrome)
        ? episode.postdrome.filter(k => POSTDROME_KEYS.has(k)) : []);
    tempEditPainLocations = new Set(Array.isArray(episode.painLocations)
        ? episode.painLocations.filter(k => HEAD_ZONE_KEYS.has(k)) : []);
    tempEditQuality = new Set(Array.isArray(episode.painQuality)
        ? episode.painQuality.filter(k => PAIN_QUALITY_KEYS.has(k)) : []);

    renderEditEpisodeForm(episode, isActive);
}

// Builds and wires the edit form. Also used to return to the form
// after the "Add Medication" sub-flow, passing the plain-input values
// the user had already typed so they aren't lost -- everything else
// (chips, head map, relief methods, medications) lives in the
// tempEdit* variables above and survives a rebuild automatically.
function renderEditEpisodeForm(episode, isActive, fieldOverrides) {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');

    const startDate = new Date(episode.startTime);
    const startDateStr = fieldOverrides ? fieldOverrides.startDate : startDate.toISOString().split('T')[0];
    const startTimeStr = fieldOverrides ? fieldOverrides.startTime : startDate.toTimeString().slice(0, 5);

    let endDateStr = '', endTimeStr = '';
    if (fieldOverrides) {
        endDateStr = fieldOverrides.endDate || '';
        endTimeStr = fieldOverrides.endTime || '';
    } else if (episode.endTime) {
        const endDate = new Date(episode.endTime);
        endDateStr = endDate.toISOString().split('T')[0];
        endTimeStr = endDate.toTimeString().slice(0, 5);
    }

    const painLevel = fieldOverrides ? fieldOverrides.painLevel : episode.painLevel;
    const notesVal = fieldOverrides ? fieldOverrides.notes : (episode.notes || '');
    const endNotesVal = fieldOverrides ? fieldOverrides.endNotes : (episode.endNotes || '');
    const isCompleted = episode.status === 'completed';

    body.innerHTML = `
        <div style="max-height: 60vh; overflow-y: auto;">
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Start Date &amp; Time</label>
                <div style="display: flex; gap: 10px;">
                    <input type="date" id="edit-start-date" value="${safeText(startDateStr)}" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
                    <input type="time" id="edit-start-time" value="${safeText(startTimeStr)}" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
                </div>
            </div>

            ${isCompleted ? `
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">End Date &amp; Time</label>
                <div style="display: flex; gap: 10px;">
                    <input type="date" id="edit-end-date" value="${safeText(endDateStr)}" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
                    <input type="time" id="edit-end-time" value="${safeText(endTimeStr)}" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
                </div>
            </div>
            ` : ''}

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Pain level${isCompleted ? '' : ' (optional)'}</label>
                <div class="pain-scale" style="display: grid; grid-template-columns: repeat(11, 1fr); gap: 8px;">
                    ${[0,1,2,3,4,5,6,7,8,9,10].map(i =>
                        `<button type="button" class="pain-btn ${painLevel === i ? 'selected' : ''}" data-pain="${i}" style="padding: 12px; border: 2px solid var(--border-color); border-radius: 8px; background: var(--bg-tertiary); color: var(--text-primary); cursor: pointer; font-size: 1.1rem; font-weight: 600;">${i}</button>`
                    ).join('')}
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Where is the pain? (optional)</label>
                <div id="edit-head-map"></div>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Pain quality (optional)</label>
                <div id="edit-quality-chips" class="chip-group"></div>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Medications (optional)</label>
                <div id="edit-medications-list" style="margin-bottom: 12px;"></div>
                <button type="button" id="edit-add-medication-btn" class="btn btn-secondary" style="width: 100%; padding: 10px;">+ Add Medication</button>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Warning signs before (prodrome, optional)</label>
                <div id="edit-prodrome-chips" class="chip-group"></div>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Symptoms (optional)</label>
                <div id="edit-symptom-chips" class="chip-group"></div>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Possible Triggers (optional)</label>
                <div id="edit-trigger-chips" class="chip-group"></div>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">After-effects (postdrome, optional)</label>
                <div id="edit-postdrome-chips" class="chip-group"></div>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label for="edit-notes" style="display: block; margin-bottom: 8px; font-weight: 600;">Notes (optional)</label>
                <textarea id="edit-notes" rows="4" placeholder="Add any notes about this episode..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); resize: vertical;">${safeText(notesVal)}</textarea>
            </div>

            ${isCompleted ? `
            <div class="form-group" style="margin-bottom: 20px;">
                <label for="edit-end-notes" style="display: block; margin-bottom: 8px; font-weight: 600;">Resolution Notes (optional)</label>
                <textarea id="edit-end-notes" rows="3" placeholder="How did it resolve? What helped?" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); resize: vertical;">${safeText(endNotesVal)}</textarea>
            </div>
            ` : ''}

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Relief Methods</label>
                <div id="edit-relief-methods-list" style="margin-bottom: 12px;"></div>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="new-relief-method" placeholder="Add relief method (e.g., Ice pack, Sumatriptan)" style="flex: 1; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 0.95rem;">
                    <button type="button" id="add-edit-relief-btn" class="btn btn-secondary" style="white-space: nowrap;">Add</button>
                </div>
            </div>

            <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px; border-left: 3px solid var(--accent-green); font-size: 0.9rem; color: var(--text-secondary);" id="edit-weather-note">
                Weather data will be preserved
            </div>
        </div>
    `;

    document.getElementById('modal-actions').innerHTML = `
        <button class="btn btn-secondary" id="edit-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="save-edit-btn">Save Changes</button>
    `;

    document.getElementById('modal-title').textContent = 'Edit Episode';
    openDialog(modal);

    renderHeadMap('edit-head-map', tempEditPainLocations);
    bindHeadMap('edit-head-map', tempEditPainLocations);
    renderQualityChips('edit-quality-chips', tempEditQuality);
    bindQualityChips('edit-quality-chips', tempEditQuality);
    renderProdromeChips('edit-prodrome-chips', tempEditProdrome);
    bindProdromeChips('edit-prodrome-chips', tempEditProdrome);
    renderSymptomChips('edit-symptom-chips', tempEditSymptoms);
    bindSymptomChips('edit-symptom-chips', tempEditSymptoms);
    renderTriggerChips('edit-trigger-chips', tempEditTriggers);
    bindTriggerChips('edit-trigger-chips', tempEditTriggers);
    renderPostdromeChips('edit-postdrome-chips', tempEditPostdrome);
    bindPostdromeChips('edit-postdrome-chips', tempEditPostdrome);
    renderEditReliefMethods();
    // No onDone here: removing a medication redraws #edit-medications-list
    // in place and never navigates away, so nothing to return to.
    medicationPickerContext = {
        containerId: 'edit-medications-list',
        getList: () => tempEditMedications
    };
    renderMedicationsList();

    body.querySelectorAll('.pain-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            body.querySelectorAll('.pain-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    document.getElementById('edit-add-medication-btn').addEventListener('click', () => {
        // Snapshot the plain fields *before* handing off to the
        // picker, which overwrites #modal-body -- reading them inside
        // onDone would be too late, since by then this form's inputs
        // no longer exist in the DOM.
        const snapshot = readEditEpisodeFieldValues();
        showAddMedicationModal({
            containerId: 'edit-medications-list',
            getList: () => tempEditMedications,
            onDone: () => renderEditEpisodeForm(episode, isActive, snapshot)
        });
    });

    document.getElementById('new-relief-method').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addEditReliefMethod();
    });
    document.getElementById('add-edit-relief-btn').addEventListener('click', addEditReliefMethod);

    document.getElementById('edit-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('save-edit-btn').addEventListener('click', () => {
        saveEpisodeEdit(episode, isActive);
    });

    // Only claim weather will be "preserved" when that's actually
    // true; update live as the date is edited rather than leaving a
    // static claim that goes stale the moment the field changes.
    const originalDateStr = new Date(episode.startTime).toISOString().split('T')[0];
    const updateWeatherNote = () => {
        const note = document.getElementById('edit-weather-note');
        const dateInput = document.getElementById('edit-start-date');
        if (!note || !dateInput) return;
        if (!episode.weather && !weatherData.enabled) {
            note.style.display = 'none';
            return;
        }
        if (dateInput.value === originalDateStr) {
            note.textContent = episode.weather ? 'Weather data will be preserved.' : 'No weather data was recorded for this episode.';
        } else if (weatherData.history.some(h => h.date === dateInput.value)) {
            note.textContent = "Weather data will be updated to match the new date.";
        } else {
            note.textContent = "No local weather data for the new date — this episode's weather will be cleared.";
        }
    };
    document.getElementById('edit-start-date').addEventListener('change', updateWeatherNote);
    updateWeatherNote();
}

// Snapshots the plain inputs (everything not already tracked in a
// tempEdit* variable) so they survive a form rebuild -- used when
// returning from the "Add Medication" sub-flow.
function readEditEpisodeFieldValues() {
    const selectedPainBtn = document.querySelector('#modal-body .pain-btn.selected');
    return {
        startDate: document.getElementById('edit-start-date')?.value,
        startTime: document.getElementById('edit-start-time')?.value,
        endDate: document.getElementById('edit-end-date')?.value,
        endTime: document.getElementById('edit-end-time')?.value,
        painLevel: selectedPainBtn ? parseInt(selectedPainBtn.dataset.pain) : null,
        notes: document.getElementById('edit-notes')?.value,
        endNotes: document.getElementById('edit-end-notes')?.value
    };
}

function renderEditReliefMethods() {
    const list = document.getElementById('edit-relief-methods-list');
    if (!list) return;

    // Delegated handlers (attached once) - no inline onclick/onchange
    if (!list.dataset.delegated) {
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-relief-index]');
            if (btn) {
                deleteEditReliefMethod(Number(btn.dataset.reliefIndex));
            }
        });
        list.addEventListener('change', (e) => {
            const input = e.target.closest('input[data-relief-index]');
            if (input) {
                updateEditReliefMethod(Number(input.dataset.reliefIndex), input.value);
            }
        });
        list.dataset.delegated = '1';
    }

    if (tempReliefMethods.length === 0) {
        list.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.9rem; padding: 8px; text-align: center;">No relief methods logged</div>';
        return;
    }

    list.innerHTML = safeHTML(tempReliefMethods.map((relief, index) => {
        const time = formatTime(new Date(relief.timestamp));
        return `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 6px;">
                <div style="font-size: 0.8rem; color: var(--text-secondary); min-width: 60px;">${time}</div>
                <input type="text" value="${safeText(relief.method)}" data-relief-index="${index}"
                       style="flex: 1; padding: 6px 10px; background: var(--bg-tertiary);
                              border: 1px solid var(--border-color); border-radius: 6px;
                              color: var(--text-primary); font-size: 0.9rem;">
                <button data-relief-index="${index}"
                        style="background: none; border: none; color: var(--text-secondary);
                               cursor: pointer; font-size: 1.1rem; padding: 4px 8px;"
                        title="Remove" aria-label="Remove relief method"><svg class="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
        `;
    }).join(''));
}

function addEditReliefMethod() {
    const input = document.getElementById('new-relief-method');
    const method = input.value.trim();

    if (!method) return;

    tempReliefMethods.push({
        method: method,
        timestamp: new Date().toISOString()
    });

    input.value = '';
    renderEditReliefMethods();
}

function updateEditReliefMethod(index, newValue) {
    if (tempReliefMethods[index]) {
        tempReliefMethods[index].method = newValue;
    }
}

function deleteEditReliefMethod(index) {
    tempReliefMethods.splice(index, 1);
    renderEditReliefMethods();
}

function saveEpisodeEdit(originalEpisode, isActive) {
    const startDate = document.getElementById('edit-start-date').value;
    const startTime = document.getElementById('edit-start-time').value;
    if (!startDate || !startTime) {
        showToast('Please provide a start date and time.', { type: 'error' });
        return;
    }
    const startDateTime = new Date(`${startDate}T${startTime}`);
    if (startDateTime > new Date()) {
        showToast('Start time cannot be in the future.', { type: 'error' });
        return;
    }

    // If the start date moved to a different day, the original
    // weather snapshot belongs to the wrong day now. Re-derive it
    // from local history for the new date, or drop it -- keeping the
    // old value would silently misattribute it in weather-correlation
    // analytics.
    const originalDateStr = new Date(originalEpisode.startTime).toISOString().split('T')[0];
    const newDateStr = startDateTime.toISOString().split('T')[0];
    const dateChanged = newDateStr !== originalDateStr;
    const weather = dateChanged ? deriveWeatherForDate(newDateStr) : originalEpisode.weather;

    const isCompleted = originalEpisode.status === 'completed';

    // Pain level is required for a completed episode (it's the one
    // fact every finished episode needs) but stays optional while
    // active, matching attack mode's "add details anytime" design --
    // editing the location or a symptom shouldn't be blocked on
    // picking a pain number first.
    const selectedPainBtn = document.querySelector('#modal-body .pain-btn.selected');
    if (isCompleted && !selectedPainBtn) {
        showToast('Please select a pain level.', { type: 'error' });
        return;
    }
    const painLevel = selectedPainBtn ? parseInt(selectedPainBtn.dataset.pain) : (originalEpisode.painLevel ?? null);

    let endDateTime = null, duration = null;
    if (isCompleted) {
        const endDate = document.getElementById('edit-end-date').value;
        const endTime = document.getElementById('edit-end-time').value;
        if (endDate && endTime) {
            endDateTime = new Date(`${endDate}T${endTime}`);
            if (endDateTime <= startDateTime) {
                showToast('End time must be after the start time.', { type: 'error' });
                return;
            }
            duration = Math.floor((endDateTime - startDateTime) / 1000);
        }
    }

    const notes = document.getElementById('edit-notes').value.trim();
    const endNotesEl = document.getElementById('edit-end-notes');
    const endNotes = endNotesEl ? endNotesEl.value.trim() : (originalEpisode.endNotes || '');

    const medications = tempEditMedications.length > 0 ? [...tempEditMedications] : null;

    const updatedEpisode = {
        ...originalEpisode,
        startTime: startDateTime.toISOString(),
        weather: weather,
        painLevel: painLevel,
        category: painLevel != null ? getPainCategory(painLevel) : null,
        medications: medications,
        // Kept for backwards compatibility; derived from the
        // structured list above rather than edited directly, so the
        // two can no longer disagree.
        medication: medications
            ? medications.map(m => `${m.name}${m.dosage ? ' ' + m.dosage : ''}`).join(', ')
            : null,
        notes: notes || null,
        endNotes: endNotes || null,
        reliefMethods: tempReliefMethods.length > 0 ? tempReliefMethods : null,
        symptoms: Array.from(tempEditSymptoms),
        triggers: Array.from(tempEditTriggers),
        prodrome: Array.from(tempEditProdrome),
        postdrome: Array.from(tempEditPostdrome),
        painLocations: Array.from(tempEditPainLocations),
        painQuality: Array.from(tempEditQuality),
        lastModified: new Date().toISOString(),
        editCount: (originalEpisode.editCount || 0) + 1
    };

    if (endDateTime) {
        updatedEpisode.endTime = endDateTime.toISOString();
        updatedEpisode.duration = duration;
    }

    if (isActive) {
        activeMigraine = updatedEpisode;
    } else {
        const index = migraines.findIndex(m => m.id === originalEpisode.id);
        if (index !== -1) migraines[index] = updatedEpisode;
    }

    saveData();
    updateDashboard();
    renderCalendar();
    renderHistory();
    if (isActive) updateActiveMigraineeDisplay();

    closeModal();
    showToast('Episode updated.');
}

function deleteEpisode(id) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = 'Delete Episode?';
    document.getElementById('modal-body').innerHTML = '<p>This episode will be moved to trash and can be recovered within 30 days.</p>';
    document.getElementById('modal-actions').innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="confirmDelete(${id})">Move to Trash</button>
    `;
    openDialog(modal);
}

function confirmDelete(id) {
    const migraine = migraines.find(m => m.id === id);
    if (migraine) {
        migraine.deleted = true;
        migraine.deletedAt = new Date().toISOString();
        saveData();
        renderHistory();
        updateDashboard();
        renderCalendar();
        closeModal();
        showModal('Moved to Trash', 'Episode moved to trash. You can restore it from Settings within 30 days.');
    }
}

function getActiveMigraines() {
    return migraines.filter(m => !m.deleted && !m.archived);
}

function getDeletedMigraines() {
    // Auto-purge episodes older than 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    return migraines.filter(m => {
        if (!m.deleted) return false;
        const deletedDate = new Date(m.deletedAt);
        return deletedDate >= thirtyDaysAgo;
    });
}

function purgeOldDeletedEpisodes() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const beforeCount = migraines.length;
    migraines = migraines.filter(m => {
        if (!m.deleted) return true;
        const deletedDate = new Date(m.deletedAt);
        return deletedDate >= thirtyDaysAgo;
    });

    const purgedCount = beforeCount - migraines.length;
    if (purgedCount > 0) {
        saveData();
    }
}

// Emergency function to restore ALL episodes, even those older than 30 days
async function emergencyRestoreAllEpisodes() {
    console.log('[DEBUG] Emergency restore initiated...');

    // Count deleted episodes before restore
    const deletedCount = migraines.filter(m => m.deleted).length;

    if (deletedCount === 0) {
        showToast('No deleted episodes found — everything is already active.');
        return;
    }

    const confirmed = await confirmAction(
        'Restore deleted episodes',
        `Found ${deletedCount} deleted episode${deletedCount === 1 ? '' : 's'}. This restores all of them, including any older than 30 days.`,
        { confirmText: 'Restore all' }
    );

    if (!confirmed) {
        return;
    }

    // Restore all deleted episodes
    let restoredCount = 0;
    migraines.forEach(m => {
        if (m.deleted) {
            m.deleted = false;
            delete m.deletedAt; // Remove the deletion timestamp
            restoredCount++;
        }
    });

    console.log(`[SUCCESS] Restored ${restoredCount} episode(s)`);

    // Save to database
    await saveData();

    // Update UI
    updateDashboard();
    renderHistory();
    renderCalendar();
    updateStorageInfo();

    // Update diagnostics
    const activeCount = getActiveMigraines().length;
    updateDiagnostics({
        episodesCount: `${migraines.length} total (${activeCount} active, 0 deleted)`,
        initStatus: ` Restored ${restoredCount} episodes!`
    });

    showToast(`Restored ${restoredCount} episode${restoredCount === 1 ? '' : 's'}. They're back in your history.`);

    // Optionally navigate to History page to show restored data
    if (restoredCount > 0) {
        showPage('history');
    }
}

function viewTrash() {
    const deletedMigraines = getDeletedMigraines();

    if (deletedMigraines.length === 0) {
        showModal('Trash Empty', '<p style="text-align: center;">No recently deleted episodes.</p>');
        return;
    }

    const now = new Date();

    let content = `
        <div style="margin-bottom: 20px;">
            <p style="text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
                Episodes are automatically deleted after 30 days.
            </p>
        </div>
    `;

    deletedMigraines
        .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))
        .forEach(m => {
            const deletedDate = new Date(m.deletedAt);
            const daysRemaining = Math.ceil(30 - (now - deletedDate) / (1000 * 60 * 60 * 24));
            const startDate = new Date(m.startTime);

            content += `
                <div style="margin-bottom: 16px; padding: 16px; background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid ${
                    m.category === 'Severe' ? 'var(--pain-severe)' :
                    m.category === 'Moderate' ? 'var(--pain-moderate)' :
                    'var(--pain-mild)'
                };">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <p style="font-weight: 600; margin-bottom: 4px;">${formatDate(startDate)}</p>
                            <p style="font-size: 0.9rem; color: var(--text-secondary);">
                                ${formatTime(startDate)} • ${m.category} (${m.painLevel}/10)
                            </p>
                        </div>
                        <span style="font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap;">
                            ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left
                        </span>
                    </div>
                    ${m.medication ? `<p style="font-size: 0.9rem; margin-bottom: 4px;">Medication: ${safeText(m.medication)}</p>` : ''}
                    ${m.notes ? `<p style="font-size: 0.9rem; margin-bottom: 4px;">Notes: ${safeText(m.notes)}</p>` : ''}
                    <div style="display: flex; gap: 8px; margin-top: 12px;">
                        <button class="btn btn-primary" style="flex: 1; padding: 8px;" onclick="restoreEpisode(${m.id})">
                            Restore
                        </button>
                        <button class="btn btn-danger" style="flex: 1; padding: 8px;" onclick="permanentlyDelete(${m.id})">
                            Delete Forever
                        </button>
                    </div>
                </div>
            `;
        });

    content += `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-color);">
            <button class="btn btn-danger" style="width: 100%;" onclick="emptyTrash()">
                Empty Trash (Delete All)
            </button>
        </div>
    `;

    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    const actions = document.getElementById('modal-actions');

    document.getElementById('modal-title').textContent = `Trash (${deletedMigraines.length})`;
    body.innerHTML = content;
    actions.innerHTML = '<button class="btn btn-secondary" onclick="closeModal()">Close</button>';
    openDialog(modal);
}

function restoreEpisode(id) {
    const migraine = migraines.find(m => m.id === id);
    if (migraine && migraine.deleted) {
        delete migraine.deleted;
        delete migraine.deletedAt;
        saveData();
        renderHistory();
        updateDashboard();
        renderCalendar();
        updateStorageInfo();
        viewTrash(); // Refresh trash view
        showModal('Episode Restored', 'The episode has been restored successfully.');
    }
}

function permanentlyDelete(id) {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    const actions = document.getElementById('modal-actions');

    body.innerHTML = `
        <p style="text-align: center;">Are you sure you want to permanently delete this episode?</p>
        <p style="text-align: center; color: var(--accent-red); font-weight: 600;">This action cannot be undone.</p>
    `;

    actions.innerHTML = `
        <button class="btn btn-secondary" onclick="viewTrash()">Cancel</button>
        <button class="btn btn-danger" onclick="confirmPermanentDelete(${id})">Delete Forever</button>
    `;

    document.getElementById('modal-title').textContent = 'Confirm Permanent Deletion';
}

function confirmPermanentDelete(id) {
    const index = migraines.findIndex(m => m.id === id);
    if (index !== -1) {
        migraines.splice(index, 1);
        saveData();
        updateStorageInfo();
        viewTrash(); // Refresh trash view
    }
}

function emptyTrash() {
    const deletedCount = getDeletedMigraines().length;

    if (deletedCount === 0) {
        showModal('Trash Empty', '<p style="text-align: center;">No episodes to delete.</p>');
        return;
    }

    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    const actions = document.getElementById('modal-actions');

    body.innerHTML = `
        <p style="text-align: center;">Are you sure you want to permanently delete all ${deletedCount} episode${deletedCount !== 1 ? 's' : ''} from trash?</p>
        <p style="text-align: center; color: var(--accent-red); font-weight: 600;">This action cannot be undone.</p>
    `;

    actions.innerHTML = `
        <button class="btn btn-secondary" onclick="viewTrash()">Cancel</button>
        <button class="btn btn-danger" onclick="confirmEmptyTrash()">Empty Trash</button>
    `;

    document.getElementById('modal-title').textContent = 'Empty Trash';
}

function confirmEmptyTrash() {
    migraines = migraines.filter(m => !m.deleted);
    saveData();
    renderHistory();
    updateDashboard();
    renderCalendar();
    updateStorageInfo();
    closeModal();
    showModal('Trash Emptied', 'All deleted episodes have been permanently removed.');
}

function initializeCalendar() {
    document.getElementById('prev-month').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar();
    });
}

// Helper function to get all calendar days a migraine spans
function getMigraineDays(migraine) {
    const days = [];
    const startDate = new Date(migraine.startTime);

    // Calculate end date
    let endDate;
    if (migraine.endTime) {
        endDate = new Date(migraine.endTime);
    } else if (migraine.duration) {
        // duration is stored in seconds
        endDate = new Date(startDate.getTime() + migraine.duration * 1000);
    } else {
        // If still active or no end time, just count the start day
        endDate = startDate;
    }

    // Get all days between start and end (inclusive)
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const finalDate = new Date(endDate);
    finalDate.setHours(0, 0, 0, 0);

    while (currentDate <= finalDate) {
        days.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
}

function updateMonthlyStats() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Get migraine days for current month
    const activeMigraines = getActiveMigraines();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

    // Count unique days with migraines (including multi-day attacks)
    const migraineDays = new Set();
    activeMigraines.forEach(m => {
        const days = getMigraineDays(m);
        days.forEach(day => {
            const dayDate = new Date(day + 'T00:00:00');
            if (dayDate >= monthStart && dayDate <= monthEnd) {
                migraineDays.add(day);
            }
        });
    });

    const currentMonthDays = migraineDays.size;

    // Get previous month's data for comparison
    const prevMonthStart = new Date(year, month - 1, 1);
    const prevMonthEnd = new Date(year, month, 0, 23, 59, 59);
    const prevMigraineDays = new Set();
    activeMigraines.forEach(m => {
        const days = getMigraineDays(m);
        days.forEach(day => {
            const dayDate = new Date(day + 'T00:00:00');
            if (dayDate >= prevMonthStart && dayDate <= prevMonthEnd) {
                prevMigraineDays.add(day);
            }
        });
    });

    const prevMonthDays = prevMigraineDays.size;
    const difference = currentMonthDays - prevMonthDays;

    // Update display - check if elements exist first
    const monthDaysEl = document.getElementById('current-month-days');
    if (!monthDaysEl) {
        console.warn('[WARNING] Monthly stats elements not found in DOM');
        return;
    }

    monthDaysEl.textContent = currentMonthDays;

    // Determine clinical status based on research thresholds.
    // With nothing logged this month there is no frequency to classify —
    // asserting "Low-Frequency" to someone who has recorded nothing
    // states a clinical finding the data doesn't support.
    let status, statusColor;
    if (migraines.filter(m => !m.deleted).length === 0) {
        status = 'No episodes logged yet';
        statusColor = 'var(--text-secondary)';
    } else if (currentMonthDays === 0) {
        status = 'None this month';
        statusColor = 'var(--accent-green)';
    } else if (currentMonthDays >= 15) {
        status = 'Chronic Migraine';
        statusColor = 'var(--pain-severe)';
    } else if (currentMonthDays >= 10) {
        status = 'High-Frequency';
        statusColor = 'var(--pain-moderate)';
    } else if (currentMonthDays >= 4) {
        status = 'Episodic Migraine';
        statusColor = 'var(--accent-blue)';
    } else {
        status = 'Low-Frequency';
        statusColor = 'var(--accent-green)';
    }

    const statusEl = document.getElementById('current-month-status');
    statusEl.textContent = status;
    statusEl.style.color = statusColor;

    // Update trend indicator (compact format)
    const trendEl = document.getElementById('month-trend');
    if (difference > 0) {
        trendEl.textContent = `(↑${difference})`;
        trendEl.className = 'stat-trend positive';
    } else if (difference < 0) {
        trendEl.textContent = `(↓${Math.abs(difference)})`;
        trendEl.className = 'stat-trend negative';
    } else if (prevMonthDays > 0) {
        trendEl.textContent = '(same)';
        trendEl.className = 'stat-trend neutral';
    } else {
        trendEl.textContent = '';
        trendEl.className = '';
    }
}

function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const currentMonthElem = document.getElementById('current-month');
    const calendarGridElem = document.getElementById('calendar-grid');

    if (!currentMonthElem || !calendarGridElem) {
        console.warn('[WARNING] Calendar elements not found in DOM');
        return;
    }

    currentMonthElem.textContent =
        new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Update monthly stats
    updateMonthlyStats();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // The column headers and the leading blanks are presentational: each
    // day button already announces its own weekday and date.
    let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d =>
        `<div class="calendar-day empty" style="font-weight: 600;" aria-hidden="true">${d}</div>`
    ).join('');

    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty" aria-hidden="true"></div>';
    }

    const activeMigraines = getActiveMigraines();

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];

        // Check if any attacks started on this day
        const dayMigraines = activeMigraines.filter(m => {
            const mDate = new Date(m.startTime).toISOString().split('T')[0];
            return mDate === dateStr;
        });

        // Check if any attacks are ongoing on this day (but started earlier)
        const continuationMigraines = activeMigraines.filter(m => {
            const startDate = new Date(m.startTime);
            const endDate = m.endTime ? new Date(m.endTime) : new Date();
            const currentDate = new Date(dateStr + 'T23:59:59'); // End of the day

            // Check if this day falls within the attack duration but is not the start day
            const mDate = new Date(m.startTime).toISOString().split('T')[0];
            return mDate !== dateStr && startDate < currentDate && endDate >= date;
        });

        let classes = 'calendar-day';

        // Priority: Start days get full color, continuation days get faded color
        if (dayMigraines.length > 0) {
            classes += ' has-episode';

            const maxStartingPain = Math.max(...dayMigraines.map(m => {
                if (m.painHistory && m.painHistory.length > 0) {
                    return m.painHistory[0].level;
                }
                return m.painLevel;
            }));

            if (maxStartingPain <= 3) classes += ' mild';
            else if (maxStartingPain <= 6) classes += ' moderate';
            else classes += ' severe';
        } else if (continuationMigraines.length > 0) {
            // This day is a continuation day (not the start day)
            const maxContinuationPain = Math.max(...continuationMigraines.map(m => {
                if (m.painHistory && m.painHistory.length > 0) {
                    return m.painHistory[0].level;
                }
                return m.painLevel;
            }));

            if (maxContinuationPain <= 3) classes += ' mild-continuation';
            else if (maxContinuationPain <= 6) classes += ' moderate-continuation';
            else classes += ' severe-continuation';
        }

        if (date.toDateString() === today.toDateString()) {
            classes += ' today';
        }

        if (activeMigraine) {
            const activeDate = new Date(activeMigraine.startTime).toISOString().split('T')[0];
            if (dateStr === activeDate) {
                classes += ' active-indicator';
            }
        }

        // Add pressure indicator if weather tracking enabled
        let pressureIndicator = '';
        if (weatherData.enabled && weatherData.history.length > 0) {
            const weatherEntry = weatherData.history.find(w => w.date.startsWith(dateStr));
            if (weatherEntry) {
                // Find previous day to calculate change
                const prevDate = new Date(date);
                prevDate.setDate(prevDate.getDate() - 1);
                const prevDateStr = prevDate.toISOString().split('T')[0];
                const prevEntry = weatherData.history.find(w => w.date.startsWith(prevDateStr));

                if (prevEntry) {
                    // Use dailyAvg or fallback to pressure for old data
                    const todayPressure = weatherEntry.dailyAvg || weatherEntry.pressure;
                    const yesterdayPressure = prevEntry.dailyAvg || prevEntry.pressure;

                    if (todayPressure && yesterdayPressure) {
                        const change = todayPressure - yesterdayPressure;
                        let icon = '→';
                        let color = 'var(--text-secondary)';

                        // Show rapid change indicator if available
                        // Updated threshold: 5+ hPa in 6h (research-validated)
                        if (weatherEntry.maxChange3h && weatherEntry.maxChange3h >= 5) {
                            icon = '!';
                            color = 'var(--accent-red)';
                        } else if (change > 5) {
                            icon = '↑';
                            color = 'var(--accent-green)';
                        } else if (change < -5) {
                            icon = '↓';
                            color = 'var(--pain-moderate)';
                        }

                        pressureIndicator = `<span class="pressure-indicator" style="color: ${color}">${icon}</span>`;
                    }
                }
            }
        }

        // A real button, so it is reachable and operable by keyboard and
        // announces what it will show rather than just a number.
        const dayLabel = date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
        const epCount = dayMigraines.length;
        const contCount = continuationMigraines.length;
        let stateText = 'no episodes logged';
        if (epCount > 0) {
            stateText = `${epCount} episode${epCount === 1 ? '' : 's'} started`;
        } else if (contCount > 0) {
            stateText = 'ongoing episode';
        }
        const ariaLabel = `${dayLabel} — ${stateText}`;

        html += `<button type="button" class="${classes}" data-day="${dateStr}" aria-label="${safeText(ariaLabel)}">
            <span aria-hidden="true">${day}</span>${pressureIndicator}
        </button>`;
    }

    calendarGridElem.innerHTML = html;

    // One delegated listener rather than an inline onclick per cell.
    if (!calendarGridElem.dataset.delegated) {
        calendarGridElem.dataset.delegated = 'true';
        calendarGridElem.addEventListener('click', (e) => {
            const cell = e.target.closest('[data-day]');
            if (cell) showDayDetails(cell.dataset.day);
        });
    }
}

function showDayDetails(dateStr) {
    const activeMigraines = getActiveMigraines();

    // Find attacks that started on this day
    const startedToday = activeMigraines.filter(m => {
        const mDate = new Date(m.startTime).toISOString().split('T')[0];
        return mDate === dateStr;
    });

    // Find attacks ongoing on this day (but started earlier)
    const ongoingToday = activeMigraines.filter(m => {
        const startDate = new Date(m.startTime);
        const endDate = m.endTime ? new Date(m.endTime) : new Date();
        const date = new Date(dateStr + 'T00:00:00');
        const currentDate = new Date(dateStr + 'T23:59:59');

        const mDate = new Date(m.startTime).toISOString().split('T')[0];
        return mDate !== dateStr && startDate < currentDate && endDate >= date;
    });

    const date = new Date(dateStr + 'T00:00:00');

    // Check for weather data on this day
    let weatherContent = '';
    if (weatherData.enabled && weatherData.history.length > 0) {
        const weatherEntry = weatherData.history.find(w => w.date.startsWith(dateStr));
        if (weatherEntry) {
            const prevDate = new Date(date);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = prevDate.toISOString().split('T')[0];
            const prevEntry = weatherData.history.find(w => w.date.startsWith(prevDateStr));

            // Use dailyAvg or fallback to pressure for old data
            const todayPressure = weatherEntry.dailyAvg || weatherEntry.pressure;
            const yesterdayPressure = prevEntry ? (prevEntry.dailyAvg || prevEntry.pressure) : null;

            if (todayPressure) {
                let changeInfo = '';
                if (yesterdayPressure) {
                    const change = todayPressure - yesterdayPressure;
                    const changeText = change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1);
                    const trend = change > 5 ? '↑ Rising' : change < -5 ? '↓ Falling' : '→ Stable';

                    changeInfo = `
                        <p>24h Change: ${changeText} hPa (${trend})</p>
                        ${Math.abs(change) > 5 ? `<p style="color: var(--pain-moderate); margin-top: 4px;">Significant 24h change</p>` : ''}
                    `;
                }

                // Show rapid change info if available
                // Updated threshold: 5+ hPa in 6h (research-validated)
                let rapidChangeInfo = '';
                if (weatherEntry.maxChange3h && weatherEntry.maxChange3h >= 5) {
                    rapidChangeInfo = `<p style="color: var(--accent-red); margin-top: 4px;">Rapid change: ${weatherEntry.maxChange3h} hPa in 6h</p>`;
                }

                weatherContent = `
                    <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; border-left: 3px solid var(--accent-green);">
                        <p><strong>Weather Conditions</strong></p>
                        <p>Pressure: ${todayPressure.toFixed(1)} hPa</p>
                        ${changeInfo}
                        ${rapidChangeInfo}
                    </div>
                `;
            }
        }
    }

    if (startedToday.length === 0 && ongoingToday.length === 0) {
        const noEpisodeContent = weatherContent || '<p>No episodes logged on this day.</p>';
        showModal(formatDate(date), noEpisodeContent);
        return;
    }

    let content = weatherContent;

    if (startedToday.length > 0) {
        content += startedToday.map(m => `
            <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; position: relative;">
                <button data-edit-attack="${safeText(String(m.id))}" class="btn-inline floating" title="Edit this episode">
                    Edit
                </button>
                <p><strong>Started: ${formatTime(new Date(m.startTime))}</strong></p>
                <p>Pain: ${m.painLevel}/10 (${safeText(m.category)})</p>
                <p>Duration: ${formatDuration(m.duration)}</p>
                ${m.medication ? `<p>Medication: ${safeText(m.medication)}</p>` : ''}
                ${headZoneLabels(m.painLocations).length > 0 ? `<p>Location: ${safeText(headZoneLabels(m.painLocations).join(', '))}${deriveLaterality(m.painLocations) ? ` (${deriveLaterality(m.painLocations)})` : ''}</p>` : ''}
                ${qualityLabels(m.painQuality).length > 0 ? `<p>Quality: ${safeText(qualityLabels(m.painQuality).join(', '))}</p>` : ''}
                ${prodromeLabels(m.prodrome).length > 0 ? `<p>Warning signs: ${safeText(prodromeLabels(m.prodrome).join(', '))}</p>` : ''}
                ${symptomLabels(m.symptoms).length > 0 ? `<p>Symptoms: ${safeText(symptomLabels(m.symptoms).join(', '))}</p>` : ''}
                ${triggerLabels(m.triggers).length > 0 ? `<p>Triggers: ${safeText(triggerLabels(m.triggers).join(', '))}</p>` : ''}
                ${postdromeLabels(m.postdrome).length > 0 ? `<p>After-effects: ${safeText(postdromeLabels(m.postdrome).join(', '))}</p>` : ''}
                ${m.notes ? `<p style="margin-top: 8px;">Notes: ${safeText(m.notes)}</p>` : ''}
                ${m.endNotes ? `<p style="margin-top: 8px;">Resolution: ${safeText(m.endNotes)}</p>` : ''}
            </div>
        `).join('');
    }

    if (ongoingToday.length > 0) {
        content += ongoingToday.map(m => `
            <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; border-left: 3px solid var(--accent-blue); position: relative;">
                <button data-edit-attack="${safeText(String(m.id))}" class="btn-inline floating" title="Edit this episode">
                    Edit
                </button>
                <p><strong>Ongoing Attack</strong></p>
                <p>Started: ${formatTime(new Date(m.startTime))}</p>
                <p>Pain: ${m.painLevel}/10 (${safeText(m.category)})</p>
                <p>Duration: ${formatDuration(m.duration)}</p>
                ${m.medication ? `<p>Medication: ${safeText(m.medication)}</p>` : ''}
                ${headZoneLabels(m.painLocations).length > 0 ? `<p>Location: ${safeText(headZoneLabels(m.painLocations).join(', '))}${deriveLaterality(m.painLocations) ? ` (${deriveLaterality(m.painLocations)})` : ''}</p>` : ''}
                ${qualityLabels(m.painQuality).length > 0 ? `<p>Quality: ${safeText(qualityLabels(m.painQuality).join(', '))}</p>` : ''}
                ${prodromeLabels(m.prodrome).length > 0 ? `<p>Warning signs: ${safeText(prodromeLabels(m.prodrome).join(', '))}</p>` : ''}
                ${symptomLabels(m.symptoms).length > 0 ? `<p>Symptoms: ${safeText(symptomLabels(m.symptoms).join(', '))}</p>` : ''}
                ${triggerLabels(m.triggers).length > 0 ? `<p>Triggers: ${safeText(triggerLabels(m.triggers).join(', '))}</p>` : ''}
                ${postdromeLabels(m.postdrome).length > 0 ? `<p>After-effects: ${safeText(postdromeLabels(m.postdrome).join(', '))}</p>` : ''}
                ${m.notes ? `<p style="margin-top: 8px;">Notes: ${safeText(m.notes)}</p>` : ''}
                ${m.endNotes ? `<p style="margin-top: 8px;">Resolution: ${safeText(m.endNotes)}</p>` : ''}
            </div>
        `).join('');
    }

    showModal(formatDate(date), content);
}

function initializeSettings() {
    // CRITICAL FIX: Wrap in try-catch to prevent initialization failures
    // Settings DOM elements don't exist until settings page is shown
    try {
        // Helper function to safely add event listeners
        const safeAddListener = (elementId, event, handler) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                console.warn(`[WARNING] Element not found during initialization: ${elementId}`);
            }
        };

        // Only update storage info if elements exist
        const storageEpisodesElem = document.getElementById('storage-episodes');
        if (storageEpisodesElem) {
            updateStorageInfo();
        }

        // Safely add all event listeners
        safeAddListener('export-json-btn', 'click', exportJSON);
        safeAddListener('export-csv-btn', 'click', exportCSV);
        safeAddListener('export-pdf-btn', 'click', showPDFDateRangeModal);

        safeAddListener('import-json-btn', 'click', () => {
            document.getElementById('import-file-input')?.click();
        });

        safeAddListener('import-csv-btn', 'click', () => {
            document.getElementById('import-csv-input')?.click();
        });

        safeAddListener('import-file-input', 'change', handleImport);
        safeAddListener('import-csv-input', 'change', handleCSVImport);
        safeAddListener('view-trash-btn', 'click', viewTrash);

        safeAddListener('tour-btn', 'click', () => {
            showPage('log');
            setTimeout(() => {
                startGuidedTour();
            }, 400);
        });

        safeAddListener('how-to-btn', 'click', showHowTo);
        safeAddListener('about-btn', 'click', showAbout);
        safeAddListener('privacy-btn', 'click', showPrivacy);
        safeAddListener('clear-all-btn', 'click', clearAllData);

        // Initialize hidden debug mode (will handle missing elements gracefully)
        initializeDebugMode();

        console.log('[SUCCESS] Settings initialization completed (deferred mode)');
    } catch (error) {
        console.error('[ERROR] Error in initializeSettings:', error);
        // Don't throw - allow app initialization to continue
    }
}

// ============================================
// HIDDEN DEBUG MODE (Production Safe)
// ============================================

let versionTapCount = 0;
let versionTapTimer = null;

let debugModeInitialized = false;
function initializeDebugMode() {
    if (debugModeInitialized) {
        console.log('[SUCCESS] Debug mode already initialized');
        return;
    }

    const versionElement = document.getElementById('app-version');
    if (!versionElement) {
        console.warn('[WARNING] Debug mode: app-version element not found, will initialize when settings page is shown');
        return;
    }

    console.log('[DEBUG] Initializing debug mode...');

    // Remove any existing listeners to prevent duplicates
    const newElement = versionElement.cloneNode(true);
    versionElement.parentNode.replaceChild(newElement, versionElement);

    newElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        versionTapCount++;

        console.log(`[SEARCH] Debug tap registered: ${versionTapCount}/7`);

        // Visual feedback - briefly change opacity
        newElement.style.opacity = '0.5';
        setTimeout(() => {
            newElement.style.opacity = '1';
        }, 100);

        // Reset counter after 2 seconds of inactivity
        clearTimeout(versionTapTimer);
        versionTapTimer = setTimeout(() => {
            console.log('[RELOAD] Debug tap counter reset');
            versionTapCount = 0;
        }, 2000);

        // Show debug modal after 7 taps
        if (versionTapCount === 7) {
            console.log('[TARGET] Opening debug modal...');
            versionTapCount = 0;
            showDebugModal();
        }
    }, { passive: false });

    debugModeInitialized = true;
    console.log('[SUCCESS] Debug mode initialized successfully');
}

function showDebugModal() {
    console.log('[SEARCH] showDebugModal called');
    const modal = document.getElementById('debug-modal');
    if (!modal) {
        console.error('[ERROR] Debug modal element not found!');
        showToast('Debug information is unavailable right now.', { type: 'error' });
        return;
    }

    try {
        // Populate debug information
        const activeMigraines = getActiveMigraines();
        const deletedMigraines = getDeletedMigraines();

        // Determine data source
        let dataSource = 'Unknown';
        if (useIndexedDB && db) {
            dataSource = 'IndexedDB';
        } else if (localStorage.getItem('migraines')) {
            dataSource = 'localStorage';
        }

        // Check localStorage size
        let localStorageStatus = 'Empty';
        const storedData = localStorage.getItem('migraines');
        if (storedData) {
            const sizeKB = (storedData.length / 1024).toFixed(1);
            localStorageStatus = `${sizeKB} KB`;
        }

        // Update debug modal content
        document.getElementById('debug-data-source').textContent = dataSource;
        document.getElementById('debug-total-episodes').textContent = migraines.length;
        document.getElementById('debug-active-episodes').textContent = activeMigraines.length;
        document.getElementById('debug-deleted-episodes').textContent = deletedMigraines.length;
        document.getElementById('debug-indexeddb').textContent = (useIndexedDB && db) ? 'Available' : 'Not Available';
        document.getElementById('debug-localstorage').textContent = localStorageStatus;

        modal.style.display = 'flex';
        openDialog(modal, { activate: false });
    } catch (error) {
        console.error('[ERROR] Error showing debug modal:', error);
        showToast('Debug information could not be shown.', { type: 'error' });
    }
}

function closeDebugModal() {
    const modal = document.getElementById('debug-modal');
    if (modal) {
        modal.style.display = 'none';
        closeDialog(modal, { deactivate: false });
    }
}

function copyDebugInfo() {
    const activeMigraines = getActiveMigraines();
    const deletedMigraines = getDeletedMigraines();

    const debugInfo = `Aiding Migraine v5.7.1 - Debug Information
Generated: ${new Date().toISOString()}

Data Source: ${useIndexedDB && db ? 'IndexedDB' : 'localStorage'}
Total Episodes: ${migraines.length}
Active Episodes: ${activeMigraines.length}
Deleted Episodes: ${deletedMigraines.length}
IndexedDB: ${(useIndexedDB && db) ? 'Available' : 'Not Available'}
localStorage: ${localStorage.getItem('migraines') ? 'Has Data' : 'Empty'}

Browser: ${navigator.userAgent}
`;

    navigator.clipboard.writeText(debugInfo).then(() => {
        showToast('Debug information copied to the clipboard.');
    }).catch((err) => {
        console.error('Failed to copy:', err);
        showToast('Could not copy to the clipboard.', { type: 'error' });
    });
}

function updateStorageInfo() {
    try {
        const activeMigraines = getActiveMigraines();
        const deletedMigraines = getDeletedMigraines();
        const episodes = activeMigraines.length;
        const dataStr = JSON.stringify(migraines);
        const sizeBytes = new Blob([dataStr]).size;
        const sizeKB = (sizeBytes / 1024).toFixed(2);
        const lastBackup = localStorage.getItem('lastBackup') || 'Never';

        // CRITICAL FIX: Add defensive checks for DOM elements
        const storageEpisodesElem = document.getElementById('storage-episodes');
        const storageSizeElem = document.getElementById('storage-size');
        const lastBackupElem = document.getElementById('last-backup');

        if (storageEpisodesElem) {
            storageEpisodesElem.textContent = episodes;
        }
        if (storageSizeElem) {
            storageSizeElem.textContent = `${sizeKB} KB`;
        }
        if (lastBackupElem) {
            lastBackupElem.textContent = lastBackup;
        }

        const trashCount = document.getElementById('trash-count');
        const trashSubtitle = document.getElementById('trash-subtitle');
        if (trashCount) {
            trashCount.textContent = deletedMigraines.length;
        }
        if (trashSubtitle) {
            const itemText = deletedMigraines.length === 1 ? 'item' : 'items';
            trashSubtitle.textContent = `${deletedMigraines.length} ${itemText}`;
        }
    } catch (error) {
        console.error('[ERROR] Error in updateStorageInfo:', error);
        // Don't throw - allow operation to continue
    }
}

function exportJSON() {
    // Include archived (but not trashed) episodes so archiving
    // never causes data loss in backups
    const exportMigraines = migraines.filter(m => !m.deleted);
    const data = {
        appVersion: APP_VERSION,
        exportDate: new Date().toISOString(),
        totalEpisodes: exportMigraines.length,
        migraines: exportMigraines,
        assessments: assessments,
        cycleData: cycleData
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aiding-migraine-backup-${formatDateFile(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);

    localStorage.setItem('lastBackup', formatDate(new Date()));
    updateStorageInfo();

    showModal('Export Complete', 'Your data has been exported successfully.');
}

function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.json')) {
        showModal('Invalid File Type',
            '<p>Please select a JSON file (.json).</p>' +
            '<p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 12px;">Backup files exported from this app end with .json</p>');
        e.target.value = '';
        return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showModal('File Too Large',
            '<p>The selected file is too large. Maximum size is 10MB.</p>' +
            '<p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 12px;">If you have many episodes, try exporting a smaller date range.</p>');
        e.target.value = '';
        return;
    }

    // Check for empty file
    if (file.size === 0) {
        showModal('Empty File', '<p>The selected file is empty. Please select a valid backup file.</p>');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
        showModal('File Read Error',
            '<p>Could not read the file. Please try again.</p>' +
            '<p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 12px;">Make sure the file is not corrupted or in use by another program.</p>');
        e.target.value = '';
    };

    reader.onload = (event) => {
        try {
            const text = event.target.result;

            // Check for empty content
            if (!text || text.trim().length === 0) {
                throw new Error('EMPTY_CONTENT');
            }

            // Parse JSON
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                throw new Error('INVALID_JSON');
            }

            // Validate structure
            if (!data || typeof data !== 'object') {
                throw new Error('INVALID_STRUCTURE');
            }

            if (!data.migraines) {
                throw new Error('MISSING_MIGRAINES');
            }

            if (!Array.isArray(data.migraines)) {
                throw new Error('MIGRAINES_NOT_ARRAY');
            }

            // Restore any disability assessments from the backup
            // (independent of the migraine conflict-resolution flow)
            if (Array.isArray(data.assessments)) {
                mergeAssessments(data.assessments);
                renderAssessments();
            }

            // Restore optional menstrual cycle data (opt-in feature)
            if (data.cycleData) {
                mergeCycleData(data.cycleData);
                if (typeof refreshCycleViews === 'function') refreshCycleViews();
            }

            if (data.migraines.length === 0) {
                showModal('Empty Backup',
                    '<p>This backup file contains no episodes.</p>' +
                    '<p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 12px;">The file is valid but has no data to import.</p>');
                e.target.value = '';
                return;
            }

            // Validate individual episodes
            const validationResult = validateEpisodes(data.migraines);

            if (!validationResult.valid) {
                showModal('Invalid Episode Data',
                    `<p>Some episodes in the backup file have invalid data:</p>` +
                    `<ul style="margin: 12px 0; padding-left: 20px; color: var(--text-secondary);">` +
                    validationResult.errors.slice(0, 5).map(err => `<li>${err}</li>`).join('') +
                    (validationResult.errors.length > 5 ? `<li>...and ${validationResult.errors.length - 5} more</li>` : '') +
                    `</ul>` +
                    `<p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 12px;">This may not be a valid Aiding Migraine backup file.</p>`);
                e.target.value = '';
                return;
            }

            // Check storage space
            const importSize = new Blob([text]).size;
            const storageCheck = checkStorageSpace(importSize);

            if (!storageCheck.hasSpace) {
                showModal('Storage Full',
                    `<p>Not enough storage space to import this file.</p>` +
                    `<div style="margin: 16px 0; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; font-size: 0.9rem;">` +
                    `<p>Current data: <strong>${storageCheck.currentMB} MB</strong></p>` +
                    `<p>Import size: <strong>${storageCheck.importMB} MB</strong></p>` +
                    `<p>Total would be: <strong>${storageCheck.totalMB} MB</strong></p>` +
                    `<p>Storage limit: <strong>${storageCheck.limitMB} MB</strong></p>` +
                    `</div>` +
                    `<p style="color: var(--text-secondary); font-size: 0.9rem;">Try exporting and deleting old episodes, or empty your trash to free up space.</p>`);
                e.target.value = '';
                return;
            }

            // Analyze import data
            const analysis = analyzeImportData(data.migraines);

            // Show import review UI with storage warning if needed
            showImportReviewModal(data.migraines, analysis, storageCheck);

        } catch (error) {
            let title = 'Import Failed';
            let message = '';

            switch (error.message) {
                case 'EMPTY_CONTENT':
                    message = '<p>The file appears to be empty or contains only whitespace.</p>';
                    break;
                case 'INVALID_JSON':
                    message = '<p>The file is not valid JSON format.</p>' +
                             '<p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 12px;">Make sure you selected a backup file exported from Aiding Migraine.</p>';
                    break;
                case 'INVALID_STRUCTURE':
                    message = '<p>The file structure is not recognized.</p>' +
                             '<p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 12px;">This doesn\'t appear to be an Aiding Migraine backup file.</p>';
                    break;
                case 'MISSING_MIGRAINES':
                    message = '<p>The file is missing the required "migraines" data field.</p>' +
                             '<p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 12px;">This may be from a different app or an older version.</p>';
                    break;
                case 'MIGRAINES_NOT_ARRAY':
                    message = '<p>The episodes data is in an incorrect format.</p>' +
                             '<p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 12px;">The file may be corrupted.</p>';
                    break;
                default:
                    message = '<p>The file you selected could not be imported.</p>' +
                             '<p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 12px;">Please make sure it\'s a valid backup file from Aiding Migraine.</p>';
            }

            showModal(title, message);
        }

        e.target.value = '';
    };

    reader.readAsText(file);
}

function sanitizeHTML(text) {
    if (!text || typeof text !== 'string') return text;

    // Create a temporary div to use browser's HTML parser
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
}

function sanitizeEpisode(episode) {
    // Sanitize text fields to prevent XSS
    const textFields = ['notes', 'medication', 'endNotes'];

    textFields.forEach(field => {
        if (episode[field]) {
            episode[field] = sanitizeHTML(episode[field]);
        }
    });

    // Symptoms and triggers are controlled key lists: keep only known
    // keys. This both validates and neutralizes any injected content.
    if (episode.symptoms !== undefined) {
        episode.symptoms = Array.isArray(episode.symptoms)
            ? episode.symptoms.filter(k => typeof k === 'string' && SYMPTOM_KEYS.has(k))
            : [];
    }
    if (episode.triggers !== undefined) {
        episode.triggers = Array.isArray(episode.triggers)
            ? episode.triggers.filter(k => typeof k === 'string' && TRIGGER_KEYS.has(k))
            : [];
    }
    if (episode.prodrome !== undefined) {
        episode.prodrome = Array.isArray(episode.prodrome)
            ? episode.prodrome.filter(k => typeof k === 'string' && PRODROME_KEYS.has(k))
            : [];
    }
    if (episode.postdrome !== undefined) {
        episode.postdrome = Array.isArray(episode.postdrome)
            ? episode.postdrome.filter(k => typeof k === 'string' && POSTDROME_KEYS.has(k))
            : [];
    }
    if (episode.painLocations !== undefined) {
        episode.painLocations = Array.isArray(episode.painLocations)
            ? episode.painLocations.filter(k => typeof k === 'string' && HEAD_ZONE_KEYS.has(k))
            : [];
    }
    if (episode.painQuality !== undefined) {
        episode.painQuality = Array.isArray(episode.painQuality)
            ? episode.painQuality.filter(k => typeof k === 'string' && PAIN_QUALITY_KEYS.has(k))
            : [];
    }

    return episode;
}

function checkStorageSpace(dataSize) {
    try {
        // Get current storage usage
        const currentData = localStorage.getItem('migraines') || '[]';
        const currentSize = new Blob([currentData]).size;

        // Estimate total size after import
        const estimatedTotal = currentSize + dataSize;

        // LocalStorage limit is typically 5-10MB, we'll use 5MB as conservative estimate
        const storageLimit = 5 * 1024 * 1024; // 5MB

        // Check if we're approaching the limit (use 80% threshold)
        const threshold = storageLimit * 0.8;

        if (estimatedTotal > threshold) {
            const currentMB = (currentSize / (1024 * 1024)).toFixed(2);
            const importMB = (dataSize / (1024 * 1024)).toFixed(2);
            const totalMB = (estimatedTotal / (1024 * 1024)).toFixed(2);

            return {
                hasSpace: estimatedTotal <= storageLimit,
                warning: estimatedTotal > threshold && estimatedTotal <= storageLimit,
                currentMB: currentMB,
                importMB: importMB,
                totalMB: totalMB,
                limitMB: (storageLimit / (1024 * 1024)).toFixed(2)
            };
        }

        return { hasSpace: true, warning: false };
    } catch (e) {
        // If we can't check, assume it's okay but log the error
        console.error('Storage check failed:', e);
        return { hasSpace: true, warning: false };
    }
}

function validateEpisodes(episodes) {
    const errors = [];
    const requiredFields = ['id', 'startTime', 'painLevel', 'category', 'duration'];

    episodes.forEach((episode, index) => {
        // Check if episode is an object
        if (!episode || typeof episode !== 'object') {
            errors.push(`Episode ${index + 1}: Invalid episode format`);
            return;
        }

        // Check required fields
        requiredFields.forEach(field => {
            if (episode[field] === undefined || episode[field] === null) {
                errors.push(`Episode ${index + 1}: Missing required field "${field}"`);
            }
        });

        // Validate specific fields
        if (episode.painLevel !== undefined) {
            if (typeof episode.painLevel !== 'number' || episode.painLevel < 0 || episode.painLevel > 10) {
                errors.push(`Episode ${index + 1}: Pain level must be between 0-10`);
            }
        }

        if (episode.startTime !== undefined) {
            const date = new Date(episode.startTime);
            if (isNaN(date.getTime())) {
                errors.push(`Episode ${index + 1}: Invalid start time format`);
            }
        }

        if (episode.category !== undefined) {
            if (!['Mild', 'Moderate', 'Severe'].includes(episode.category)) {
                errors.push(`Episode ${index + 1}: Invalid category "${episode.category}"`);
            }
        }

        if (episode.duration !== undefined) {
            if (typeof episode.duration !== 'number' || episode.duration < 0) {
                errors.push(`Episode ${index + 1}: Invalid duration value`);
            }
        }

        // Sanitize text fields to prevent XSS attacks
        sanitizeEpisode(episode);
    });

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

function analyzeImportData(importedEpisodes) {
    const newEpisodes = [];
    const duplicates = [];
    const conflicts = [];

    importedEpisodes.forEach(imported => {
        // Check for exact ID match
        const exactMatch = migraines.find(m => m.id === imported.id);

        if (exactMatch) {
            // Check if data is identical or different
            const isDifferent = JSON.stringify(exactMatch) !== JSON.stringify(imported);

            if (isDifferent) {
                conflicts.push({
                    imported: imported,
                    existing: exactMatch,
                    matchType: 'id'
                });
            } else {
                duplicates.push({
                    imported: imported,
                    existing: exactMatch,
                    matchType: 'exact'
                });
            }
        } else {
            // Check for timestamp proximity (within 1 minute)
            const importTime = new Date(imported.startTime).getTime();
            const proximityMatch = migraines.find(m => {
                const existingTime = new Date(m.startTime).getTime();
                const diff = Math.abs(importTime - existingTime);
                return diff < 60000; // 1 minute
            });

            if (proximityMatch) {
                // Similar timing - could be duplicate
                conflicts.push({
                    imported: imported,
                    existing: proximityMatch,
                    matchType: 'time'
                });
            } else {
                // Truly new episode
                newEpisodes.push(imported);
            }
        }
    });

    return {
        total: importedEpisodes.length,
        new: newEpisodes,
        duplicates: duplicates,
        conflicts: conflicts
    };
}

function showImportReviewModal(importedEpisodes, analysis, storageCheck) {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');

    let summaryHTML = ``;

    // Show storage warning if approaching limit
    if (storageCheck && storageCheck.warning) {
        summaryHTML += `
            <div style="padding: 12px; background: var(--accent-red); color: white; border-radius: 8px; margin-bottom: 16px; font-size: 0.9rem;">
                <strong>Storage Warning</strong><br>
                You're approaching the storage limit (${storageCheck.totalMB} MB / ${storageCheck.limitMB} MB).
                Consider deleting old episodes or emptying trash after import.
            </div>
        `;
    }

    summaryHTML += `
        <p style="margin-bottom: 16px;">Found <strong>${analysis.total} episodes</strong> in backup file:</p>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
            <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px; display: flex; justify-content: space-between;">
                <span>New Episodes:</span>
                <strong style="color: var(--accent-green);">${analysis.new.length}</strong>
            </div>
            <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px; display: flex; justify-content: space-between;">
                <span>Exact Duplicates:</span>
                <strong>${analysis.duplicates.length}</strong>
            </div>
            <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px; display: flex; justify-content: space-between;">
                <span>Conflicts:</span>
                <strong style="color: var(--accent-red);">${analysis.conflicts.length}</strong>
            </div>
        </div>
    `;

    if (analysis.conflicts.length > 0) {
        summaryHTML += `
            <p style="color: var(--accent-red); margin-bottom: 12px;">
                <strong>Conflicts Detected</strong><br>
                Some episodes have the same ID or similar timing but different data.
            </p>
        `;
    }

    if (analysis.new.length === 0 && analysis.conflicts.length === 0) {
        summaryHTML += `<p style="color: var(--text-secondary);">All episodes already exist. Nothing new to import.</p>`;
    }

    body.innerHTML = safeHTML(summaryHTML);

    // Keep the analysis in module state instead of serializing the
    // entire dataset into onclick attributes (fragile + injectable)
    pendingImportAnalysis = analysis;

    // Action buttons (built programmatically - no inline handlers)
    const actions = document.getElementById('modal-actions');
    actions.textContent = '';

    const addActionButton = (text, className, handler) => {
        const btn = document.createElement('button');
        btn.className = `btn ${className}`;
        btn.textContent = text;
        btn.addEventListener('click', handler);
        actions.appendChild(btn);
    };

    if (analysis.new.length === 0 && analysis.conflicts.length === 0) {
        addActionButton('Close', 'btn-primary', closeModal);
    } else if (analysis.conflicts.length > 0) {
        addActionButton('Cancel', 'btn-secondary', closeModal);
        addActionButton('Review Conflicts', 'btn-secondary', () => reviewConflicts(pendingImportAnalysis));
        addActionButton('Import New Only', 'btn-primary', () => importWithStrategy(pendingImportAnalysis, 'skipConflicts'));
    } else {
        addActionButton('Cancel', 'btn-secondary', closeModal);
        addActionButton(`Import ${analysis.new.length} Episodes`, 'btn-primary', () => confirmImport(pendingImportAnalysis.new));
    }

    document.getElementById('modal-title').textContent = 'Import Review';
    openDialog(modal);
}

function reviewConflicts(analysis) {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');

    let conflictsHTML = `
        <p style="margin-bottom: 16px;">Review ${analysis.conflicts.length} conflicting episodes:</p>
        <div style="max-height: 400px; overflow-y: auto;">
    `;

    analysis.conflicts.forEach((conflict, index) => {
        const imported = conflict.imported;
        const existing = conflict.existing;
        const matchLabel = conflict.matchType === 'id' ? 'Same ID' : 'Similar Time';

        conflictsHTML += `
            <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--accent-red);">
                <div style="margin-bottom: 8px; font-weight: 600; color: var(--accent-red);">
                    Conflict #${index + 1} (${matchLabel})
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.9rem;">
                    <div>
                        <div style="font-weight: 600; margin-bottom: 4px; color: var(--accent-green);">Importing:</div>
                        <div>Date: ${formatDate(new Date(imported.startTime))}</div>
                        <div>Time: ${formatTime(new Date(imported.startTime))}</div>
                        <div>Pain: ${imported.painLevel}/10</div>
                        <div>Duration: ${formatDuration(imported.duration || 0)}</div>
                        ${imported.medication ? `<div>Med: ${safeText(imported.medication)}</div>` : ''}
                    </div>
                    <div>
                        <div style="font-weight: 600; margin-bottom: 4px; color: var(--accent-blue);">Existing:</div>
                        <div>Date: ${formatDate(new Date(existing.startTime))}</div>
                        <div>Time: ${formatTime(new Date(existing.startTime))}</div>
                        <div>Pain: ${existing.painLevel}/10</div>
                        <div>Duration: ${formatDuration(existing.duration || 0)}</div>
                        ${existing.medication ? `<div>Med: ${safeText(existing.medication)}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    conflictsHTML += `</div>`;

    body.innerHTML = safeHTML(conflictsHTML);

    pendingImportAnalysis = analysis;

    const actions = document.getElementById('modal-actions');
    actions.textContent = '';

    const addActionButton = (text, className, handler) => {
        const btn = document.createElement('button');
        btn.className = `btn ${className}`;
        btn.textContent = text;
        btn.addEventListener('click', handler);
        actions.appendChild(btn);
    };

    addActionButton('Back', 'btn-secondary', () => showImportReviewModal([], pendingImportAnalysis));
    addActionButton('Skip Conflicts', 'btn-secondary', () => importWithStrategy(pendingImportAnalysis, 'skipConflicts'));
    addActionButton('Replace Existing', 'btn-primary', () => importWithStrategy(pendingImportAnalysis, 'replaceConflicts'));

    document.getElementById('modal-title').textContent = 'Review Conflicts';
}

function importWithStrategy(analysis, strategy) {
    let importedCount = 0;

    // Always import new episodes
    analysis.new.forEach(episode => {
        migraines.push(episode);
        importedCount++;
    });

    // Handle conflicts based on strategy
    if (strategy === 'replaceConflicts') {
        analysis.conflicts.forEach(conflict => {
            // Remove existing and add new
            const index = migraines.findIndex(m => m.id === conflict.existing.id);
            if (index !== -1) {
                migraines[index] = conflict.imported;
                importedCount++;
            }
        });
    }
    // If 'skipConflicts', we just don't import them

    // Sort migraines by startTime
    migraines.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    saveData();
    renderHistory();
    updateDashboard();
    renderCalendar();
    updateStorageInfo();

    closeModal();

    let message = `Successfully imported ${importedCount} episodes.`;
    if (strategy === 'skipConflicts' && analysis.conflicts.length > 0) {
        message += `\n\nSkipped ${analysis.conflicts.length} conflicting episodes.`;
    }

    pendingImportAnalysis = null;
    showModal('Import Complete', message);
}

function confirmImport(newEpisodes) {
    newEpisodes.forEach(episode => {
        migraines.push(episode);
    });

    // Sort migraines by startTime
    migraines.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    saveData();
    renderHistory();
    updateDashboard();
    renderCalendar();
    updateStorageInfo();

    closeModal();
    pendingImportAnalysis = null;
    showModal('Import Complete', `Successfully imported ${newEpisodes.length} episodes.`);
}

// ============================================
// CSV EXPORT/IMPORT FUNCTIONS
// ============================================

function exportCSV() {
    const activeMigraines = getActiveMigraines();

    if (activeMigraines.length === 0) {
        showModal('No Data', 'You have no migraine episodes to export.');
        return;
    }

    // CSV Header with BOM for Excel compatibility
    const BOM = '\uFEFF';
    let csv = BOM + 'Date,Start Time,End Time,Duration (hours),Pain Level,Category,Medication,Notes,Resolution,Status,Pressure (hPa),Symptoms,Triggers,Prodrome,Postdrome,Pain Location,Pain Quality\n';

    // Sort by date (oldest first) - use slice() to avoid mutating original array
    const sorted = activeMigraines.slice().sort((a, b) =>
        new Date(a.startTime) - new Date(b.startTime)
    );

    // Neutralize spreadsheet formula injection: a leading =, +, -, @
    // (or tab/CR) would execute as a formula in Excel/Sheets
    const neutralizeFormula = (value) =>
        /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

    // Convert each migraine to CSV row
    sorted.forEach(m => {
        const startDate = new Date(m.startTime);
        // Use the LOCAL calendar date to match the local start/end
        // times below - mixing the UTC date with local times shifted
        // episodes by a day on re-import for most timezones
        const pad = n => String(n).padStart(2, '0');
        const date = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
        const startTime = startDate.toTimeString().slice(0, 5);

        let endTime = '';
        let durationHours = '';
        if (m.endTime && m.duration) {
            const endDate = new Date(m.endTime);
            endTime = endDate.toTimeString().slice(0, 5);
            durationHours = (m.duration / 3600).toFixed(2);
        }

        const medication = neutralizeFormula(m.medication || '').replace(/"/g, '""'); // Escape quotes
        const notes = neutralizeFormula(m.notes || '').replace(/"/g, '""');
        const resolution = neutralizeFormula(m.endNotes || '').replace(/"/g, '""');
        const pressure = m.weather && m.weather.pressure ? m.weather.pressure.toFixed(1) : '';
        const symptoms = neutralizeFormula(symptomLabels(m.symptoms).join('; ')).replace(/"/g, '""');
        const triggers = neutralizeFormula(triggerLabels(m.triggers).join('; ')).replace(/"/g, '""');
        const prodrome = neutralizeFormula(prodromeLabels(m.prodrome).join('; ')).replace(/"/g, '""');
        const postdrome = neutralizeFormula(postdromeLabels(m.postdrome).join('; ')).replace(/"/g, '""');
        const painLocation = neutralizeFormula(headZoneLabels(m.painLocations).join('; ')).replace(/"/g, '""');
        const painQuality = neutralizeFormula(qualityLabels(m.painQuality).join('; ')).replace(/"/g, '""');

        // Quote fields that might contain commas
        csv += `${date},${startTime},${endTime},${durationHours},${m.painLevel},${m.category},"${medication}","${notes}","${resolution}",${m.status},${pressure},"${symptoms}","${triggers}","${prodrome}","${postdrome}","${painLocation}","${painQuality}"\n`;
    });

    // Create and download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aiding-migraine-export-${formatDateFile(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showModal('Export Complete', `Successfully exported ${activeMigraines.length} episodes to CSV.`);
}

function handleCSVImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
        showModal('Invalid File Type', 'Please select a CSV file (.csv).');
        e.target.value = '';
        return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showModal('File Too Large', 'The selected CSV file is too large. Maximum size is 5MB.');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
        try {
            const csvText = event.target.result;

            if (!csvText || csvText.trim().length === 0) {
                showModal('Empty File', 'The CSV file is empty.');
                e.target.value = '';
                return;
            }

            // Parse CSV
            const parsed = parseCSV(csvText);

            if (!parsed.success) {
                showModal('Parse Error', parsed.error);
                e.target.value = '';
                return;
            }

            if (parsed.entries.length === 0) {
                showModal('No Data', 'No valid migraine entries found in the CSV file.');
                e.target.value = '';
                return;
            }

            // Show preview modal
            showCSVImportPreview(parsed.entries);

        } catch (error) {
            showModal('Import Error', 'Failed to read the CSV file. Please check the file format.');
            console.error('CSV import error:', error);
        }

        e.target.value = '';
    };

    reader.readAsText(file);
}

function parseCSV(csvText) {
    try {
        // Remove BOM if present
        csvText = csvText.replace(/^\uFEFF/, '');

        // Split into lines
        const lines = csvText.split(/\r?\n/).filter(line => line.trim());

        if (lines.length < 2) {
            return { success: false, error: 'CSV file must have at least a header row and one data row.' };
        }

        // Parse header
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Find column indices
        const dateIdx = header.findIndex(h => h.includes('date'));
        const timeIdx = header.findIndex(h => h.includes('time') && h.includes('start'));
        const painIdx = header.findIndex(h => h.includes('pain'));

        if (dateIdx === -1 || timeIdx === -1 || painIdx === -1) {
            return { success: false, error: 'CSV must have Date, Start Time, and Pain Level columns.' };
        }

        // Optional columns
        const endTimeIdx = header.findIndex(h => h.includes('end') && h.includes('time'));
        const medicationIdx = header.findIndex(h => h.includes('medication') || h.includes('med'));
        const notesIdx = header.findIndex(h => h.includes('note'));
        const symptomsIdx = header.findIndex(h => h.includes('symptom'));
        const triggersIdx = header.findIndex(h => h.includes('trigger'));
        const prodromeIdx = header.findIndex(h => h.includes('prodrome'));
        const postdromeIdx = header.findIndex(h => h.includes('postdrome'));
        const locationIdx = header.findIndex(h => h.includes('location'));
        const qualityIdx = header.findIndex(h => h.includes('quality'));

        // Map exported labels back to controlled keys (case-insensitive)
        const symptomLabelToKey = {};
        SYMPTOM_OPTIONS.forEach(s => { symptomLabelToKey[s.label.toLowerCase()] = s.key; });
        const triggerLabelToKey = {};
        TRIGGER_OPTIONS.forEach(t => { triggerLabelToKey[t.label.toLowerCase()] = t.key; });
        const prodromeLabelToKey = {};
        PRODROME_OPTIONS.forEach(p => { prodromeLabelToKey[p.label.toLowerCase()] = p.key; });
        const postdromeLabelToKey = {};
        POSTDROME_OPTIONS.forEach(p => { postdromeLabelToKey[p.label.toLowerCase()] = p.key; });
        const locationLabelToKey = {};
        HEAD_ZONES.forEach(z => { locationLabelToKey[z.label.toLowerCase()] = z.key; });
        const qualityLabelToKey = {};
        PAIN_QUALITY_OPTIONS.forEach(q => { qualityLabelToKey[q.label.toLowerCase()] = q.key; });

        // Parse data rows
        const entries = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
            try {
                // Simple CSV parser (handles quoted fields)
                const row = parseCSVLine(lines[i]);

                const date = row[dateIdx];
                const time = row[timeIdx];
                const painStr = row[painIdx];

                if (!date || !time || !painStr) {
                    errors.push(`Row ${i + 1}: Missing required fields`);
                    continue;
                }

                // Validate pain level
                const pain = parseInt(painStr);
                if (isNaN(pain) || pain < 0 || pain > 10) {
                    errors.push(`Row ${i + 1}: Invalid pain level "${painStr}"`);
                    continue;
                }

                // Create start time
                const startDateTime = new Date(`${date}T${time}`);
                if (isNaN(startDateTime.getTime())) {
                    errors.push(`Row ${i + 1}: Invalid date/time`);
                    continue;
                }

                // Don't import future dates
                if (startDateTime > new Date()) {
                    errors.push(`Row ${i + 1}: Future date not allowed`);
                    continue;
                }

                // Strip the formula-injection guard apostrophe our
                // exporter prefixes to =, +, -, @ so round-trips
                // restore the original text
                const stripFormulaGuard = (value) =>
                    value && /^'[=+\-@]/.test(value) ? value.slice(1) : value;

                // Create migraine object
                const migraine = {
                    id: Date.now() * 1000 + Math.floor(Math.random() * 1000) + i, // Unique ID with randomness
                    startTime: startDateTime.toISOString(),
                    painLevel: pain,
                    category: getPainCategory(pain),
                    status: 'completed',
                    medication: medicationIdx !== -1 ? stripFormulaGuard(row[medicationIdx]) : null,
                    notes: notesIdx !== -1 ? stripFormulaGuard(row[notesIdx]) : null,
                    importedAt: new Date().toISOString(),
                    importSource: 'csv'
                };

                // Add end time if present
                if (endTimeIdx !== -1 && row[endTimeIdx]) {
                    const endDateTime = new Date(`${date}T${row[endTimeIdx]}`);
                    if (!isNaN(endDateTime.getTime()) && endDateTime > startDateTime) {
                        migraine.endTime = endDateTime.toISOString();
                        migraine.duration = Math.floor((endDateTime - startDateTime) / 1000);
                    }
                }

                // Parse symptoms if present (labels -> controlled keys)
                if (symptomsIdx !== -1 && row[symptomsIdx]) {
                    migraine.symptoms = stripFormulaGuard(row[symptomsIdx])
                        .split(';')
                        .map(s => symptomLabelToKey[s.trim().toLowerCase()])
                        .filter(Boolean);
                }

                // Parse triggers if present (labels -> controlled keys)
                if (triggersIdx !== -1 && row[triggersIdx]) {
                    migraine.triggers = stripFormulaGuard(row[triggersIdx])
                        .split(';')
                        .map(s => triggerLabelToKey[s.trim().toLowerCase()])
                        .filter(Boolean);
                }

                // Parse prodrome / postdrome if present (labels -> keys)
                if (prodromeIdx !== -1 && row[prodromeIdx]) {
                    migraine.prodrome = stripFormulaGuard(row[prodromeIdx])
                        .split(';')
                        .map(s => prodromeLabelToKey[s.trim().toLowerCase()])
                        .filter(Boolean);
                }
                if (postdromeIdx !== -1 && row[postdromeIdx]) {
                    migraine.postdrome = stripFormulaGuard(row[postdromeIdx])
                        .split(';')
                        .map(s => postdromeLabelToKey[s.trim().toLowerCase()])
                        .filter(Boolean);
                }
                if (locationIdx !== -1 && row[locationIdx]) {
                    migraine.painLocations = stripFormulaGuard(row[locationIdx])
                        .split(';')
                        .map(s => locationLabelToKey[s.trim().toLowerCase()])
                        .filter(Boolean);
                }
                if (qualityIdx !== -1 && row[qualityIdx]) {
                    migraine.painQuality = stripFormulaGuard(row[qualityIdx])
                        .split(';')
                        .map(s => qualityLabelToKey[s.trim().toLowerCase()])
                        .filter(Boolean);
                }

                entries.push(migraine);
            } catch (rowError) {
                errors.push(`Row ${i + 1}: ${rowError.message}`);
            }
        }

        if (entries.length === 0 && errors.length > 0) {
            return {
                success: false,
                error: `No valid entries found. Errors:\n${errors.slice(0, 5).join('\n')}`
            };
        }

        return { success: true, entries, warnings: errors };

    } catch (error) {
        return { success: false, error: `Parse error: ${error.message}` };
    }
}

function parseCSVLine(line) {
    // Simple CSV line parser that handles quoted fields
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

function showCSVImportPreview(entries) {
    // Check for duplicates
    const existing = getActiveMigraines();
    const duplicates = entries.filter(newEntry => {
        return existing.some(existing => {
            const timeDiff = Math.abs(new Date(newEntry.startTime) - new Date(existing.startTime));
            return timeDiff < 60000 && newEntry.painLevel === existing.painLevel; // Within 1 minute
        });
    });

    const toImport = entries.filter(e => !duplicates.some(d => d.id === e.id));

    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');

    const preview = entries.slice(0, 5).map(e => {
        const date = new Date(e.startTime);
        return `Calendar ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} - Pain: ${e.painLevel}/10`;
    }).join('<br>');

    body.innerHTML = `
        <p style="margin-bottom: 16px;">Found <strong>${entries.length}</strong> entries in CSV file.</p>

        <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
            <p style="font-weight: 600; margin-bottom: 8px;">Preview (first 5):</p>
            ${preview}
        </div>

        ${duplicates.length > 0 ? `
        <div style="background: var(--pain-moderate-soft); border-left: 3px solid var(--pain-moderate); padding: 12px; border-radius: 4px; margin-bottom: 16px;">
            <p><strong>${duplicates.length}</strong> duplicate${duplicates.length > 1 ? 's' : ''} detected (will be skipped)</p>
        </div>
        ` : ''}

        <p style="color: var(--text-secondary); font-size: 0.9rem;">
            Imported entries will be merged with your existing data.
        </p>
    `;

    document.getElementById('modal-actions').innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="confirm-csv-import">Import ${toImport.length} ${toImport.length === 1 ? 'Entry' : 'Entries'}</button>
    `;

    document.getElementById('modal-title').textContent = 'Import Preview';
    openDialog(modal);

    document.getElementById('confirm-csv-import').addEventListener('click', () => {
        importCSVEntries(toImport);
        closeModal();
    });
}

function importCSVEntries(entries) {
    // Add entries to migraines array
    entries.forEach(entry => {
        migraines.push(entry);
    });

    // Save and update UI
    saveData();
    updateDashboard();
    renderCalendar();
    renderHistory();
    updateStorageInfo();

    showModal('Import Complete', `Successfully imported ${entries.length} ${entries.length === 1 ? 'episode' : 'episodes'} from CSV.`);
}

function showPDFDateRangeModal() {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');

    body.innerHTML = `
        <p style="margin-bottom: 20px; color: var(--text-secondary);">Select a date range for your doctor report:</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <button class="settings-btn" onclick="exportPDF('7days', null, null, this)">
                <span>Last 7 Days</span>
            </button>
            <button class="settings-btn" onclick="exportPDF('30days', null, null, this)">
                <span>Last 30 Days</span>
            </button>
            <button class="settings-btn" onclick="exportPDF('90days', null, null, this)">
                <span>Last 90 Days</span>
            </button>
            <button class="settings-btn" onclick="showCustomDateRange()">
                <span>Custom Range</span>
            </button>
        </div>
    `;

    document.getElementById('modal-actions').innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    `;

    document.getElementById('modal-title').textContent = 'Export PDF Report';
    openDialog(modal);
}

function showCustomDateRange() {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');

    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    body.innerHTML = `
        <div class="form-group">
            <label>Start Date</label>
            <input type="date" id="custom-start-date" value="${monthAgo}" max="${today}"
                   style="width: 100%; padding: 12px; background: var(--bg-tertiary);
                          border: 1px solid var(--border-color); border-radius: 8px;
                          color: var(--text-primary); font-size: 1rem;">
        </div>
        <div class="form-group">
            <label>End Date</label>
            <input type="date" id="custom-end-date" value="${today}" max="${today}"
                   style="width: 100%; padding: 12px; background: var(--bg-tertiary);
                          border: 1px solid var(--border-color); border-radius: 8px;
                          color: var(--text-primary); font-size: 1rem;">
        </div>
    `;

    document.getElementById('modal-actions').innerHTML = `
        <button class="btn btn-secondary" onclick="showPDFDateRangeModal()">Back</button>
        <button class="btn btn-primary" onclick="exportCustomPDF()">Generate PDF</button>
    `;

    document.getElementById('modal-title').textContent = 'Custom Date Range';
}

function exportCustomPDF() {
    const startDate = document.getElementById('custom-start-date').value;
    const endDate = document.getElementById('custom-end-date').value;

    if (!startDate || !endDate) {
        showModal('Error', 'Please select both start and end dates.');
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        showModal('Error', 'Start date must be before end date.');
        return;
    }

    exportPDF('custom', startDate, endDate, document.activeElement);
}

async function exportPDF(rangeType, customStart, customEnd, triggerEl) {
    if (!window.jspdf) {
        try { await loadOptionalLibrary('jspdf'); } catch { /* Existing report error remains actionable. */ }
    }
    if (!window.jspdf) {
        showModal('Report unavailable', navigator.onLine
            ? '<p>The PDF library could not be loaded. Try reloading the app.</p>'
            : "<p>Building a PDF needs a connection the first time. You can still export a spreadsheet (CSV) or a JSON backup while offline.</p>");
        return Promise.resolve();
    }
    // jsPDF runs synchronously on the main thread; a 90-day report
    // visibly freezes the tab, so show a busy state first.
    return withBusy(triggerEl, 'Building report...', () =>
        buildPDFReport(rangeType, customStart, customEnd));
}

function buildPDFReport(rangeType, customStart, customEnd) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Calculate date range
    let startDate, endDate;
    const now = new Date();

    if (rangeType === 'custom') {
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
    } else {
        endDate = now;
        const days = rangeType === '7days' ? 7 : rangeType === '30days' ? 30 : 90;
        startDate = new Date(now - days * 24 * 60 * 60 * 1000);
    }

    // Filter episodes in range
    const activeMigraines = getActiveMigraines();
    const episodesInRange = activeMigraines.filter(m => {
        const episodeDate = new Date(m.startTime);
        return episodeDate >= startDate && episodeDate <= endDate;
    });

    // Generate PDF
    let yPos = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Migraine Report', 105, yPos, { align: 'center' });
    yPos += 10;

    // Date range
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    const dateRangeStr = `${formatDate(startDate)} - ${formatDate(endDate)}`;
    doc.text(dateRangeStr, 105, yPos, { align: 'center' });
    yPos += 15;

    // Patient Information Section (blank for handwriting)
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Patient Information', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Name: _______________________________________', 20, yPos);
    yPos += 7;
    doc.text('Date of Birth: _______________', 20, yPos);
    doc.text('Visit Date: _______________', 120, yPos);
    yPos += 15;

    // Summary Statistics with Clinical Interpretation
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Clinical Summary', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    const totalEpisodes = episodesInRange.length;

    // Calculate unique migraine days (most important clinical metric, including multi-day attacks)
    const migraineDays = new Set();
    episodesInRange.forEach(m => {
        const days = getMigraineDays(m);
        days.forEach(day => migraineDays.add(day));
    });
    const uniqueMigraineDays = migraineDays.size;

    // Calculate days in range
    const daysInRange = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const monthsInRange = (daysInRange / 30).toFixed(1);

    // Calculate monthly average
    const migraineDaysPerMonth = (uniqueMigraineDays / (daysInRange / 30)).toFixed(1);

    // Determine clinical status
    let clinicalStatus, statusNote;
    if (migraineDaysPerMonth >= 15) {
        clinicalStatus = 'Chronic Migraine';
        statusNote = 'Clinical note: ≥15 headache days/month meets criteria for Chronic Migraine';
    } else if (migraineDaysPerMonth >= 10) {
        clinicalStatus = 'High-Frequency Episodic Migraine';
        statusNote = 'Clinical note: >10 days/month indicates elevated risk for chronification';
    } else if (migraineDaysPerMonth >= 4) {
        clinicalStatus = 'Episodic Migraine';
        statusNote = 'Clinical note: <15 days/month indicates episodic pattern';
    } else {
        clinicalStatus = 'Low-Frequency Episodic Migraine';
        statusNote = 'Clinical note: <4 days/month indicates low-frequency pattern';
    }

    // Headache Frequency Section
    doc.setFont(undefined, 'bold');
    doc.text('Headache Frequency', 20, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.text(`Migraine Days in Period: ${uniqueMigraineDays} days (out of ${daysInRange} days tracked)`, 20, yPos);
    yPos += 5;
    doc.text(`Average per Month: ${migraineDaysPerMonth} days/month`, 20, yPos);
    yPos += 5;
    doc.text(`Total Episodes: ${totalEpisodes}`, 20, yPos);
    yPos += 5;
    doc.setFont(undefined, 'bold');
    doc.text(`Status: ${clinicalStatus}`, 20, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.text(statusNote, 20, yPos);
    yPos += 10;

    // Disability Assessments (latest MIDAS / HIT-6)
    const latestMidas = latestAssessment('midas');
    const latestHit6 = latestAssessment('hit6');
    if (latestMidas || latestHit6) {
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Disability Assessments', 20, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        if (latestMidas) {
            const g = midasGrade(latestMidas.score);
            doc.text(`MIDAS: ${latestMidas.score} (Grade ${g.grade} - ${g.label}), taken ${formatDate(new Date(latestMidas.date))}`, 20, yPos);
            yPos += 5;
        }
        if (latestHit6) {
            const g = hit6Grade(latestHit6.score);
            doc.text(`HIT-6: ${latestHit6.score} (${g.label}), taken ${formatDate(new Date(latestHit6.date))}`, 20, yPos);
            yPos += 5;
        }
        yPos += 8;
    }

    // Menstrual migraine (only when the opt-in feature is enabled + data)
    if (cycleData.enabled && sortedPeriodStarts().length >= 2) {
        const starts = sortedPeriodStarts();
        const endDate = parseLocalDate(toLocalDateStr(new Date()));
        const corr = calculateMenstrualCorrelation(episodesInRange, starts[0], endDate);
        if (corr.level && corr.level !== 'insufficient') {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('Menstrual Migraine', 20, yPos);
            yPos += 6;
            doc.setFont(undefined, 'normal');
            const obs = Math.round(corr.observedShare * 100);
            const exp = Math.round(corr.expectedShare * 100);
            const verdict = corr.level === 'strong'
                ? 'Migraines cluster in the perimenstrual window (likely menstrually-related).'
                : corr.level === 'moderate'
                ? 'Some association between migraines and the perimenstrual window.'
                : 'No strong association between migraines and the perimenstrual window.';
            doc.splitTextToSize(`${verdict} ${obs}% of migraine days were perimenstrual (day -2 to +3) vs ${exp}% expected by chance; ${corr.migraineInWindow}/${corr.migraineDays} migraine days. Average cycle length ${averageCycleLength()} days.`, 170).forEach(line => {
                doc.text(line, 20, yPos);
                yPos += 5;
            });
            yPos += 8;
        }
    }

    // Pain Characteristics
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Pain Characteristics', 20, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');

    const avgPain = totalEpisodes > 0
        ? (episodesInRange.reduce((sum, m) => sum + m.painLevel, 0) / totalEpisodes).toFixed(1)
        : 0;
    const painInterpretation = avgPain >= 7 ? 'Severe' : avgPain >= 4 ? 'Moderate' : 'Mild';

    doc.text(`Average Pain Level: ${avgPain}/10 (${painInterpretation})`, 20, yPos);
    yPos += 5;

    const severeCount = episodesInRange.filter(m => m.painLevel >= 7).length;
    const moderateCount = episodesInRange.filter(m => m.painLevel >= 4 && m.painLevel < 7).length;
    const mildCount = episodesInRange.filter(m => m.painLevel < 4).length;

    doc.text(`Pain Distribution: Severe (${severeCount}), Moderate (${moderateCount}), Mild (${mildCount})`, 20, yPos);
    yPos += 10;

    // Duration Analysis
    doc.setFont(undefined, 'bold');
    doc.text('Duration Analysis', 20, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');

    const avgDuration = totalEpisodes > 0
        ? episodesInRange.reduce((sum, m) => sum + (m.duration || 0), 0) / totalEpisodes
        : 0;

    const durations = episodesInRange.map(m => m.duration || 0).filter(d => d > 0);
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

    doc.text(`Average Duration: ${formatDuration(Math.floor(avgDuration))}`, 20, yPos);
    yPos += 5;
    doc.text(`Range: ${formatDuration(minDuration)} - ${formatDuration(maxDuration)}`, 20, yPos);
    yPos += 15;

    // Common pain locations summary
    const locationCounts = {};
    episodesInRange.forEach(m => {
        headZoneLabels(m.painLocations).forEach(label => {
            locationCounts[label] = (locationCounts[label] || 0) + 1;
        });
    });
    const rankedLocations = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]);
    if (rankedLocations.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('Common Pain Locations', 20, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        const locationSummary = rankedLocations
            .map(([label, count]) => `${label} (${count})`)
            .join(', ');
        doc.splitTextToSize(locationSummary, 170).forEach(line => {
            doc.text(line, 20, yPos);
            yPos += 5;
        });
        yPos += 10;
    }

    // Common warning signs (prodrome) summary
    const prodromeCounts = {};
    episodesInRange.forEach(m => {
        prodromeLabels(m.prodrome).forEach(label => {
            prodromeCounts[label] = (prodromeCounts[label] || 0) + 1;
        });
    });
    const rankedProdrome = Object.entries(prodromeCounts).sort((a, b) => b[1] - a[1]);
    if (rankedProdrome.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('Common Warning Signs (prodrome)', 20, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        const prodromeSummary = rankedProdrome
            .map(([label, count]) => `${label} (${count})`)
            .join(', ');
        doc.splitTextToSize(prodromeSummary, 170).forEach(line => {
            doc.text(line, 20, yPos);
            yPos += 5;
        });
        yPos += 10;
    }

    // Common Symptoms summary
    const symptomCounts = {};
    episodesInRange.forEach(m => {
        symptomLabels(m.symptoms).forEach(label => {
            symptomCounts[label] = (symptomCounts[label] || 0) + 1;
        });
    });
    const rankedSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]);
    if (rankedSymptoms.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('Common Symptoms', 20, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        const symptomSummary = rankedSymptoms
            .map(([label, count]) => `${label} (${count})`)
            .join(', ');
        const symptomSummaryLines = doc.splitTextToSize(symptomSummary, 170);
        symptomSummaryLines.forEach(line => {
            doc.text(line, 20, yPos);
            yPos += 5;
        });
        yPos += 10;
    }

    // Common Triggers summary
    const triggerCounts = {};
    episodesInRange.forEach(m => {
        triggerLabels(m.triggers).forEach(label => {
            triggerCounts[label] = (triggerCounts[label] || 0) + 1;
        });
    });
    const rankedTriggers = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]);
    if (rankedTriggers.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('Common Triggers', 20, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        const triggerSummary = rankedTriggers
            .map(([label, count]) => `${label} (${count})`)
            .join(', ');
        const triggerSummaryLines = doc.splitTextToSize(triggerSummary, 170);
        triggerSummaryLines.forEach(line => {
            doc.text(line, 20, yPos);
            yPos += 5;
        });
        yPos += 10;
    }

    // Common after-effects (postdrome) summary
    const postdromeCounts = {};
    episodesInRange.forEach(m => {
        postdromeLabels(m.postdrome).forEach(label => {
            postdromeCounts[label] = (postdromeCounts[label] || 0) + 1;
        });
    });
    const rankedPostdrome = Object.entries(postdromeCounts).sort((a, b) => b[1] - a[1]);
    if (rankedPostdrome.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('Common After-effects (postdrome)', 20, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        const postdromeSummary = rankedPostdrome
            .map(([label, count]) => `${label} (${count})`)
            .join(', ');
        doc.splitTextToSize(postdromeSummary, 170).forEach(line => {
            doc.text(line, 20, yPos);
            yPos += 5;
        });
        yPos += 10;
    }

    // Weather Correlation (if enabled)
    if (weatherData.enabled && weatherData.history.length >= 7) {
        const correlation = calculateWeatherCorrelation();

        if (correlation) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('Weather Sensitivity Analysis', 20, yPos);
            yPos += 6;
            doc.setFont(undefined, 'normal');

            const strengthText = correlation.level === 'strong' ? 'Strong Correlation' :
                               correlation.level === 'moderate' ? 'Moderate Correlation' :
                               'Weak Correlation';

            doc.text(`Barometric Pressure Correlation: ${correlation.percentage.toFixed(0)}% (${strengthText})`, 20, yPos);
            yPos += 5;
            doc.text(`Significant Pressure Changes: ${correlation.significantChangeDays} days (>5 hPa in 24h)`, 20, yPos);
            yPos += 5;
            doc.text(`Migraines on Change Days: ${correlation.migrainesOnChangeDays} days`, 20, yPos);
            yPos += 5;

            doc.setFontSize(9);
            doc.setFont(undefined, 'italic');
            let clinicalNote = '';
            if (correlation.level === 'strong') {
                clinicalNote = 'Clinical note: Strong weather sensitivity detected. Consider preventive measures before significant pressure changes.';
            } else if (correlation.level === 'moderate') {
                clinicalNote = 'Clinical note: Moderate weather sensitivity. May benefit from monitoring pressure changes.';
            } else {
                clinicalNote = 'Clinical note: Low weather correlation. Other triggers may be more significant.';
            }
            doc.text(clinicalNote, 20, yPos);
            yPos += 10;
        }
    }

    // Episode Details
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Episode Details', 20, yPos);
    yPos += 8;

    if (totalEpisodes === 0) {
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text('No episodes recorded in this date range.', 20, yPos);
    } else {
        // Table header
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('Date', 20, yPos);
        doc.text('Time', 50, yPos);
        doc.text('Pain', 75, yPos);
        doc.text('Duration', 95, yPos);
        doc.text('Medication', 125, yPos);
        yPos += 5;

        // Line under header
        doc.line(20, yPos, 190, yPos);
        yPos += 5;

        // Episode rows
        doc.setFont(undefined, 'normal');
        const sortedEpisodes = [...episodesInRange].sort((a, b) =>
            new Date(b.startTime) - new Date(a.startTime)
        );

        for (const episode of sortedEpisodes) {
            // Check if we need a new page
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }

            const epStart = new Date(episode.startTime);
            const painStr = episode.painHistory && episode.painHistory.length > 1
                ? `${episode.painHistory[0].level}→${episode.painLevel}`
                : `${episode.painLevel}/10`;

            doc.text(formatDate(epStart), 20, yPos);
            doc.text(formatTime(epStart), 50, yPos);
            doc.text(painStr, 75, yPos);
            doc.text(formatDuration(episode.duration || 0), 95, yPos);

            const medText = episode.medication || 'None';
            const maxMedWidth = 65;
            if (doc.getTextWidth(medText) > maxMedWidth) {
                doc.text(medText.substring(0, 25) + '...', 125, yPos);
            } else {
                doc.text(medText, 125, yPos);
            }

            yPos += 5;

            // Add prodrome (warning signs) sub-line if present
            // Add pain location (with laterality) sub-line if present
            const epLocations = headZoneLabels(episode.painLocations);
            if (epLocations.length > 0) {
                const lat = deriveLaterality(episode.painLocations);
                doc.setFontSize(8);
                doc.setFont(undefined, 'italic');
                const locLines = doc.splitTextToSize(`Location: ${epLocations.join(', ')}${lat ? ` (${lat})` : ''}`, 170);
                for (const locLine of locLines) {
                    if (yPos > 275) { doc.addPage(); yPos = 20; }
                    doc.text(locLine, 25, yPos);
                    yPos += 4;
                }
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
            }

            // Add pain quality sub-line if present
            const epQuality = qualityLabels(episode.painQuality);
            if (epQuality.length > 0) {
                doc.setFontSize(8);
                doc.setFont(undefined, 'italic');
                const qualLines = doc.splitTextToSize(`Quality: ${epQuality.join(', ')}`, 170);
                for (const qualLine of qualLines) {
                    if (yPos > 275) { doc.addPage(); yPos = 20; }
                    doc.text(qualLine, 25, yPos);
                    yPos += 4;
                }
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
            }

            const epProdrome = prodromeLabels(episode.prodrome);
            if (epProdrome.length > 0) {
                doc.setFontSize(8);
                doc.setFont(undefined, 'italic');
                const proLines = doc.splitTextToSize(`Warning signs: ${epProdrome.join(', ')}`, 170);
                for (const proLine of proLines) {
                    if (yPos > 275) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.text(proLine, 25, yPos);
                    yPos += 4;
                }
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
            }

            // Add symptoms sub-line if present (page-break aware)
            const epSymptoms = symptomLabels(episode.symptoms);
            if (epSymptoms.length > 0) {
                doc.setFontSize(8);
                doc.setFont(undefined, 'italic');
                const symLines = doc.splitTextToSize(`Symptoms: ${epSymptoms.join(', ')}`, 170);
                for (const symLine of symLines) {
                    if (yPos > 275) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.text(symLine, 25, yPos);
                    yPos += 4;
                }
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
            }

            // Add triggers sub-line if present (page-break aware)
            const epTriggers = triggerLabels(episode.triggers);
            if (epTriggers.length > 0) {
                doc.setFontSize(8);
                doc.setFont(undefined, 'italic');
                const trigLines = doc.splitTextToSize(`Triggers: ${epTriggers.join(', ')}`, 170);
                for (const trigLine of trigLines) {
                    if (yPos > 275) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.text(trigLine, 25, yPos);
                    yPos += 4;
                }
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
            }

            // Add postdrome (after-effects) sub-line if present
            const epPostdrome = postdromeLabels(episode.postdrome);
            if (epPostdrome.length > 0) {
                doc.setFontSize(8);
                doc.setFont(undefined, 'italic');
                const postLines = doc.splitTextToSize(`After-effects: ${epPostdrome.join(', ')}`, 170);
                for (const postLine of postLines) {
                    if (yPos > 275) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.text(postLine, 25, yPos);
                    yPos += 4;
                }
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
            }

            // Add notes if present, breaking pages mid-note so long
            // notes can't run past the footer (drawn at y=285)
            if (episode.notes) {
                doc.setFontSize(8);
                doc.setFont(undefined, 'italic');
                const noteLines = doc.splitTextToSize(`Notes: ${episode.notes}`, 170);
                for (const noteLine of noteLines) {
                    if (yPos > 275) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.text(noteLine, 25, yPos);
                    yPos += 4;
                }
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
            }

            yPos += 2;
        }
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont(undefined, 'italic');
        doc.text(`Generated by Aiding Migraine on ${formatDate(new Date())}`, 105, 285, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
    }

    // Save PDF
    const startDateStr = formatDateFile(startDate);
    const endDateStr = formatDateFile(endDate);
    const filename = `migraine-report-${startDateStr}-to-${endDateStr}.pdf`;
    doc.save(filename);

    closeModal();
    showModal('PDF Exported', `Your migraine report has been saved as ${filename}`);
}

function showHowTo() {
    const content = `
        <h3>Logging Episodes</h3>
        <p>1. Select your pain level (0-10)</p>
        <p>2. Optionally add medication and notes</p>
        <p>3. Tap "Log migraine"</p>

        <h3>Active Episodes</h3>
        <p>• Update pain as it changes</p>
        <p>• End episode when resolved</p>
        <p>• Duration tracked automatically</p>

        <h3>Viewing History</h3>
        <p>• All episodes listed in History tab</p>
        <p>• Calendar shows severity by color</p>
        <p>• Stats dashboard shows trends</p>

        <h3>Backing Up Data</h3>
        <p>• Export regularly from Settings</p>
        <p>• Keep backup file safe</p>
        <p>• Import on new device</p>
    `;
    showModal('How to Use', content);
}

function showAbout() {
    const content = `
        <p><strong>Aiding Migraine v5.7.1</strong></p>
        <p>Built with care for migraine sufferers.</p>

        <h3>Features</h3>
        <ul>
            <li>Easy pain tracking</li>
            <li>Duration monitoring</li>
            <li>Pattern visualization</li>
            <li>Weather &amp; pressure tracking</li>
            <li>Medication management</li>
            <li>PDF &amp; CSV export</li>
            <li>Privacy-focused &amp; offline-first</li>
        </ul>

        <p style="margin-top: 20px; color: var(--text-secondary);">
            Created by someone who understands the struggle of managing migraines.
        </p>
    `;
    showModal('About This App', content);
}

function showPrivacy() {
    const content = `
        <h3>Your Privacy Matters</h3>

        <p><strong>Local by default</strong><br>
        Your migraine data is stored only on this device using browser storage. There is no account, no tracking, and no analytics.</p>

        <p><strong>You own your data</strong><br>
        Export anytime, delete anytime.</p>

        <h3>Optional features that use the network</h3>
        <p>Two features are off by default and only send data if you turn them on:</p>
        <ul>
            <li><strong>Weather tracking:</strong> sends your location (city/ZIP you enter, or GPS coordinates if you allow them) to Open-Meteo (weather data) and Nominatim/OpenStreetMap (location lookup). Your migraine data is never sent.</li>
            <li><strong>Push notifications:</strong> sends your push subscription, timezone, notification schedule, and attack-onset timestamps (used to time follow-up reminders) to this project's notification server. No pain levels, notes, medications, or other health details are sent.</li>
        </ul>
        <p>Turning these features off stops all network activity. Everything else stays on your device.</p>

        <h3>At-rest encryption</h3>
        <p>Optional and off by default. When you turn on <strong>"Encrypt my data"</strong> in Settings, your health data (episodes, cycle data, assessments, medications) is encrypted on this device with <strong>AES-256</strong>, using a key derived from your passphrase that never leaves your device. We can't read it, and <strong>there is no recovery if you forget the passphrase</strong> — so keep an unencrypted JSON backup somewhere safe.</p>

        <h3>Menstrual cycle tracking</h3>
        <p>Optional and off by default. If you turn it on, the period start dates you log are stored <strong>on this device only and are never sent anywhere</strong> — the menstrual-migraine pattern is calculated locally. It's included in your own JSON backups and, if you choose, your PDF doctor report.</p>

        <h3>Backup Recommendation</h3>
        <p>Export your data regularly to prevent loss if you clear browser data.</p>

        <p style="margin-top: 20px; color: var(--text-secondary); font-size: 0.9rem;">
            <strong>Note:</strong> This app is not HIPAA compliant and should not be used for official medical records. Always consult healthcare providers.
        </p>
    `;
    showModal('Privacy & Your Data', content);
}

function clearAllData() {
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = 'Delete All Data?';
    document.getElementById('modal-body').innerHTML = `
        <p><strong>This will permanently delete ALL ${migraines.length} episodes and cannot be undone.</strong></p>
        <p style="margin-top: 12px;">We recommend exporting a backup first.</p>
    `;
    document.getElementById('modal-actions').innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-secondary" onclick="exportJSON(); closeModal();">Export First</button>
        <button class="btn btn-danger" onclick="confirmClearAll()">Delete All</button>
    `;
    openDialog(modal);
}

async function confirmClearAll() {
    migraines = [];
    activeMigraine = null;
    localStorage.clear();

    // Clear every IndexedDB store so nothing resurrects on reload
    if (useIndexedDB && db) {
        for (const store of Object.values(DB_STORES)) {
            try {
                await IDB.clear(store);
            } catch (error) {
                console.error('[ERROR] Failed to clear store:', store, error);
            }
        }
    }

    await saveData();
    renderHistory();
    updateDashboard();
    renderCalendar();
    updateStorageInfo();
    checkActiveMigraine();

    closeModal();
    showModal('Data Cleared', 'All data has been deleted.');
}

// Runs `task` with `el` shown as busy. Yields two frames first so the
// browser paints the busy state before any synchronous work begins —
// without that, a blocking task freezes the UI while the button still
// looks idle.
async function withBusy(el, label, task) {
    if (!el) return task();
    const prevHTML = el.innerHTML;
    const prevDisabled = el.disabled;
    el.disabled = true;
    el.setAttribute('aria-busy', 'true');
    el.innerHTML = safeHTML(`<span class="btn-spinner" aria-hidden="true"></span>${safeText(label)}`);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
        return await task();
    } finally {
        el.disabled = prevDisabled;
        el.removeAttribute('aria-busy');
        el.innerHTML = prevHTML;
    }
}

function showModal(title, content, actions) {
    document.getElementById('modal-title').textContent = title;
    // All modal content is sanitized; interactive elements inside the
    // body use data-* attributes with delegated listeners
    document.getElementById('modal-body').innerHTML = safeHTML(content);

    const actionsEl = document.getElementById('modal-actions');
    actionsEl.textContent = '';
    const buttons = (Array.isArray(actions) && actions.length > 0)
        ? actions
        : [{ text: 'Close', class: 'btn-primary', action: closeModal }];
    for (const buttonDef of buttons) {
        const btn = document.createElement('button');
        btn.className = `btn ${buttonDef.class || 'btn-primary'}`;
        btn.textContent = buttonDef.text;
        btn.addEventListener('click', buttonDef.action);
        actionsEl.appendChild(btn);
    }

    openDialog(document.getElementById('modal'));
}

function closeModal() {
    closeDialog(document.getElementById('modal'));
}

// === TOASTS + IN-APP CONFIRM ===
// The app previously reported success and failure through native
// alert()/confirm(), which block the page and, in an installed PWA,
// appear as system sheets. These are announced through a polite live
// region instead, so screen-reader users hear them without the app
// stealing focus.
function showToast(message, { type = 'success', duration = 4000 } = {}) {
    const region = document.getElementById('toast-region');
    if (!region) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? '' : type}`.trim();

    const text = document.createElement('div');
    text.className = 'toast-text';
    text.textContent = message;
    toast.appendChild(text);

    const dismiss = document.createElement('button');
    dismiss.className = 'toast-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss message');
    dismiss.innerHTML = safeHTML('<svg class="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true">' +
        '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>');
    const remove = () => { if (toast.parentNode) toast.remove(); };
    dismiss.addEventListener('click', remove);
    toast.appendChild(dismiss);

    region.appendChild(toast);
    // Errors stay until dismissed; confirmations clear themselves.
    if (type !== 'error' && duration > 0) setTimeout(remove, duration);
    return toast;
}

// Promise-based replacement for confirm(), using the app's own dialog
// so it inherits the focus trap and Escape handling.
function confirmAction(title, message, { confirmText = 'Confirm', danger = false } = {}) {
    return new Promise(resolve => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            closeModal();
            resolve(value);
        };
        showModal(title, `<p>${safeText(message)}</p>`, [
            { text: 'Cancel', class: 'btn-secondary', action: () => finish(false) },
            { text: confirmText, class: danger ? 'btn-danger' : 'btn-primary', action: () => finish(true) }
        ]);
        // Escape and the backdrop resolve as a cancel rather than
        // leaving the caller waiting forever.
        const modal = document.getElementById('modal');
        const observer = new MutationObserver(() => {
            if (!modal.classList.contains('active')) {
                observer.disconnect();
                if (!settled) { settled = true; resolve(false); }
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });
}

// === DIALOG FOCUS MANAGEMENT ===
// Shared by the main modal, the debug modal and the lock screen. Before
// this, opening a dialog left focus behind it, Tab walked straight into
// the page underneath, and no dialog anywhere in the app closed on
// Escape.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), ' +
                  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let openDialogs = [];

function focusablesIn(dialog) {
    return [...dialog.querySelectorAll(FOCUSABLE)]
        .filter(el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
}

function openDialog(dialog, { activate = true } = {}) {
    if (!dialog) return;
    if (!openDialogs.some(d => d.dialog === dialog)) {
        openDialogs.push({ dialog, returnFocus: document.activeElement });
    }
    if (activate) dialog.classList.add('active');
    // Move focus in so the dialog is where the keyboard actually is.
    const targets = focusablesIn(dialog);
    const first = targets.find(el => !el.classList.contains('modal-close')) || targets[0];
    if (first) {
        first.focus();
    } else {
        dialog.setAttribute('tabindex', '-1');
        dialog.focus();
    }
}

function closeDialog(dialog, { deactivate = true } = {}) {
    if (!dialog) return;
    if (deactivate) dialog.classList.remove('active');
    const idx = openDialogs.findIndex(d => d.dialog === dialog);
    if (idx === -1) return;
    const { returnFocus } = openDialogs[idx];
    openDialogs.splice(idx, 1);
    // Send focus back where it came from, so a keyboard user resumes
    // from the control they activated rather than the top of the page.
    if (returnFocus && document.contains(returnFocus) && returnFocus.focus) {
        returnFocus.focus();
    }
}

function topDialog() {
    return openDialogs.length ? openDialogs[openDialogs.length - 1].dialog : null;
}

document.addEventListener('keydown', (e) => {
    const dialog = topDialog();
    if (!dialog) return;

    if (e.key === 'Escape') {
        // The lock screen is a gate, not a dismissible dialog.
        if (dialog.id === 'lock-screen') return;
        e.preventDefault();
        if (dialog.id === 'debug-modal') { closeDebugModal(); return; }
        closeModal();
        return;
    }

    if (e.key !== 'Tab') return;
    const targets = focusablesIn(dialog);
    if (!targets.length) return;
    const first = targets[0], last = targets[targets.length - 1];
    // Keep Tab inside the dialog instead of letting it walk the page behind.
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
});

// Delegated handler for interactive elements inside sanitized modal
// bodies (e.g. calendar day-details Edit buttons)
document.getElementById('modal-body').addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-attack]');
    if (editBtn) {
        const raw = editBtn.dataset.editAttack;
        editEpisode(isNaN(Number(raw)) ? raw : Number(raw));
    }
});

function showWelcomeModal() {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    const actions = document.getElementById('modal-actions');

    body.innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
            <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 56px; height: 56px; margin-bottom: 20px; stroke: var(--accent-green); fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round;">
                <path d="M12 21a9 9 0 1 1 9-9c0 2.5-1.5 3.5-3 3.5s-2-1-3-1-1.5 1-1.5 2.5A4 4 0 0 1 12 21z"></path>
            </svg>
            <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
                Your personal migraine tracking companion. Log episodes, track patterns,
                and generate professional reports for your healthcare provider.
            </p>
            <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 20px; margin: 24px 0; text-align: left;">
                <h3 style="font-size: 1.1rem; margin-bottom: 12px; text-align: center;">Key features</h3>
                <ul style="list-style: none; padding: 0; color: var(--text-secondary); line-height: 2;">
                    <li><strong>Easy Logging:</strong> Track pain levels, duration, and medications</li>
                    <li><strong>Visual History:</strong> Calendar view and detailed statistics</li>
                    <li><strong>PDF Reports:</strong> Professional reports for doctor visits</li>
                    <li><strong>Secure Backup:</strong> Import/export your data safely</li>
                    <li><strong>Smart Recovery:</strong> 30-day trash for deleted episodes</li>
                </ul>
            </div>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 16px;">
                Your data stays on your device by default. Optional weather and notification features send only the minimum needed (location or notification schedule) - see Privacy in Settings for details.
            </p>
        </div>
    `;

    actions.innerHTML = `
        <button class="btn btn-secondary" onclick="closeWelcome()">Get Started</button>
        <button class="btn btn-primary" onclick="startGuidedTour()">Take a Tour</button>
    `;

    document.getElementById('modal-title').textContent = 'Welcome to Aiding Migraine';
    openDialog(modal);
}

function closeWelcome() {
    localStorage.setItem('hasSeenWelcome', 'true');
    closeModal();
}

let tourStep = 0;
const tourSteps = [
    {
        title: 'Log a Migraine Episode',
        description: 'Tap Start migraine to save the start time. Add pain, medication, or details whenever you can.',
        target: '#start-attack-btn',
        page: 'log',
        position: 'bottom'
    },
    {
        title: 'Episode History',
        description: 'View all your past episodes here. You can edit notes, view details, or delete episodes. Deleted episodes go to trash for 30 days.',
        target: '#history-list',
        page: 'history',
        position: 'top'
    },
    {
        title: 'Calendar View',
        description: 'History shows your migraine days over time. Click any day to see episodes logged that day.',
        target: '#calendar-grid',
        page: 'log',
        position: 'top'
    },
    {
        title: 'Export & Backup',
        description: 'Export your data as PDF for doctor visits or JSON for backups. You can also import data to restore or merge from another device.',
        target: '#data-management-section',
        page: 'settings',
        position: 'top'
    },
    {
        title: 'Your Data is Private',
        description: 'Everything is stored locally on your device. No data is sent to any server. Remember to export backups regularly!',
        target: '#privacy-btn',
        page: 'settings',
        position: 'center'
    }
];

function startGuidedTour() {
    localStorage.setItem('hasSeenWelcome', 'true');
    closeModal();
    tourStep = 0;
    // Add a delay to ensure modal is fully closed
    setTimeout(() => {
        showTourStep();
    }, 300);
}

function showTourStep() {
    const step = tourSteps[tourStep];

    // Switch to the required page
    if (step.page !== currentPage) {
        showPage(step.page);
    }

    // Wait for page to render before showing tooltip
    setTimeout(() => {
        // Remove any existing tour elements
        const oldOverlay = document.getElementById('tour-overlay');
        const oldTooltip = document.getElementById('tour-tooltip');
        if (oldOverlay) oldOverlay.remove();
        if (oldTooltip) oldTooltip.remove();

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'tour-overlay';
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.75) !important;
            z-index: 9998 !important;
            display: block !important;
        `;
        document.body.appendChild(overlay);

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.id = 'tour-tooltip';
        tooltip.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: var(--bg-secondary) !important;
            border: 2px solid var(--accent-blue) !important;
            border-radius: 12px !important;
            padding: 24px !important;
            max-width: 400px !important;
            width: 90% !important;
            z-index: 9999 !important;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
            display: block !important;
            visibility: visible !important;
        `;

        tooltip.innerHTML = `
            <div style="margin-bottom: 8px; color: var(--accent-blue); font-size: 0.9rem; font-weight: 600;">
                Step ${tourStep + 1} of ${tourSteps.length}
            </div>
            <h3 style="margin-bottom: 12px; font-size: 1.3rem;">${step.title}</h3>
            <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px;">
                ${step.description}
            </p>
            <div style="display: flex; gap: 12px; justify-content: space-between;">
                <button class="btn btn-secondary" onclick="skipTour()" style="flex: 1;">
                    Skip Tour
                </button>
                <button class="btn btn-primary" onclick="nextTourStep()" style="flex: 1;">
                    ${tourStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
                </button>
            </div>
        `;

        document.body.appendChild(tooltip);

        // Highlight the target element if it exists
        if (step.target) {
            const targetEl = document.querySelector(step.target);
            if (targetEl) {
                targetEl.style.position = 'relative';
                targetEl.style.zIndex = '9999';
                targetEl.style.boxShadow = '0 0 0 4px var(--accent-blue), 0 0 20px rgba(107, 139, 184, 0.5)';
                targetEl.style.borderRadius = '8px';
                targetEl.setAttribute('data-tour-highlight', 'true');
            }
        }
    }, 300);
}

function nextTourStep() {
    // Remove highlight from previous step
    const highlighted = document.querySelector('[data-tour-highlight]');
    if (highlighted) {
        highlighted.style.position = '';
        highlighted.style.zIndex = '';
        highlighted.style.boxShadow = '';
        highlighted.style.borderRadius = '';
        highlighted.removeAttribute('data-tour-highlight');
    }

    tourStep++;
    if (tourStep < tourSteps.length) {
        showTourStep();
    } else {
        endTour();
    }
}

function skipTour() {
    endTour();
}

function endTour() {
    // Remove highlight
    const highlighted = document.querySelector('[data-tour-highlight]');
    if (highlighted) {
        highlighted.style.position = '';
        highlighted.style.zIndex = '';
        highlighted.style.boxShadow = '';
        highlighted.style.borderRadius = '';
        highlighted.removeAttribute('data-tour-highlight');
    }

    // Remove overlay and tooltip
    const overlay = document.getElementById('tour-overlay');
    const tooltip = document.getElementById('tour-tooltip');
    if (overlay) overlay.remove();
    if (tooltip) tooltip.remove();

    tourStep = 0;
}

document.querySelector('.modal-close').addEventListener('click', closeModal);

document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
        closeModal();
    }
});

function getPainCategory(level) {
    if (level == null || isNaN(level)) return null;
    if (level <= 3) return 'Mild';
    if (level <= 6) return 'Moderate';
    return 'Severe';
}

function getPainProgression(migraine) {
    if (!migraine.painHistory || migraine.painHistory.length <= 1) {
        return `${migraine.painLevel}/10`;
    }

    const first = migraine.painHistory[0].level;
    const last = migraine.painHistory[migraine.painHistory.length - 1].level;

    if (last < first) {
        return `${first} → ${last} ↓ Improving`;
    } else if (last > first) {
        return `${first} → ${last} ↑ Worsening`;
    } else {
        return `${first} → Stable`;
    }
}

function formatDuration(seconds) {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
}

function formatDateFile(date) {
    return date.toISOString().split('T')[0];
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(date);
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

let notificationPreferences = {
    enabled: false,
    dailyCheckIn: {
        enabled: true,
        time: '19:00',
        frequency: 'daily'
    },
    activeAttackCheckIn: {
        enabled: true,
        delayHours: 2
    },
    postAttackFollowUp: {
        enabled: true,
        delayHours: 2
    },
    pushSubscription: null
};

async function initializeNotifications() {
    loadNotificationPreferences();
    // Deep-link handling runs later in initApp, after the default page
    // is shown (see handleNotificationDeepLink call there).

    // Attempt to update notification UI early (will succeed once settings page elements are available)
    await updateNotificationUI();
}

// Set up notification UI (called when settings page is shown)
let notificationUIInitialized = false;
async function setupNotificationUI() {
    console.log('[DEBUG] Setting up Notification UI...');

    // Always update UI state when settings page is shown
    await updateNotificationUI();

    // If already initialized, skip event listener setup
    if (notificationUIInitialized) {
        console.log('[SUCCESS] Notification UI already initialized (skipping event listeners)');
        return;
    }

    // Event listeners - check if elements exist
    const enableBtn = document.getElementById('enable-notifications-btn');
    const disableBtn = document.getElementById('disable-notifications-btn');
    const testBtn = document.getElementById('test-notification-btn');

    if (!enableBtn || !disableBtn || !testBtn) {
        console.warn('[WARNING] Notification UI elements not found, will retry on next settings page visit');
        return;
    }

    enableBtn.addEventListener('click', enableNotifications);
    disableBtn.addEventListener('click', disableNotifications);
    testBtn.addEventListener('click', sendTestNotification);

    // Preference change listeners
    const dailyEnabled = document.getElementById('daily-checkin-enabled');
    const dailyTime = document.getElementById('daily-checkin-time');
    const dailyFreq = document.getElementById('daily-checkin-frequency');
    const activeEnabled = document.getElementById('active-checkin-enabled');
    const activeDelay = document.getElementById('active-checkin-delay');
    const followupEnabled = document.getElementById('followup-enabled');
    const followupDelay = document.getElementById('followup-delay');

    if (dailyEnabled) dailyEnabled.addEventListener('change', saveNotificationPreferences);
    if (dailyTime) dailyTime.addEventListener('change', saveNotificationPreferences);
    if (dailyFreq) dailyFreq.addEventListener('change', saveNotificationPreferences);
    if (activeEnabled) activeEnabled.addEventListener('change', saveNotificationPreferences);
    if (activeDelay) activeDelay.addEventListener('change', saveNotificationPreferences);
    if (followupEnabled) followupEnabled.addEventListener('change', saveNotificationPreferences);
    if (followupDelay) followupDelay.addEventListener('change', saveNotificationPreferences);

    notificationUIInitialized = true;
    console.log('[SUCCESS] Notification UI initialized successfully');
}

function loadNotificationPreferences() {
    const stored = localStorage.getItem('notificationPreferences');
    if (stored) {
        // A corrupt value must not break notification init (and with
        // it, app startup) - fall back to defaults instead
        try {
            notificationPreferences = JSON.parse(stored);
        } catch (error) {
            console.error('[ERROR] Corrupt notificationPreferences, resetting to defaults:', error);
            localStorage.removeItem('notificationPreferences');
            return;
        }

        // Migrate old preferences (add activeAttackCheckIn if missing)
        if (!notificationPreferences.activeAttackCheckIn) {
            notificationPreferences.activeAttackCheckIn = {
                enabled: true,
                delayHours: 2
            };
            localStorage.setItem('notificationPreferences', JSON.stringify(notificationPreferences));
        }

        // Update UI with stored values (only if elements exist)
        const dailyEnabled = document.getElementById('daily-checkin-enabled');
        if (dailyEnabled) {
            dailyEnabled.checked = notificationPreferences.dailyCheckIn.enabled;
            document.getElementById('daily-checkin-time').value = notificationPreferences.dailyCheckIn.time;
            document.getElementById('daily-checkin-frequency').value = notificationPreferences.dailyCheckIn.frequency;
            document.getElementById('active-checkin-enabled').checked = notificationPreferences.activeAttackCheckIn.enabled;
            document.getElementById('active-checkin-delay').value = notificationPreferences.activeAttackCheckIn.delayHours;
            document.getElementById('followup-enabled').checked = notificationPreferences.postAttackFollowUp.enabled;
            document.getElementById('followup-delay').value = notificationPreferences.postAttackFollowUp.delayHours;
        }
    }
}

function saveNotificationPreferences() {
    notificationPreferences.dailyCheckIn.enabled = document.getElementById('daily-checkin-enabled').checked;
    notificationPreferences.dailyCheckIn.time = document.getElementById('daily-checkin-time').value;
    notificationPreferences.dailyCheckIn.frequency = document.getElementById('daily-checkin-frequency').value;
    notificationPreferences.activeAttackCheckIn.enabled = document.getElementById('active-checkin-enabled').checked;
    notificationPreferences.activeAttackCheckIn.delayHours = parseInt(document.getElementById('active-checkin-delay').value);
    notificationPreferences.postAttackFollowUp.enabled = document.getElementById('followup-enabled').checked;
    notificationPreferences.postAttackFollowUp.delayHours = parseInt(document.getElementById('followup-delay').value);

    // Convert local time to UTC for server synchronization
    const localTime = notificationPreferences.dailyCheckIn.time;
    const utcData = convertLocalTimeToUTC(localTime);

    // Store UTC time data for server sync
    notificationPreferences.dailyCheckIn.utcHour = utcData.utcHour;
    notificationPreferences.dailyCheckIn.utcMinutes = utcData.utcMinutes;
    notificationPreferences.dailyCheckIn.utcTime = utcData.utcTime;
    notificationPreferences.dailyCheckIn.timezone = utcData.timezone;

    console.log(`Daily check-in set for ${localTime} local (${utcData.utcTime} UTC) in timezone ${utcData.timezone}`);

    localStorage.setItem('notificationPreferences', JSON.stringify(notificationPreferences));

    // Sync with server if notifications are enabled
    if (notificationPreferences.enabled && notificationPreferences.pushSubscription) {
        syncPreferencesWithServer();
    }
}

async function updateNotificationUI() {
    const statusText = document.getElementById('notification-status-text');
    const enableSection = document.getElementById('notification-enable-section');
    const preferencesSection = document.getElementById('notification-preferences');
    const iosPrompt = document.getElementById('ios-install-prompt');

    // Check if elements exist before updating (settings page might not be loaded yet)
    if (!statusText || !enableSection || !preferencesSection || !iosPrompt) {
        console.log('[PENDING] Notification UI elements not yet available, will update when settings page is shown');
        return;
    }

    // Check if notifications are supported
    if (!('Notification' in window)) {
        statusText.innerHTML = 'Notifications not supported on this browser';
        statusText.parentElement.style.background = 'var(--accent-red)';
        statusText.parentElement.style.color = 'white';
        return;
    }

    // Check iOS installation status
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS && !isInstalled) {
        statusText.innerHTML = 'Please install app to home screen';
        statusText.parentElement.style.background = 'var(--accent-blue)';
        statusText.parentElement.style.color = 'white';
        iosPrompt.style.display = 'block';
        return;
    } else {
        iosPrompt.style.display = 'none';
    }

    // Check permission status
    const permission = Notification.permission;

    if (permission === 'granted') {
        // Check if we have a valid subscription
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription && notificationPreferences.enabled) {
            statusText.innerHTML = ' Notifications enabled';
            statusText.parentElement.style.background = 'var(--accent-green)';
            statusText.parentElement.style.color = 'white';
            enableSection.style.display = 'none';
            preferencesSection.style.display = 'block';
        } else {
            statusText.innerHTML = 'Permission granted - click to enable';
            statusText.parentElement.style.background = 'var(--bg-tertiary)';
            enableSection.style.display = 'block';
            preferencesSection.style.display = 'none';
        }
    } else if (permission === 'denied') {
        statusText.innerHTML = 'Notifications blocked - Check browser settings';
        statusText.parentElement.style.background = 'var(--accent-red)';
        statusText.parentElement.style.color = 'white';
        enableSection.style.display = 'none';
        preferencesSection.style.display = 'none';
    } else {
        statusText.innerHTML = 'Click below to enable notifications';
        statusText.parentElement.style.background = 'var(--bg-tertiary)';
        enableSection.style.display = 'block';
        preferencesSection.style.display = 'none';
    }
}

async function enableNotifications() {
    try {
        // Request permission
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            showToast('Notifications are blocked. You can allow them in your browser settings for this site.', { type: 'warning', duration: 7000 });
            updateNotificationUI();
            return;
        }

        // Get service worker registration
        const registration = await navigator.serviceWorker.ready;

        // VAPID Public Key for push notifications (UPDATED: 2026-01-23)
        const VAPID_PUBLIC_KEY = 'BKGl5RP_08pVrtXyh08ot_AdICyshiLpiOBLYr1eLRXQFP_pcqGqZOxoMMfPm_09ecr_EKgwqmE5Hac0Lb0G1WU';

        // Check if VAPID key is configured
        if (VAPID_PUBLIC_KEY === 'YOUR_VAPID_PUBLIC_KEY_HERE') {
            // Server not configured yet - use local notifications only
            notificationPreferences.enabled = true;
            localStorage.setItem('notificationPreferences', JSON.stringify(notificationPreferences));
            showToast('Notifications are on for this device. Reminders will only arrive while the app is open.', { duration: 6000 });
            updateNotificationUI();
            return;
        }

        // Subscribe to push notifications with VAPID key
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        // Convert local time to UTC for server synchronization
        const localTime = notificationPreferences.dailyCheckIn.time;
        const utcData = convertLocalTimeToUTC(localTime);

        // Store UTC time data
        notificationPreferences.dailyCheckIn.utcHour = utcData.utcHour;
        notificationPreferences.dailyCheckIn.utcMinutes = utcData.utcMinutes;
        notificationPreferences.dailyCheckIn.utcTime = utcData.utcTime;
        notificationPreferences.dailyCheckIn.timezone = utcData.timezone;

        console.log(`Daily check-in set for ${localTime} local (${utcData.utcTime} UTC) in timezone ${utcData.timezone}`);

        // Send subscription to server
        const SERVER_URL = 'https://aiding-migraine-notifications.onrender.com';
        const response = await fetch(`${SERVER_URL}/api/subscriptions/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription: subscription,
                preferences: {
                    dailyCheckIn: {
                        ...notificationPreferences.dailyCheckIn,
                        time: localTime,  // Keep local time for reference
                        utcHour: utcData.utcHour,
                        utcMinutes: utcData.utcMinutes,
                        utcTime: utcData.utcTime,
                        timezone: utcData.timezone
                    },
                    postAttackFollowUp: notificationPreferences.postAttackFollowUp
                }
            })
        });

        if (!response.ok) {
            throw new Error('Failed to subscribe on server');
        }

        // Save subscription locally
        notificationPreferences.enabled = true;
        notificationPreferences.pushSubscription = subscription.toJSON();
        localStorage.setItem('notificationPreferences', JSON.stringify(notificationPreferences));

        showToast('Notifications are on. You will get daily check-ins and follow-ups after an attack.', { duration: 6000 });
        updateNotificationUI();

    } catch (error) {
        console.error('Error enabling notifications:', error);
        showToast('Notifications could not be turned on. Please try again.', { type: 'error' });
    }
}

// Helper function to convert VAPID key from Base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Get user's timezone
function getUserTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
        console.error('Error getting timezone:', e);
        return 'UTC';
    }
}

// Convert local time (HH:MM) to UTC hour
function convertLocalTimeToUTC(localTime) {
    // localTime format: "HH:MM" (e.g., "15:00")
    const [hours, minutes] = localTime.split(':').map(Number);

    // Create a date object for today at the specified local time
    const now = new Date();
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    // Get UTC hour
    const utcHour = localDate.getUTCHours();
    const utcMinutes = localDate.getUTCMinutes();

    return {
        utcHour: utcHour,
        utcMinutes: utcMinutes,
        utcTime: `${String(utcHour).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`,
        timezone: getUserTimezone(),
        timezoneOffset: -localDate.getTimezoneOffset() // offset in minutes
    };
}

async function disableNotifications() {
    const confirmed = await confirmAction(
        'Turn off notifications',
        'You will stop receiving daily check-ins and follow-ups after an attack.',
        { confirmText: 'Turn off', danger: true }
    );
    if (!confirmed) return;

    try {
        // Unsubscribe from push notifications if subscribed
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();
        }

        notificationPreferences.enabled = false;
        notificationPreferences.pushSubscription = null;
        localStorage.setItem('notificationPreferences', JSON.stringify(notificationPreferences));

        showToast('Notifications are off.');
        updateNotificationUI();

    } catch (error) {
        console.error('Error disabling notifications:', error);
        showToast('Notifications could not be turned off. Please try again.', { type: 'error' });
    }
}

async function sendTestNotification() {
    if (Notification.permission !== 'granted') {
        showToast('Turn notifications on first, then send a test.', { type: 'warning' });
        return;
    }

    try {
        // Send a local notification for testing
        const registration = await navigator.serviceWorker.ready;

        registration.showNotification('Aiding Migraine', {
            body: 'Test notification - Your notification system is working.',
            icon: './icons/icon-192x192.png',
            badge: './icons/icon-72x72.png',
            tag: 'test-notification',
            requireInteraction: false,
            vibrate: [200, 100, 200]
        });

    } catch (error) {
        console.error('Error sending test notification:', error);
        showToast('The test notification could not be sent.', { type: 'error' });
    }
}

function handleNotificationDeepLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const attackId = urlParams.get('attackId');

    if (!action) return;

    if (action === 'log') {
        showPage('log');
    } else if (action === 'analytics') {
        showPage('analytics');
    } else if (action === 'care') {
        showPage('care');
    } else if (action === 'update' && attackId) {
        // Find and show the attack for updating
        const episodeId = getNotificationEpisodeId(attackId);
        const attack = migraines.find(m => episodeIdMatches(m, episodeId)) ||
            (episodeIdMatches(activeMigraine, episodeId) ? activeMigraine : null);
        if (attack) {
            showPage('history');
            setTimeout(() => {
                editEpisode(attack.id);
            }, 500);
        }
    }

    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
}

async function syncPreferencesWithServer() {
    // Sync preferences with the notification server
    if (!notificationPreferences.pushSubscription) {
        console.log('No push subscription - server sync skipped');
        return;
    }

    try {
        const SERVER_URL = 'https://aiding-migraine-notifications.onrender.com';
        const response = await fetch(`${SERVER_URL}/api/subscriptions/update-preferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: notificationPreferences.pushSubscription.endpoint,
                preferences: {
                    dailyCheckIn: notificationPreferences.dailyCheckIn,
                    postAttackFollowUp: notificationPreferences.postAttackFollowUp
                }
            })
        });

        if (response.ok) {
            console.log('[SUCCESS] Preferences synced with server');
        } else {
            console.error('Failed to sync preferences with server');
        }
    } catch (error) {
        console.error('Error syncing preferences:', error);
    }
}

// Schedule post-attack follow-up notification
async function schedulePostAttackFollowUp(attackId) {
    if (!notificationPreferences.enabled || !notificationPreferences.postAttackFollowUp.enabled) {
        return;
    }

    const delayMs = notificationPreferences.postAttackFollowUp.delayHours * 60 * 60 * 1000;
    const followUpTime = new Date(Date.now() + delayMs);

    // Delivery is handled entirely by the notification server; the
    // old local 'scheduledNotifications' store was write-only and
    // grew without bound, so it has been removed.

    // Send to server if push subscription exists
    if (notificationPreferences.pushSubscription) {
        try {
            const SERVER_URL = 'https://aiding-migraine-notifications.onrender.com';
            const response = await fetch(`${SERVER_URL}/api/notifications/schedule-followup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attackId: attackId,
                    followUpTime: followUpTime.toISOString(),
                    subscriptionEndpoint: notificationPreferences.pushSubscription.endpoint
                })
            });

            if (response.ok) {
                console.log('[SUCCESS] Follow-up scheduled on server');
            } else {
                console.error('Failed to schedule follow-up on server');
            }
        } catch (error) {
            console.error('Error scheduling follow-up:', error);
        }
    }
}

async function scheduleActiveAttackCheckIn(attackId) {
    if (!notificationPreferences.enabled || !notificationPreferences.activeAttackCheckIn.enabled) {
        return;
    }

    const delayHours = notificationPreferences.activeAttackCheckIn.delayHours;

    // Schedule multiple recurring check-ins (up to 24 hours worth).
    // Delivery is server-side only; no local queue is kept.
    const maxCheckIns = Math.floor(24 / delayHours); // e.g., if delayHours=2, schedule 12 check-ins

    for (let i = 1; i <= maxCheckIns; i++) {
        const delayMs = delayHours * i * 60 * 60 * 1000;
        const checkInTime = new Date(Date.now() + delayMs);

        // Send to server if push subscription exists
        if (notificationPreferences.pushSubscription) {
            try {
                const SERVER_URL = 'https://aiding-migraine-notifications.onrender.com';
                const response = await fetch(`${SERVER_URL}/api/notifications/schedule-active-checkin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        attackId: `${attackId}-${i}`, // Unique ID for each check-in
                        checkInTime: checkInTime.toISOString(),
                        subscriptionEndpoint: notificationPreferences.pushSubscription.endpoint
                    })
                });

                if (!response.ok) {
                    console.error(`Failed to schedule active attack check-in #${i} on server`);
                }
            } catch (error) {
                console.error(`Error scheduling active attack check-in #${i}:`, error);
            }
        }
    }

    console.log(`Active Scheduled ${maxCheckIns} recurring active attack check-ins (every ${delayHours}h for 24h)`);
}

function cancelActiveAttackCheckIn(attackId) {
    // Cancel every scheduled check-in for this attack on the server.
    // Server IDs are `${attackId}-${sequence}` for sequences
    // 1..maxCheckIns (see scheduleActiveAttackCheckIn).
    if (!notificationPreferences.pushSubscription) return;

    const delayHours = notificationPreferences.activeAttackCheckIn.delayHours || 2;
    const maxCheckIns = Math.floor(24 / delayHours);

    try {
        const SERVER_URL = 'https://aiding-migraine-notifications.onrender.com';

        for (let i = 1; i <= maxCheckIns; i++) {
            const serverAttackId = `${attackId}-${i}`;

            fetch(`${SERVER_URL}/api/notifications/cancel-active-checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attackId: serverAttackId,
                    subscriptionEndpoint: notificationPreferences.pushSubscription.endpoint
                })
            }).catch(error => console.error(`Error canceling active attack check-in ${serverAttackId} on server:`, error));
        }

        console.log(`Canceled up to ${maxCheckIns} active attack check-ins for attack ${attackId}`);
    } catch (error) {
        console.error('Error canceling active attack check-ins:', error);
    }
}

// ============================================
// WEATHER TRACKING SYSTEM
// ============================================

// Weather data structure (stored in localStorage)
let weatherData = {
    version: 5,             // Data structure version for migrations
    enabled: false,
    location: {
        query: '',      // User's input (ZIP or city)
        city: '',       // Resolved city name
        lat: null,      // Latitude
        lon: null       // Longitude
    },
    current: {
        pressure: null,     // Current pressure in hPa
        temperature: null,  // Temperature in °C
        humidity: null,     // Relative humidity %
        windSpeed: null,    // Wind speed km/h
        weatherCode: null,  // WMO weather code
        precipitation: null,// Current precipitation mm
        timestamp: null     // When fetched
    },
    forecast: [],           // 72-hour hourly forecast (pressure, humidity, temp, weatherCode)
    history: [],            // 60 days of detailed readings
    lastFetch: null,        // Last API call timestamp
    historicalBackfill: {   // Status of historical data backfill
        done: false,
        lastBackfillDate: null,
        daysBackfilled: 0
    },

    // DISPLAY UNITS (default to US units)
    displayUnit: 'inHg',        // 'inHg' (US default) or 'hPa' (international)
    temperatureUnit: 'fahrenheit', // 'fahrenheit' (US default) or 'celsius'

    // USER THRESHOLD (configurable, learned from data)
    userThreshold6h: 5,     // hPa in 6h to trigger alert (default: 5, clinical standard)
    userThreshold24h: 5,    // hPa in 24h for significant change (default: 5)

    // PERSONAL PROFILE & ML FEATURES
    personalProfile: {
        threshold24h: null,         // Learned 24h threshold (null = use default)
        thresholdRapid: null,       // Learned rapid change threshold
        sensitivityLevel: 'standard', // 'sensitive', 'standard', 'conservative', 'custom'
        customThreshold24h: null,
        customThresholdRapid: null,

        // Direction sensitivity
        dropSensitive: true,        // Triggered by pressure drops
        riseSensitive: false,       // Triggered by pressure rises
        dropPercentage: 0,
        risePercentage: 0,

        // Absolute pressure sensitivity
        lowPressureSensitive: false,
        avgTriggerPressure: null,

        // Temperature sensitivity (2024 meta-analysis: OR=1.15, stronger than pressure OR=1.07)
        tempSensitive: false,           // Triggered by rapid temperature changes
        tempHighSensitive: false,       // Triggered by high temperatures (>32°C/90°F)
        avgTempChangeAtMigraine: null,  // Avg temperature change on migraine days

        // Humidity sensitivity (2024 meta-analysis: OR=1.04, not statistically significant alone)
        highHumiditySensitive: false,  // Triggered by high humidity (>75%)
        avgHumidityAtMigraine: null,   // Average humidity when migraines occur

        // Multi-day patterns
        cumulativeSensitive: false,
        avgDaysToTrigger: 1,

        // Correlation honesty flag
        pressureIsConfirmedTrigger: null, // null=unknown, true=confirmed, false=disconfirmed
        strongestWeatherFactor: null,     // 'pressure'|'humidity'|'temperature'|'compound'

        // Seasonal patterns
        seasonalVariation: {},

        // Learning metadata
        lastAnalyzed: null,
        sampleSize: 0,
        confidenceLevel: 'low'  // 'low'(<10), 'medium'(10-25), 'high'(>25 attacks)
    },

    // ML Model data
    mlModel: {
        enabled: false,
        weights: null,
        features: [],
        accuracy: 0,
        lastTrained: null,
        predictions: []
    }
};

// Migrate weather data from old versions
function migrateWeatherData(data) {
    if (!data || data.version === 5) {
        return data; // Already current version
    }

    let migrated = data;

    // Migrate v1 → v2 (if needed)
    if (!data.version || data.version < 2) {
        console.log('📦 Migrating weather data v1 → v2...');
        migrated = {
            version: 2,
            enabled: data.enabled || false,
            location: data.location || { query: '', city: '', lat: null, lon: null },
            current: data.current || { pressure: null, temperature: null, timestamp: null },
            forecast: data.forecast || [],
            history: [],
            lastFetch: data.lastFetch || null
        };

        // Convert old history format (simple daily readings) to new format (detailed with hourly data)
        if (data.history && Array.isArray(data.history)) {
            migrated.history = data.history.map(oldEntry => {
                // Old format: { date, pressure, hadMigraine }
                // New format: { date, readings: [{time, pressure}], dailyAvg, maxChange3h, maxChange24h }

                if (oldEntry.readings) {
                    // Already in new format somehow
                    return oldEntry;
                }

                return {
                    date: oldEntry.date,
                    readings: [{
                        time: oldEntry.date + 'T12:00:00Z', // Assume noon for old data
                        pressure: oldEntry.pressure || 1013.25
                    }],
                    dailyAvg: oldEntry.pressure || 1013.25,
                    maxChange3h: null,  // Unknown for old data
                    maxChange24h: null, // Will be calculated from history
                    hadMigraine: oldEntry.hadMigraine || false
                };
            });
        }
    }

    // Migrate v2 → v3 (add personal profile and ML features)
    if (migrated.version === 2) {
        console.log('Migrating weather data v2 → v3...');
        migrated.version = 3;
        migrated.personalProfile = {
            threshold24h: null, thresholdRapid: null, sensitivityLevel: 'standard',
            customThreshold24h: null, customThresholdRapid: null,
            dropSensitive: true, riseSensitive: false, dropPercentage: 0, risePercentage: 0,
            lowPressureSensitive: false, avgTriggerPressure: null,
            cumulativeSensitive: false, avgDaysToTrigger: 1, seasonalVariation: {},
            lastAnalyzed: null, sampleSize: 0, confidenceLevel: 'low'
        };
        migrated.mlModel = { enabled: false, weights: null, features: [], accuracy: 0, lastTrained: null, predictions: [] };
    }

    // Migrate v3 → v4 (add humidity tracking, backfill status, user thresholds, honest correlation)
    if (migrated.version === 3) {
        console.log('Migrating weather data v3 → v4 (adding humidity + honest correlation)...');
        migrated.version = 4;
        // Extend current with new fields
        migrated.current = Object.assign(
            { humidity: null, windSpeed: null, weatherCode: null, precipitation: null },
            migrated.current || {}
        );
        // Add backfill status
        migrated.historicalBackfill = { done: false, lastBackfillDate: null, daysBackfilled: 0 };
        // Add user thresholds
        migrated.userThreshold6h = 5;
        migrated.userThreshold24h = 5;
        // Extend personalProfile with new fields
        const pp = migrated.personalProfile || {};
        pp.highHumiditySensitive = false;
        pp.avgHumidityAtMigraine = null;
        pp.pressureIsConfirmedTrigger = null;
        pp.strongestWeatherFactor = null;
        migrated.personalProfile = pp;
        // Extend history entries to hold 60 days
        if (migrated.history && migrated.history.length > 30) {
            migrated.history = migrated.history.slice(0, 60);
        }
    }

    // Migrate v4 → v5 (add display units, temperature sensitivity, updated research weights)
    if (migrated.version === 4) {
        console.log('Migrating weather data v4 → v5 (adding unit display + temp sensitivity)...');
        migrated.version = 5;
        // Add display unit preferences (default to US units)
        migrated.displayUnit = migrated.displayUnit || 'inHg';
        migrated.temperatureUnit = migrated.temperatureUnit || 'fahrenheit';
        // Add temperature sensitivity to personalProfile
        const pp5 = migrated.personalProfile || {};
        pp5.tempSensitive = false;
        pp5.tempHighSensitive = false;
        pp5.avgTempChangeAtMigraine = null;
        migrated.personalProfile = pp5;
    }

    console.log('[SUCCESS] Weather data migrated to v5');
    return migrated;
}

// Initialize weather tracking (data loading only)
async function initWeatherTracking() {
    // Load saved weather data (try IndexedDB first, then localStorage)
    let loaded = null;

    if (useIndexedDB && db) {
        try {
            const idbData = await IDB.get(DB_STORES.WEATHER, 'weatherData');
            if (idbData) {
                loaded = idbData.value;
                console.log('[SUCCESS] Weather data loaded from IndexedDB');
            }
        } catch (error) {
            console.error('[ERROR] Failed to load weather from IndexedDB:', error);
        }
    }

    // Fallback to localStorage if IndexedDB didn't have data
    if (!loaded) {
        const saved = localStorage.getItem('weatherData');
        if (saved) {
            try {
                loaded = JSON.parse(saved);
                console.log('[SUCCESS] Weather data loaded from localStorage');
                // Migrate to IndexedDB
                await saveWeatherData();
            } catch (e) {
                console.error('Error loading weather data:', e);
            }
        }
    }

    if (loaded) {
        weatherData = migrateWeatherData(loaded);

        // Persist the migration whenever the loaded blob was not
        // already on the current version (migrateWeatherData
        // upgrades everything to v5)
        if (loaded.version !== 5) {
            await saveWeatherData();
        }

        // Analyze personal patterns if we have enough data
        if (weatherData.enabled && weatherData.history.length >= 7) {
            analyzePersonalWeatherProfile();
        }
    }

    // Auto-refresh weather data if enabled and stale (>6 hours old)
    if (weatherData.enabled && weatherData.location.lat) {
        const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);
        if (!weatherData.lastFetch || weatherData.lastFetch < sixHoursAgo) {
            fetchWeatherData();
        }
    }

    // Attempt to set up weather UI early (will succeed once settings page elements are available)
    setupWeatherUI();
}

// Set up weather UI (called when settings page is shown)
let weatherUIInitialized = false;
function setupWeatherUI() {
    console.log('[DEBUG] Setting up Weather UI...');

    const enableToggle = document.getElementById('weather-tracking-enabled');
    const weatherSettings = document.getElementById('weather-settings');

    if (!enableToggle || !weatherSettings) {
        console.warn('[WARNING] Weather UI elements not found, will retry on next settings page visit');
        return;
    }

    // Always update UI state when settings page is shown
    enableToggle.checked = weatherData.enabled;
    weatherSettings.style.display = weatherData.enabled ? 'block' : 'none';

    // If already initialized, skip event listener setup
    if (weatherUIInitialized) {
        console.log('[SUCCESS] Weather UI already initialized (skipping event listeners)');
        return;
    }

    enableToggle.addEventListener('change', () => {
        weatherData.enabled = enableToggle.checked;
        weatherSettings.style.display = weatherData.enabled ? 'block' : 'none';
        saveWeatherData();

        if (weatherData.enabled && weatherData.location.lat) {
            // Fetch weather immediately when enabled
            fetchWeatherData();
        }
    });

    // Load current location if exists
    if (weatherData.location.query) {
        const locationInput = document.getElementById('weather-location-input');
        if (locationInput) locationInput.value = weatherData.location.query;
        displayCurrentWeather();
    }

    // Location save button
    const saveBtn = document.getElementById('weather-location-save');
    if (saveBtn) saveBtn.addEventListener('click', saveWeatherLocation);

    // Refresh button
    const refreshBtn = document.getElementById('weather-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', (e) =>
        withBusy(e.currentTarget, 'Updating...', () => fetchWeatherData(true)));

    // GPS button
    const gpsBtn = document.getElementById('weather-gps-btn');
    if (gpsBtn) gpsBtn.addEventListener('click', useGPSLocation);

    // Backfill button
    const backfillBtn = document.getElementById('weather-backfill-btn');
    if (backfillBtn) backfillBtn.addEventListener('click', fetchHistoricalWeatherData);

    // Alert threshold slider
    const slider = document.getElementById('weather-threshold-slider');
    const sliderDisplay = document.getElementById('weather-threshold-display');
    if (slider && sliderDisplay) {
        slider.value = weatherData.userThreshold6h || 5;
        sliderDisplay.textContent = formatThreshold(parseInt(slider.value));
        slider.addEventListener('input', () => {
            const val = parseInt(slider.value);
            sliderDisplay.textContent = formatThreshold(val);
            const noteEl = document.getElementById('weather-threshold-note');
            if (noteEl) {
                if (val <= 3) noteEl.textContent = 'Very sensitive — may alert more often';
                else if (val <= 5) noteEl.textContent = 'Evidence-based default: 5 hPa / 0.15 inHg in 6 hours (Katsuki et al. 2023)';
                else if (val <= 8) noteEl.textContent = 'Moderate — alerts only for larger changes';
                else noteEl.textContent = 'Conservative — alerts only for major pressure shifts';
            }
        });
        slider.addEventListener('change', () => {
            weatherData.userThreshold6h = parseInt(slider.value);
            weatherData.userThreshold24h = parseInt(slider.value);
            saveWeatherData();
            updateLogWeatherDisplay();
        });
    }

    // Unit preference buttons
    function updateUnitButtons() {
        const isInHg = weatherData.displayUnit === 'inHg';
        const inHgBtn = document.getElementById('unit-inhg-btn');
        const hpaBtn = document.getElementById('unit-hpa-btn');
        if (inHgBtn) inHgBtn.setAttribute('aria-pressed', String(isInHg));
        if (hpaBtn) hpaBtn.setAttribute('aria-pressed', String(!isInHg));
        const isFahr = weatherData.temperatureUnit === 'fahrenheit';
        const fahrBtn = document.getElementById('unit-fahrenheit-btn');
        const celsiusBtn = document.getElementById('unit-celsius-btn');
        if (fahrBtn) fahrBtn.setAttribute('aria-pressed', String(isFahr));
        if (celsiusBtn) celsiusBtn.setAttribute('aria-pressed', String(!isFahr));
        // Update slider display to match new unit
        const sliderVal = parseInt((document.getElementById('weather-threshold-slider') || {}).value || 5);
        const sliderDisp = document.getElementById('weather-threshold-display');
        if (sliderDisp) sliderDisp.textContent = formatThreshold(sliderVal);
    }
    updateUnitButtons();

    const inHgBtn = document.getElementById('unit-inhg-btn');
    if (inHgBtn) inHgBtn.addEventListener('click', () => {
        weatherData.displayUnit = 'inHg';
        saveWeatherData();
        updateUnitButtons();
        displayCurrentWeather();
    });
    const hpaBtn = document.getElementById('unit-hpa-btn');
    if (hpaBtn) hpaBtn.addEventListener('click', () => {
        weatherData.displayUnit = 'hPa';
        saveWeatherData();
        updateUnitButtons();
        displayCurrentWeather();
    });
    const fahrBtn = document.getElementById('unit-fahrenheit-btn');
    if (fahrBtn) fahrBtn.addEventListener('click', () => {
        weatherData.temperatureUnit = 'fahrenheit';
        saveWeatherData();
        updateUnitButtons();
        displayCurrentWeather();
    });
    const celsiusBtn = document.getElementById('unit-celsius-btn');
    if (celsiusBtn) celsiusBtn.addEventListener('click', () => {
        weatherData.temperatureUnit = 'celsius';
        saveWeatherData();
        updateUnitButtons();
        displayCurrentWeather();
    });

    updateBackfillStatus();

    weatherUIInitialized = true;
    console.log('[SUCCESS] Weather UI initialized successfully');
}

// Save weather data to IndexedDB (with localStorage backup)
async function saveWeatherData() {
    if (useIndexedDB && db) {
        try {
            await IDB.put(DB_STORES.WEATHER, {
                key: 'weatherData',
                value: weatherData,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('[ERROR] Failed to save weather to IndexedDB:', error);
        }
    }
    // Also save to localStorage as backup
    localStorage.setItem('weatherData', JSON.stringify(weatherData));
}

// Save weather location (geocode and fetch weather)
async function saveWeatherLocation() {
    const input = document.getElementById('weather-location-input').value.trim();
    const statusDiv = document.getElementById('weather-location-status');

    if (!input) {
        statusDiv.innerHTML = '<span style="color: var(--accent-red);">Please enter a location</span>';
        return;
    }

    statusDiv.innerHTML = '<span style="color: var(--accent-blue);">Looking up location...</span>';

    try {
        // Use Open-Meteo geocoding API (free, no key needed)
        const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input)}&count=1&language=en&format=json`;

        const response = await fetch(geocodeUrl);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            statusDiv.innerHTML = '<span style="color: var(--accent-red);">Location not found. Try a different format (e.g., "New York" or "10001")</span>';
            return;
        }

        const result = data.results[0];

        // Save location data
        weatherData.location = {
            query: input,
            city: `${result.name}${result.admin1 ? ', ' + result.admin1 : ''}${result.country ? ', ' + result.country : ''}`,
            lat: result.latitude,
            lon: result.longitude
        };

        saveWeatherData();

        statusDiv.innerHTML = `<span style="color: var(--accent-green);">Location saved: ${weatherData.location.city}</span>`;

        // Fetch weather for this location
        await fetchWeatherData();

        // Update log screen weather display and calendar
        updateLogWeatherDisplay();
        renderCalendar();

    } catch (error) {
        console.error('Geocoding error:', error);
        statusDiv.innerHTML = '<span style="color: var(--accent-red);">Error looking up location. Please try again.</span>';
    }
}

// Use device GPS to auto-detect location
async function useGPSLocation() {
    const statusDiv = document.getElementById('weather-location-status');
    const gpsBtn = document.getElementById('weather-gps-btn');
    if (!navigator.geolocation) {
        if (statusDiv) statusDiv.innerHTML = '<span style="color:var(--accent-red);">GPS not available on this device</span>';
        return;
    }
    if (statusDiv) statusDiv.innerHTML = '<span style="color:var(--accent-blue);">Detecting your location...</span>';
    if (gpsBtn) gpsBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude, longitude } = pos.coords;
            // Reverse geocode using Open-Meteo (get city name from coords)
            try {
                const reverseUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
                const resp = await fetch(reverseUrl);
                const place = await resp.json();
                const city = place.address?.city || place.address?.town || place.address?.village || place.address?.county || 'Your location';
                const state = place.address?.state || '';
                const country = place.address?.country_code?.toUpperCase() || '';
                const cityLabel = [city, state, country].filter(Boolean).join(', ');

                weatherData.location = { query: cityLabel, city: cityLabel, lat: latitude, lon: longitude };
                saveWeatherData();

                const locationInput = document.getElementById('weather-location-input');
                if (locationInput) locationInput.value = cityLabel;
                if (statusDiv) statusDiv.innerHTML = `<span style="color:var(--accent-green);">Location set: ${cityLabel}</span>`;

                await fetchWeatherData(true);
                updateLogWeatherDisplay();
                renderCalendar();
            } catch (err) {
                // Coords are good even if reverse geocode fails
                weatherData.location = { query: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`, city: 'Your location', lat: latitude, lon: longitude };
                saveWeatherData();
                if (statusDiv) statusDiv.innerHTML = '<span style="color:var(--accent-green);">Location detected — fetching pressure data...</span>';
                await fetchWeatherData(true);
            }
            if (gpsBtn) gpsBtn.disabled = false;
        },
        (err) => {
            if (gpsBtn) gpsBtn.disabled = false;
            const msg = err.code === 1 ? 'Location permission denied' : 'Could not get location';
            if (statusDiv) statusDiv.innerHTML = `<span style="color:var(--accent-red);">${msg} — try typing your city name instead</span>`;
        },
        { timeout: 10000, maximumAge: 300000 }
    );
}

// Calculate maximum rapid pressure change from readings
// UPDATED 2026-01-20: Changed to 6-hour window based on clinical research review
// Note: Function name kept as "Max3hChange" for backward compatibility with data structure
function calculateMax3hChange(readings) {
    if (!readings || readings.length < 7) {
        return 0; // Need at least 7 hourly readings for 6-hour window
    }

    let maxChange = 0;

    // Slide a 6-hour window through the readings
    // Research basis: More conservative, better evidence base than 3h
    // General "rapid change" concept validated (Okuma 2015, Kimoto 2011)
    // Specific thresholds vary in literature; 6h provides better clinical reliability
    for (let i = 0; i < readings.length - 6; i++) {
        const windowPressures = readings.slice(i, i + 7).map(r => r.pressure);
        const windowMax = Math.max(...windowPressures);
        const windowMin = Math.min(...windowPressures);
        const change = windowMax - windowMin;

        if (change > maxChange) {
            maxChange = change;
        }
    }

    return Math.round(maxChange * 10) / 10;
}

// Translate WMO weather code to plain-language condition
function getWeatherCondition(code) {
    if (code === 0) return 'Clear sky';
    if (code <= 3) return 'Partly cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 55) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Rain showers';
    if (code <= 86) return 'Snow showers';
    if (code <= 99) return 'Thunderstorm';
    return 'Unknown';
}

// Translate weather code to short label for the log indicator
function getWeatherConditionShort(code) {
    if (code === null || code === undefined) return '';
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Cloudy';
    if (code <= 48) return 'Fog';
    if (code <= 55) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Showers';
    if (code <= 99) return 'Storm';
    return '';
}

// Fetch weather data from Open-Meteo (enhanced: pressure + humidity + conditions)
async function fetchWeatherData(forced = false) {
    if (!weatherData.location.lat || !weatherData.location.lon) {
        console.log('No location set for weather fetch');
        return;
    }

    // Don't fetch if we fetched recently (unless forced) — 1 hour cache
    if (!forced && weatherData.lastFetch) {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        if (weatherData.lastFetch > oneHourAgo) {
            console.log('Weather data is recent, skipping fetch');
            displayCurrentWeather();
            return;
        }
    }

    try {
        // Open-Meteo API - Free, no key required
        // current: pressure + temperature + humidity + precipitation + weather code + wind
        // hourly: 72-hour forecast with pressure, humidity, precipitation probability, conditions
        const weatherUrl = [
            'https://api.open-meteo.com/v1/forecast',
            `?latitude=${weatherData.location.lat}`,
            `&longitude=${weatherData.location.lon}`,
            '&current=surface_pressure,temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
            '&hourly=surface_pressure,temperature_2m,relative_humidity_2m,precipitation_probability,weather_code',
            '&timezone=auto',
            '&forecast_days=3'
        ].join('');

        const response = await fetch(weatherUrl);
        const data = await response.json();

        if (!data.current || !data.hourly) {
            throw new Error('Invalid weather data received');
        }

        const currentTime = new Date();
        const currentPressure = Math.round(data.current.surface_pressure * 10) / 10;
        const currentHumidity = Math.round(data.current.relative_humidity_2m);
        const currentTemp = Math.round(data.current.temperature_2m * 10) / 10;
        const currentWind = Math.round(data.current.wind_speed_10m * 10) / 10;
        const currentCode = data.current.weather_code;
        const currentPrecip = Math.round((data.current.precipitation || 0) * 10) / 10;

        // Store current weather (all variables)
        weatherData.current = {
            pressure: currentPressure,
            temperature: currentTemp,
            humidity: currentHumidity,
            windSpeed: currentWind,
            weatherCode: currentCode,
            precipitation: currentPrecip,
            timestamp: Date.now()
        };

        // Store 72-hour hourly forecast (pressure + humidity + conditions)
        weatherData.forecast = data.hourly.time.map((time, i) => ({
            time: time,
            pressure: Math.round(data.hourly.surface_pressure[i] * 10) / 10,
            humidity: Math.round(data.hourly.relative_humidity_2m[i]),
            temperature: Math.round(data.hourly.temperature_2m[i] * 10) / 10,
            precipProb: Math.round(data.hourly.precipitation_probability[i] || 0),
            weatherCode: data.hourly.weather_code[i]
        }));

        // Update history with new reading
        const today = new Date().toISOString().split('T')[0];
        const newReading = {
            time: currentTime.toISOString(),
            pressure: currentPressure,
            humidity: currentHumidity,
            temperature: currentTemp
        };

        // Find or create today's entry
        let todayEntry = weatherData.history.find(h => h.date === today);

        if (!todayEntry) {
            todayEntry = {
                date: today,
                readings: [],
                dailyAvg: 0,
                dailyHumidityAvg: null,
                dailyTempAvg: null,
                maxChange3h: 0,
                maxChange24h: null,
                weatherCode: currentCode,
                precipitation: 0
            };
            weatherData.history.push(todayEntry);
        }

        // Open-Meteo current precipitation covers the last hour, so
        // only accumulate it once per hour (re-fetches within the
        // same hour would otherwise double count)
        const currentHourKey = currentTime.toISOString().slice(0, 13);
        const alreadyCountedThisHour = todayEntry.readings.some(r =>
            r.time && r.time.slice(0, 13) === currentHourKey
        );

        // Add reading (keep up to 24 per day)
        todayEntry.readings.push(newReading);
        if (todayEntry.readings.length > 24) {
            todayEntry.readings = todayEntry.readings.slice(-24);
        }

        // Calculate daily averages
        const pressureSum = todayEntry.readings.reduce((s, r) => s + r.pressure, 0);
        todayEntry.dailyAvg = Math.round((pressureSum / todayEntry.readings.length) * 10) / 10;

        const humidReadings = todayEntry.readings.filter(r => r.humidity != null);
        if (humidReadings.length > 0) {
            todayEntry.dailyHumidityAvg = Math.round(
                humidReadings.reduce((s, r) => s + r.humidity, 0) / humidReadings.length
            );
        }

        const tempReadings = todayEntry.readings.filter(r => r.temperature != null);
        if (tempReadings.length > 0) {
            todayEntry.dailyTempAvg = Math.round(
                (tempReadings.reduce((s, r) => s + r.temperature, 0) / tempReadings.length) * 10
            ) / 10;
        }

        // Always store latest weather code; accumulate precipitation
        // at most once per hour
        todayEntry.weatherCode = currentCode;
        if (!alreadyCountedThisHour) {
            todayEntry.precipitation = (todayEntry.precipitation || 0) + currentPrecip;
        }

        // Calculate 6-hour rapid change (primary alert metric)
        todayEntry.maxChange3h = calculateMax3hChange(todayEntry.readings);

        // Calculate 24h change vs CALENDAR yesterday - after a usage
        // gap the most recent history entry can be days old, which
        // would mislabel a multi-day delta as a 24h change
        const yesterdayKey = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];
        const yesterday = weatherData.history.find(h => h.date === yesterdayKey);
        if (yesterday && yesterday.dailyAvg) {
            todayEntry.maxChange24h = Math.round((todayEntry.dailyAvg - yesterday.dailyAvg) * 10) / 10;
        } else {
            // No reading for calendar-yesterday: 24h change unknown
            todayEntry.maxChange24h = null;
        }

        // Keep only last 60 days (up from 30)
        weatherData.history = weatherData.history
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 60);

        weatherData.lastFetch = Date.now();
        saveWeatherData();

        displayCurrentWeather();
        updateLogWeatherDisplay();

        console.log('[SUCCESS] Weather updated:', currentPressure, 'hPa |', currentHumidity, '% humidity |', getWeatherCondition(currentCode));
        console.log('   6h max change:', todayEntry.maxChange3h, 'hPa | 24h change:', todayEntry.maxChange24h, 'hPa');

    } catch (error) {
        console.error('Weather fetch error:', error);
        const message = navigator.onLine
            ? "Couldn't update weather just now. Your logged data is unaffected."
            : "You're offline, so weather couldn't update. Everything else still works.";
        const statusDiv = document.getElementById('weather-location-status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.style.color = 'var(--accent-red)';
        }
        // The status element lives on Settings, so a fetch started from
        // any other page would otherwise fail with no visible sign.
        if (forced && currentPage !== 'settings') {
            showModal('Weather unavailable', `<p>${safeText(message)}</p>`);
        }
    }
}

// ============================================
// UNIT CONVERSION HELPERS
// hPa is the internal/API unit. inHg is shown to US users.
// Research thresholds remain in hPa internally; only display converts.
// ============================================

// 1 hPa = 0.02953 inHg exactly (1 inHg = 33.8639 hPa)
function hPaToInHg(hPa) {
    if (hPa === null || hPa === undefined) return null;
    return Math.round(hPa * 0.02953 * 100) / 100; // 2 decimal places
}

function celsiusToFahrenheit(c) {
    if (c === null || c === undefined) return null;
    return Math.round(c * 9 / 5 + 32);
}

// Format a pressure value for display (respects user's displayUnit preference)
function formatPressure(hPa, decimals) {
    if (hPa === null || hPa === undefined) return '--';
    if (weatherData.displayUnit === 'inHg') {
        const d = decimals !== undefined ? decimals : 2;
        return hPaToInHg(hPa).toFixed(d) + ' inHg';
    }
    return (decimals !== undefined ? hPa.toFixed(decimals) : Math.round(hPa)) + ' hPa';
}

// Format a pressure change value (e.g. "+0.15 inHg" or "-3.2 hPa")
function formatPressureChange(changHPa, decimals) {
    if (changHPa === null || changHPa === undefined) return '--';
    if (weatherData.displayUnit === 'inHg') {
        const d = decimals !== undefined ? decimals : 2;
        const val = hPaToInHg(Math.abs(changHPa)).toFixed(d);
        return (changHPa >= 0 ? '+' : '-') + val + ' inHg';
    }
    const d = decimals !== undefined ? decimals : 1;
    const val = Math.abs(changHPa).toFixed(d);
    return (changHPa >= 0 ? '+' : '-') + val + ' hPa';
}

// Format temperature for display (respects user's temperatureUnit preference)
function formatTemperature(celsius) {
    if (celsius === null || celsius === undefined) return '--';
    if (weatherData.temperatureUnit === 'fahrenheit') {
        return celsiusToFahrenheit(celsius) + '°F';
    }
    return Math.round(celsius) + '°C';
}

// Format the alert threshold for display in current unit
function formatThreshold(hPaVal) {
    if (weatherData.displayUnit === 'inHg') {
        return hPaToInHg(hPaVal).toFixed(2) + ' inHg';
    }
    return hPaVal + ' hPa';
}

// Display current weather in settings (enhanced with humidity + conditions + risk)
function displayCurrentWeather() {
    const displayDiv = document.getElementById('weather-current-display');

    if (!weatherData.location.city || !weatherData.current.pressure) {
        if (displayDiv) displayDiv.style.display = 'none';
        return;
    }

    if (displayDiv) displayDiv.style.display = 'block';

    // Location
    const locationSpan = document.getElementById('weather-location-display');
    if (locationSpan) locationSpan.textContent = weatherData.location.city;

    // Pressure + plain-language trend
    const pressureSpan = document.getElementById('weather-current-pressure');
    if (pressureSpan) pressureSpan.textContent = formatPressure(weatherData.current.pressure);

    const change24h = getPressureChange24h();
    const changeSpan = document.getElementById('weather-pressure-change');
    if (changeSpan) {
        if (change24h !== null) {
            const abs = Math.abs(change24h);
            const direction = change24h > 0 ? 'Rising' : 'Falling';
            const speed = abs >= 10 ? 'fast' : abs >= 5 ? 'noticeably' : abs >= 2 ? 'slowly' : 'stable';
            const isSignificant = abs >= (weatherData.userThreshold24h || 5);
            const color = isSignificant ? 'var(--accent-red)' : 'var(--text-secondary)';
            const arrow = change24h > 0 ? '↑' : '↓';
            const changeDisplay = formatPressureChange(change24h);
            changeSpan.innerHTML = `<span style="color:${color}">${arrow} ${direction} ${speed} — ${changeDisplay} in 24h${isSignificant ? ' (significant)' : ''}</span>`;
        } else {
            changeSpan.textContent = 'Not enough data for trend';
        }
    }

    // Temperature + humidity + conditions row
    const detailsSpan = document.getElementById('weather-current-details');
    if (detailsSpan) {
        const parts = [];
        if (weatherData.current.temperature !== null) parts.push(formatTemperature(weatherData.current.temperature));
        if (weatherData.current.humidity !== null) parts.push(`${weatherData.current.humidity}% humidity`);
        if (weatherData.current.windSpeed !== null) parts.push(`Wind ${weatherData.current.windSpeed} km/h`);
        if (weatherData.current.weatherCode !== null) parts.push(getWeatherCondition(weatherData.current.weatherCode));
        detailsSpan.textContent = parts.join(' · ');
    }

    // Daily risk score
    const riskSpan = document.getElementById('weather-risk-display');
    if (riskSpan) {
        const risk = calculateDailyRiskScore();
        if (risk !== null) {
            riskSpan.innerHTML = `<span style="color:${risk.color}; font-weight:600;">${risk.label}</span> <span style="color:var(--text-secondary); font-size:0.8rem;">${risk.detail}</span>`;
        }
    }

    // Last updated
    const updatedSpan = document.getElementById('weather-last-updated');
    if (updatedSpan && weatherData.current.timestamp) {
        const diffMinutes = Math.floor((Date.now() - weatherData.current.timestamp) / 60000);
        let timeAgo;
        if (diffMinutes < 1) timeAgo = 'Just now';
        else if (diffMinutes < 60) timeAgo = `${diffMinutes}m ago`;
        else timeAgo = `${Math.floor(diffMinutes / 60)}h ago`;
        updatedSpan.textContent = `Updated ${timeAgo}`;
    }

    // Backfill status
    updateBackfillStatus();
}

// Get 24-hour pressure change (uses historical daily averages for accuracy)
function getPressureChange24h() {
    if (weatherData.history.length < 2) {
        return null;
    }

    // Sort history to get last two days
    const sorted = [...weatherData.history]
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sorted.length < 2) {
        return null;
    }

    const today = sorted[0];
    const yesterday = sorted[1];

    // Use daily averages for consistent comparison
    if (!today.dailyAvg || !yesterday.dailyAvg) {
        return null;
    }

    const change = today.dailyAvg - yesterday.dailyAvg;
    return Math.round(change * 10) / 10; // 1 decimal place
}

// Get 24-hour temperature change (uses daily averages — parallel to getPressureChange24h)
// Basis: 2024 meta-analysis (OR=1.15 for temperature, stronger than pressure OR=1.07)
// Mukamal 2009: 5°C increase in 24h raises headache risk by 7.5%
function getTemperatureChange24h(historyForDate) {
    const history = historyForDate || weatherData.history;
    if (!history || history.length < 2) return null;

    const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sorted.length < 2) return null;

    const today = sorted[0];
    const yesterday = sorted[1];

    if (today.dailyTempAvg === null || today.dailyTempAvg === undefined ||
        yesterday.dailyTempAvg === null || yesterday.dailyTempAvg === undefined) {
        return null;
    }

    return Math.round((today.dailyTempAvg - yesterday.dailyTempAvg) * 10) / 10;
}

// Detect rapid pressure changes in forecast (next 24 hours)
// UPDATED 2026-01-20: Changed to 6-hour window with 5 hPa threshold
// Based on clinical research review (see CLINICAL_THRESHOLDS_RESEARCH.md)
function detectRapidForecastChanges() {
    if (!weatherData.forecast || weatherData.forecast.length < 7) {
        return [];
    }

    const rapidChanges = [];
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Check 6-hour sliding windows in the next 24 hours
    // Research basis: More conservative threshold with better clinical evidence
    for (let i = 0; i < Math.min(weatherData.forecast.length - 6, 24); i++) {
        const window = weatherData.forecast.slice(i, i + 7);
        const windowTime = new Date(window[0].time);

        // Only check forecast (future times)
        if (windowTime <= now || windowTime > next24h) {
            continue;
        }

        const pressures = window.map(r => r.pressure);
        const maxPressure = Math.max(...pressures);
        const minPressure = Math.min(...pressures);
        const change = maxPressure - minPressure;

        // Clinical threshold: 5+ hPa in 6 hours (research-validated)
        // More conservative than previous 3h/3hPa which lacked specific literature support
        if (change >= 5) {
            const hoursFromNow = Math.round((windowTime - now) / (1000 * 60 * 60));
            rapidChanges.push({
                startTime: window[0].time,
                endTime: window[6].time,
                change: Math.round(change * 10) / 10,
                hoursFromNow: hoursFromNow,
                direction: pressures[6] < pressures[0] ? 'falling' : 'rising'
            });
        }
    }

    return rapidChanges;
}

// Get absolute pressure risk level (NEW - based on Okuma et al. 2015)
// Research shows 50% of migraines occur in 1003-1007 hPa range
function getAbsolutePressureRisk(pressure) {
    const STANDARD_PRESSURE = 1013.25;
    const VERY_HIGH_RISK = 1005; // 26.5% of migraines (Okuma 2015)
    const HIGH_RISK = 1007;      // 23.5% of migraines (Okuma 2015)

    if (pressure < VERY_HIGH_RISK) {
        return {
            level: 'very-high',
            message: 'Very low pressure - high migraine risk',
            detail: `${(STANDARD_PRESSURE - pressure).toFixed(1)} hPa below standard`,
            color: 'var(--accent-red)'
        };
    } else if (pressure < HIGH_RISK) {
        return {
            level: 'high',
            message: 'Low pressure - increased migraine risk',
            detail: `${(STANDARD_PRESSURE - pressure).toFixed(1)} hPa below standard`,
            color: 'var(--pain-moderate)'
        };
    } else if (pressure < STANDARD_PRESSURE) {
        return {
            level: 'moderate',
            message: 'Below standard pressure',
            detail: `${(STANDARD_PRESSURE - pressure).toFixed(1)} hPa below standard`,
            color: 'var(--text-secondary)'
        };
    } else {
        return {
            level: 'normal',
            message: 'Normal pressure range',
            detail: 'Above standard pressure',
            color: 'var(--accent-green)'
        };
    }
}

// Get pressure trend description
function getPressureTrend() {
    const change24h = getPressureChange24h();
    if (change24h === null) {
        return { text: 'Unknown', icon: '?', significant: false };
    }

    if (change24h > 5) {
        return { text: 'Rising rapidly', icon: '↑', significant: true };
    } else if (change24h > 2) {
        return { text: 'Rising', icon: '↑', significant: false };
    } else if (change24h > -2) {
        return { text: 'Stable', icon: '→', significant: false };
    } else if (change24h > -5) {
        return { text: 'Falling', icon: '↓', significant: false };
    } else {
        return { text: 'Falling rapidly', icon: '↓', significant: true };
    }
}

// Re-derives a weather snapshot for `dateStr` (YYYY-MM-DD) from
// locally stored history, for when an episode's start date is edited
// to a different day than it was originally logged on -- the
// original snapshot belongs to the old day and would otherwise keep
// silently feeding weather-correlation analytics under the new one.
// Only looks at data already on the device (no network call, unlike
// the live fetch this app otherwise only performs for "now"); returns
// null when there's no local history for that date, which the caller
// uses to clear a now-stale snapshot rather than keep it.
function deriveWeatherForDate(dateStr) {
    if (!weatherData.enabled) return null;
    const entry = weatherData.history.find(h => h.date === dateStr);
    if (!entry) return null;
    return {
        pressure: entry.dailyAvg || null,
        humidity: entry.dailyHumidityAvg ?? null,
        temperature: entry.dailyTempAvg ?? null,
        weatherCode: entry.weatherCode ?? null,
        change24h: entry.maxChange24h ?? null,
        maxChange3h: entry.maxChange3h ?? null,
        // trend/riskScore describe "right now" relative to recent
        // readings and have no meaning for a past day being
        // retroactively assigned weather.
        trend: null,
        riskScore: null,
        timestamp: new Date(dateStr).getTime()
    };
}

// Get current weather for migraine entry
function getCurrentWeatherForEntry() {
    if (!weatherData.enabled || !weatherData.current.pressure) {
        return null;
    }

    const today = new Date().toISOString().split('T')[0];
    const todayEntry = weatherData.history.find(h => h.date === today);

    return {
        pressure: weatherData.current.pressure,
        humidity: weatherData.current.humidity,
        temperature: weatherData.current.temperature,
        weatherCode: weatherData.current.weatherCode,
        change24h: getPressureChange24h(),
        maxChange3h: todayEntry ? todayEntry.maxChange3h : null,
        trend: getPressureTrend(),
        riskScore: calculateDailyRiskScore(),
        timestamp: weatherData.current.timestamp
    };
}

// Calculate a 0-10 daily atmospheric risk score for migraine
// UPDATED 2026-02-27: Reweighted per 2024 systematic meta-analysis (31 studies):
//   Temperature OR=1.15 (strongest), Pressure OR=1.07, Humidity OR=1.04 (not significant)
//   Source: Barakat et al. 2024 meta-analysis (PMID 40246758)
//   Katsuki et al. 2023 AI study (40k users): pressure drop 6h before = strongest predictor
//   Absolute pressure thresholds: Okuma 2015, confirmed by Farah et al. 2025 systematic review
function calculateDailyRiskScore() {
    if (!weatherData.enabled || !weatherData.current.pressure) return null;

    const pressure = weatherData.current.pressure;
    const humidity = weatherData.current.humidity;
    const temperature = weatherData.current.temperature;
    const change24h = getPressureChange24h();
    const tempChange24h = getTemperatureChange24h();
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = weatherData.history.find(h => h.date === today);
    const change6h = todayEntry ? (todayEntry.maxChange3h || 0) : 0;
    const threshold6h = weatherData.userThreshold6h || 5;
    const threshold24h = weatherData.userThreshold24h || 5;
    const profile = weatherData.personalProfile;

    let score = 0;

    // 1. Rapid 6-hour pressure change (0-3 points) — strongest real-world predictor
    //    Katsuki et al. 2023 (AI/40k users): 6h drop was #1 predictor (p<0.001, gain=11.7)
    if (change6h >= threshold6h * 2.4) score += 3;      // >12 hPa in 6h: extreme
    else if (change6h >= threshold6h * 1.6) score += 2; // >8 hPa: severe
    else if (change6h >= threshold6h) score += 1.5;     // >5 hPa: significant
    else if (change6h >= threshold6h * 0.6) score += 0.75; // >3 hPa: mild

    // 2. 24-hour pressure change (0-2 points)
    if (change24h !== null) {
        const abs24h = Math.abs(change24h);
        if (abs24h >= threshold24h * 2) score += 2;
        else if (abs24h >= threshold24h) score += 1;

        // Direction bonus: drops more dangerous than rises (research-validated)
        if (change24h < 0 && profile && profile.dropSensitive) score += 0.5;
    }

    // 3. Absolute low pressure zone (0-2 points) — Okuma 2015, confirmed Farah et al. 2025
    //    50% of attacks at 1003-1007 hPa (29.62-29.74 inHg)
    if (pressure < 1005) score += 2;        // 26.5% of migraines (29.68 inHg)
    else if (pressure < 1007) score += 1;   // 23.5% of migraines (29.74 inHg)

    // 4. Temperature change (0-2 points) — 2024 meta-analysis: OR=1.15, STRONGER than pressure
    //    Mukamal 2009: 5°C/24h increase = +7.5% headache risk
    if (tempChange24h !== null) {
        const absTempChange = Math.abs(tempChange24h);
        if (absTempChange >= 10) score += 2;       // >10°C/18°F swing: very high risk
        else if (absTempChange >= 5) score += 1.5; // >5°C/9°F swing: high risk
        else if (absTempChange >= 3) score += 0.75; // >3°C/5°F swing: moderate
    }
    // Extreme temperature (>32°C/90°F or <-5°C/23°F) adds additional compound risk
    if (temperature !== null && (temperature > 32 || temperature < -5)) score += 0.5;

    // 5. Humidity compound (0-0.5 points max) — 2024 meta-analysis: OR=1.04, NOT significant alone
    //    Only scored as a compound factor with concurrent low pressure
    if (humidity !== null && humidity > 85 && pressure < 1005) score += 0.5;
    else if (humidity !== null && humidity > 75 && pressure < 1007) score += 0.25;

    // Clamp to 0-10
    const rawScore = Math.min(10, Math.round(score));

    // Color and label
    let color, label, detail;
    if (rawScore <= 2) {
        color = 'var(--accent-green)'; label = 'Low risk'; detail = 'Conditions stable';
    } else if (rawScore <= 4) {
        color = 'var(--pain-moderate)'; label = 'Moderate risk'; detail = 'Some atmospheric change';
    } else if (rawScore <= 6) {
        color = 'var(--pain-severe)'; label = 'Elevated risk'; detail = 'Significant atmospheric shift';
    } else {
        color = 'var(--accent-red)'; label = 'High risk'; detail = 'Major atmospheric change';
    }

    return { score: rawScore, color, label, detail };
}

// Fetch historical weather data via Open-Meteo archive API (backfill past 60 days)
async function fetchHistoricalWeatherData() {
    if (!weatherData.location.lat || !weatherData.location.lon) return;

    const statusDiv = document.getElementById('weather-backfill-status');
    if (statusDiv) statusDiv.innerHTML = '<span style="color:var(--accent-blue);">Fetching last 60 days of pressure data...</span>';

    try {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 1); // Archive available up to yesterday
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 59); // 60 days total

        const fmt = d => d.toISOString().split('T')[0];
        const archiveUrl = [
            'https://archive-api.open-meteo.com/v1/archive',
            `?latitude=${weatherData.location.lat}`,
            `&longitude=${weatherData.location.lon}`,
            `&start_date=${fmt(startDate)}`,
            `&end_date=${fmt(endDate)}`,
            '&hourly=surface_pressure,temperature_2m,relative_humidity_2m,precipitation,weather_code',
            '&timezone=auto'
        ].join('');

        const response = await fetch(archiveUrl);
        const data = await response.json();

        if (!data.hourly || !data.hourly.time) throw new Error('Invalid archive data');

        // Group hourly readings into daily entries
        const dailyMap = {};
        data.hourly.time.forEach((timeStr, i) => {
            const date = timeStr.split('T')[0];
            if (!dailyMap[date]) {
                dailyMap[date] = { readings: [], codes: [], precips: [] };
            }
            const pressure = data.hourly.surface_pressure[i];
            const humidity = data.hourly.relative_humidity_2m[i];
            const temp = data.hourly.temperature_2m[i];
            const precip = data.hourly.precipitation[i] || 0;
            const code = data.hourly.weather_code[i];
            if (pressure != null) {
                dailyMap[date].readings.push({
                    time: timeStr,
                    pressure: Math.round(pressure * 10) / 10,
                    humidity: Math.round(humidity || 0),
                    temperature: Math.round((temp || 0) * 10) / 10
                });
            }
            if (code != null) dailyMap[date].codes.push(code);
            dailyMap[date].precips.push(precip);
        });

        // Merge into weatherData.history (don't overwrite existing readings from current fetch)
        let backfilledCount = 0;
        Object.entries(dailyMap).forEach(([date, dayData]) => {
            if (!dayData.readings.length) return;
            const existing = weatherData.history.find(h => h.date === date);
            if (existing && existing.readings && existing.readings.length > 1) return; // Already have live data

            const pressureSum = dayData.readings.reduce((s, r) => s + r.pressure, 0);
            const dailyAvg = Math.round((pressureSum / dayData.readings.length) * 10) / 10;
            const humidSum = dayData.readings.reduce((s, r) => s + (r.humidity || 0), 0);
            const dailyHumidityAvg = Math.round(humidSum / dayData.readings.length);
            const tempSum = dayData.readings.reduce((s, r) => s + (r.temperature || 0), 0);
            const dailyTempAvg = Math.round((tempSum / dayData.readings.length) * 10) / 10;
            const totalPrecip = Math.round(dayData.precips.reduce((s, p) => s + p, 0) * 10) / 10;
            // Most common weather code
            const codeMode = dayData.codes.length ? dayData.codes.sort(
                (a, b) => dayData.codes.filter(c => c === b).length - dayData.codes.filter(c => c === a).length
            )[0] : null;
            const maxChange6h = calculateMax3hChange(dayData.readings);

            const entry = {
                date,
                readings: dayData.readings,
                dailyAvg,
                dailyHumidityAvg,
                dailyTempAvg,
                maxChange3h: maxChange6h,
                maxChange24h: null, // Calculated in next pass
                weatherCode: codeMode,
                precipitation: totalPrecip,
                fromArchive: true
            };

            if (existing) {
                // Update existing entry with archive data
                Object.assign(existing, entry);
            } else {
                weatherData.history.push(entry);
                backfilledCount++;
            }
        });

        // Recalculate 24h changes for all entries now that we have the full picture
        const sorted = [...weatherData.history].sort((a, b) => new Date(a.date) - new Date(b.date));
        for (let i = 1; i < sorted.length; i++) {
            const today = sorted[i];
            const yesterday = sorted[i - 1];
            if (today.dailyAvg && yesterday.dailyAvg) {
                today.maxChange24h = Math.round((today.dailyAvg - yesterday.dailyAvg) * 10) / 10;
            }
        }

        // Keep only last 60 days, sorted newest first
        weatherData.history = sorted.reverse().slice(0, 60);

        // Mark backfill complete
        weatherData.historicalBackfill = {
            done: true,
            lastBackfillDate: new Date().toISOString(),
            daysBackfilled: backfilledCount
        };

        saveWeatherData();

        // Re-analyze personal profile with the fuller dataset
        if (weatherData.history.length >= 7) analyzePersonalWeatherProfile();

        const totalDays = weatherData.history.length;
        if (statusDiv) {
            statusDiv.innerHTML = `<span style="color:var(--accent-green);">${totalDays} days of pressure data ready. ${backfilledCount > 0 ? `${backfilledCount} days recovered from archive.` : 'Data already complete.'}</span>`;
        }

        console.log(`[SUCCESS] Historical backfill complete: ${backfilledCount} archive days added, ${totalDays} total history days`);

        // Refresh analytics if on that page
        if (typeof renderAnalytics === 'function' && document.getElementById('analytics-page')?.classList.contains('active')) {
            renderAnalytics();
        }

    } catch (error) {
        console.error('Historical weather fetch error:', error);
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color:var(--accent-red);">Could not fetch historical data. Check your connection and try again.</span>';
        }
    }
}

// Show current backfill status in settings
function updateBackfillStatus() {
    const statusDiv = document.getElementById('weather-backfill-status');
    if (!statusDiv) return;
    const bf = weatherData.historicalBackfill;
    const historyDays = weatherData.history.length;
    if (!bf || !bf.done) {
        if (historyDays < 7) {
            statusDiv.innerHTML = '<span style="color:var(--text-secondary);">No historical data yet — fetch archive to see last month\'s pressure patterns.</span>';
        } else {
            statusDiv.innerHTML = `<span style="color:var(--text-secondary);">${historyDays} days of live data. Fetch archive to extend to 60 days.</span>`;
        }
    } else {
        statusDiv.innerHTML = `<span style="color:var(--accent-green);">${historyDays} days of pressure history available.</span>`;
    }
}

// "Today's outlook" risk card — surfaces the already-computed weather
// risk score, the personal ML estimate (when the model is enabled and
// honestly gated), and upcoming forecast alerts at the top of Today.
function updateTodayRiskCard() {
    const card = document.getElementById('today-risk-card');
    if (!card) return;

    // Hide when weather tracking is off or there's no current reading.
    if (!weatherData.enabled || !weatherData.current || !weatherData.current.pressure) {
        card.style.display = 'none';
        return;
    }

    const risk = calculateDailyRiskScore();
    if (!risk) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';

    // The outlook sits below the log form by default so the primary
    // action leads the page, and earns the slot above it only when the
    // risk is high enough to be worth interrupting for.
    const logSection = document.getElementById('logging-section');
    if (logSection && logSection.parentNode) {
        // "Elevated risk" (5) and above — matches the label bands below.
        const shouldPromote = risk.score >= 5;
        const isPromoted = card.nextElementSibling === logSection;
        if (shouldPromote && !isPromoted) {
            logSection.parentNode.insertBefore(card, logSection);
        } else if (!shouldPromote && isPromoted) {
            logSection.parentNode.insertBefore(card, logSection.nextSibling);
        }
    }

    // 1. Headline label + 0-10 meter
    const labelEl = document.getElementById('risk-card-label');
    if (labelEl) {
        labelEl.textContent = risk.label;
        labelEl.style.background = risk.color;
    }
    const fill = document.getElementById('risk-meter-fill');
    if (fill) {
        fill.style.width = Math.round((risk.score / 10) * 100) + '%';
        fill.style.background = risk.color;
    }
    const detailEl = document.getElementById('risk-card-detail');
    if (detailEl) detailEl.textContent = `Risk ${risk.score}/10 — ${risk.detail}.`;

    // 2. Pressure trend line
    const trendEl = document.getElementById('risk-card-trend');
    if (trendEl) {
        const trend = getPressureTrend();
        const change24h = getPressureChange24h();
        let text = `Pressure: ${trend.text} ${trend.icon}`;
        if (change24h !== null) text += ` · ${formatPressureChange(change24h)} in 24h`;
        trendEl.textContent = text;
    }

    // 3. Personal ML estimate — only when the model is enabled (honest gate)
    const mlEl = document.getElementById('risk-card-ml');
    if (mlEl) {
        let probability = null;
        if (weatherData.mlModel && weatherData.mlModel.enabled) {
            const today = new Date().toISOString().split('T')[0];
            const todayEntry = weatherData.history.find(h => h.date === today);
            probability = predictMigraineProbability({
                pressure: weatherData.current.pressure,
                change24h: getPressureChange24h(),
                changeRapid: todayEntry ? (todayEntry.maxChange3h || 0) : 0,
                tempChange24h: getTemperatureChange24h()
            });
        }
        if (probability !== null && probability !== undefined) {
            mlEl.innerHTML = safeHTML(
                `<span class="risk-card-ml-value">Your personal model: ~${probability}% chance of a migraine day today</span>` +
                `<span class="risk-card-ml-caveat">Learned from your logged history — a pattern estimate, not a diagnosis.</span>`
            );
            mlEl.style.display = 'block';
        } else {
            mlEl.style.display = 'none';
        }
    }

    // 4. Upcoming forecast alerts (top 1-2)
    const alertsEl = document.getElementById('risk-card-alerts');
    if (alertsEl) {
        const alerts = generatePredictiveAlerts().slice(0, 2);
        if (alerts.length > 0) {
            alertsEl.innerHTML = safeHTML(alerts.map(a => {
                const trigger = (a.triggers && a.triggers.length > 0) ? a.triggers[0] : 'Atmospheric change';
                const when = a.hoursUntil <= 1 ? 'within the hour' : `in ~${a.hoursUntil}h`;
                return `<div class="risk-alert">` +
                    `<span class="risk-alert-headline">Heads up: ${safeText(trigger)} ${when}</span>` +
                    `<span class="risk-alert-rec">${safeText(a.recommendation)}</span>` +
                    `</div>`;
            }).join(''));
            alertsEl.style.display = 'flex';
        } else {
            alertsEl.style.display = 'none';
        }
    }
}

// Update weather forecast indicator on log screen (enhanced: risk score + plain language + 6-12h window)
function updateLogWeatherDisplay() {
    const forecastIndicator = document.getElementById('weather-forecast-indicator');
    const clearBox = document.getElementById('weather-clear');
    const warningBox = document.getElementById('weather-warning');

    if (!forecastIndicator) return;

    // Hide if weather tracking is disabled or no data
    if (!weatherData.enabled || !weatherData.current.pressure) {
        forecastIndicator.style.display = 'none';
        return;
    }

    const risk = calculateDailyRiskScore();
    const change24h = getPressureChange24h();
    const trend = getPressureTrend();

    // Look 6-12 hours ahead in forecast for incoming changes (optimal alert window per research)
    const now = new Date();
    const in6h = new Date(now.getTime() + 6 * 3600000);
    const in12h = new Date(now.getTime() + 12 * 3600000);
    let incomingAlert = null;

    if (weatherData.forecast && weatherData.forecast.length > 6) {
        // Find forecast window 6-12 hours from now
        const forecastWindow = weatherData.forecast.filter(f => {
            const t = new Date(f.time);
            return t >= in6h && t <= in12h;
        });

        for (let i = 0; i < forecastWindow.length - 6; i++) {
            const window = forecastWindow.slice(i, i + 7);
            const pressures = window.map(r => r.pressure);
            const change = Math.max(...pressures) - Math.min(...pressures);
            const threshold = weatherData.userThreshold6h || 5;
            if (change >= threshold) {
                const direction = pressures[6] < pressures[0] ? 'falling' : 'rising';
                const hoursUntil = Math.round((new Date(window[0].time) - now) / 3600000);
                incomingAlert = { change: Math.round(change * 10) / 10, direction, hoursUntil };
                break;
            }
        }
    }

    forecastIndicator.style.display = 'block';

    const showWarning = (risk && risk.score >= 4) || incomingAlert !== null;

    if (showWarning) {
        clearBox.style.display = 'none';
        warningBox.style.display = 'block';

        const warningDetail = document.getElementById('weather-warning-detail');
        if (warningDetail) {
            let text = '';
            if (risk && risk.score >= 4) {
                text = `${risk.label} — ${risk.detail}`;
                if (change24h !== null) {
                    const abs = Math.abs(change24h);
                    const dir = change24h > 0 ? 'risen' : 'fallen';
                    if (abs >= 3) text += ` (${dir} ${abs} hPa today)`;
                }
            }
            if (incomingAlert) {
                if (text) text += ' · ';
                text += `Pressure ${incomingAlert.direction} ${incomingAlert.change} hPa in ~${incomingAlert.hoursUntil}h`;
            }
            warningDetail.textContent = text || 'Significant pressure activity detected';
        }
    } else if (change24h !== null) {
        clearBox.style.display = 'block';
        warningBox.style.display = 'none';
        // Update clear box detail with plain-language stable message
        const clearDetail = document.getElementById('weather-clear-detail');
        if (clearDetail) {
            const absChange = Math.abs(change24h);
            clearDetail.textContent = absChange < 2
                ? 'Pressure holding steady'
                : `Pressure ${change24h > 0 ? 'slightly rising' : 'slightly falling'} (${absChange} hPa today)`;
        }
    } else {
        forecastIndicator.style.display = 'none';
    }

    // Keep the always-visible Today outlook card in sync on every
    // weather refresh (all five call sites route through here).
    updateTodayRiskCard();
}

// Calculate weather correlation for analytics (improved accuracy)
function calculateWeatherCorrelation() {
    if (!weatherData.enabled || weatherData.history.length < 7) {
        return null;
    }

    const migraines = getActiveMigraines();

    // Count significant pressure changes and associated migraines
    let significantChangeDays = 0;
    let migrainesOnChangeDays = 0;
    let totalMigraineDays = 0;
    let rapidChangeDays = 0; // Track 3h rapid changes
    let migrainesOnRapidChangeDays = 0;

    // Sort history chronologically for proper analysis
    const sortedHistory = [...weatherData.history]
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    let daysConsidered = 0;
    let migraineWindowDays = 0; // windows with a migraine, on ANY day (baseline)

    sortedHistory.forEach((day, index) => {
        if (index === 0) return; // Skip first day (no previous day to compare)

        const yesterday = sortedHistory[index - 1];
        const dayDate = new Date(day.date);
        daysConsidered++;

        // Calculate 24h change using daily averages
        let change24h = 0;
        if (day.dailyAvg && yesterday.dailyAvg) {
            change24h = Math.abs(day.dailyAvg - yesterday.dailyAvg);
        } else if (day.pressure && yesterday.pressure) {
            // Fallback for old data format
            change24h = Math.abs((day.pressure || day.dailyAvg) - (yesterday.pressure || yesterday.dailyAvg));
        }

        // Check for significant 24h change (>5 hPa clinical threshold - Kimoto 2011)
        const hasSignificantChange = change24h > 5;

        // Check for rapid changes (>5 hPa in 6h - Updated 2026-01-20 based on research review)
        // Note: maxChange3h field name kept for backward compatibility, but now uses 6h window
        const hasRapidChange = day.maxChange3h && day.maxChange3h >= 5;

        if (hasSignificantChange) {
            significantChangeDays++;
        }

        if (hasRapidChange) {
            rapidChangeDays++;
        }

        // Check for migraines within ±12 hours of this day (accounting for lag)
        const windowStart = new Date(dayDate.getTime() - 12 * 60 * 60 * 1000);
        const windowEnd = new Date(dayDate.getTime() + 36 * 60 * 60 * 1000); // +36h to cover full day + 12h

        const hadMigraineInWindow = migraines.some(m => {
            const migraineTime = new Date(m.startTime);
            return migraineTime >= windowStart && migraineTime <= windowEnd;
        });

        if (hadMigraineInWindow) {
            migraineWindowDays++;
        }

        if (hasSignificantChange && hadMigraineInWindow) {
            migrainesOnChangeDays++;
        }

        if (hasRapidChange && hadMigraineInWindow) {
            migrainesOnRapidChangeDays++;
        }

        // Count total migraine days in tracked period
        const hadMigraineThisDay = migraines.some(m => {
            const migraineDate = new Date(m.startTime).toISOString().split('T')[0];
            return migraineDate === day.date;
        });

        if (hadMigraineThisDay) {
            totalMigraineDays++;
        }
    });

    // Use whichever correlation is stronger (24h or 3h)
    let primaryCorrelation = 0;
    let primaryType = '24h';

    if (significantChangeDays === 0 && rapidChangeDays === 0) {
        return {
            percentage: 0,
            significantChangeDays: 0,
            migrainesOnChangeDays: 0,
            level: 'insufficient',
            message: 'Not enough significant pressure changes recorded yet.'
        };
    }

    // Calculate both correlations
    const correlation24h = significantChangeDays > 0 ?
        Math.round((migrainesOnChangeDays / significantChangeDays) * 100) : 0;

    const correlation3h = rapidChangeDays > 0 ?
        Math.round((migrainesOnRapidChangeDays / rapidChangeDays) * 100) : 0;

    // Use the stronger correlation for classification
    if (correlation3h > correlation24h) {
        primaryCorrelation = correlation3h;
        primaryType = '3h rapid';
    } else {
        primaryCorrelation = correlation24h;
        primaryType = '24h';
    }

    // Compare against the baseline migraine rate across ALL tracked
    // days - a raw conditional probability overstates the link for
    // frequent migraineurs (70% of all days having migraines would
    // otherwise read as a "70% pressure correlation")
    const baselinePercentage = daysConsidered > 0 ?
        Math.round((migraineWindowDays / daysConsidered) * 100) : 0;
    const relativeRisk = baselinePercentage > 0 ?
        primaryCorrelation / baselinePercentage : null;
    const sampleDays = primaryType === '24h' ? significantChangeDays : rapidChangeDays;

    let level, message;
    const baselineNote = baselinePercentage > 0
        ? ` Migraines followed ${primaryCorrelation}% of ${primaryType} pressure-change days vs ${baselinePercentage}% of all tracked days.`
        : '';

    if (sampleDays < 5) {
        level = 'insufficient';
        message = `Only ${sampleDays} significant pressure-change day${sampleDays === 1 ? '' : 's'} recorded so far - more data is needed before a reliable pattern can be identified.`;
    } else if (relativeRisk !== null && relativeRisk >= 1.5 && primaryCorrelation >= 40) {
        level = 'strong';
        message = `Strong correlation detected with ${primaryType} pressure changes (${relativeRisk.toFixed(1)}x your baseline rate). This appears to be a significant trigger for you.${baselineNote}`;
    } else if (relativeRisk !== null && relativeRisk >= 1.2) {
        level = 'moderate';
        message = `Moderate correlation with ${primaryType} pressure changes (${relativeRisk.toFixed(1)}x your baseline rate). May affect your migraines.${baselineNote}`;
    } else {
        level = 'weak';
        message = `Pressure-change days don't show meaningfully more migraines than your baseline. Other triggers may be more significant.${baselineNote}`;
    }

    return {
        percentage: primaryCorrelation,
        correlation24h: correlation24h,
        correlation3h: correlation3h,
        significantChangeDays: significantChangeDays,
        rapidChangeDays: rapidChangeDays,
        migrainesOnChangeDays: migrainesOnChangeDays,
        migrainesOnRapidChangeDays: migrainesOnRapidChangeDays,
        totalMigraineDays: totalMigraineDays,
        baselinePercentage: baselinePercentage,
        relativeRisk: relativeRisk,
        level: level,
        message: message,
        primaryType: primaryType
    };
}

// ============================================
// PERSONAL PROFILING & MACHINE LEARNING
// ============================================

// Main function to analyze user's personal weather sensitivity profile
function analyzePersonalWeatherProfile() {
    if (!weatherData.enabled || weatherData.history.length < 7) {
        return; // Need at least 7 days of data
    }

    const migraines = getActiveMigraines();
    if (migraines.length < 3) {
        return; // Need at least 3 migraines for meaningful analysis
    }

    console.log('🧠 Analyzing personal weather sensitivity profile...');

    const profile = weatherData.personalProfile;

    // 1. Calculate personal thresholds
    const thresholds = calculatePersonalThresholds(migraines);
    profile.threshold24h = thresholds.threshold24h;
    profile.thresholdRapid = thresholds.thresholdRapid;

    // 2. Analyze direction sensitivity (drops vs rises)
    const direction = analyzeDirectionSensitivity(migraines);
    profile.dropSensitive = direction.dropSensitive;
    profile.riseSensitive = direction.riseSensitive;
    profile.dropPercentage = direction.dropPercentage;
    profile.risePercentage = direction.risePercentage;

    // 3. Analyze absolute pressure sensitivity
    const absolute = analyzeAbsolutePressureSensitivity(migraines);
    profile.lowPressureSensitive = absolute.lowPressureSensitive;
    profile.avgTriggerPressure = absolute.avgTriggerPressure;

    // 4. Detect multi-day cumulative patterns
    const cumulative = detectMultiDayPatterns(migraines);
    profile.cumulativeSensitive = cumulative.cumulativeSensitive;
    profile.avgDaysToTrigger = cumulative.avgDaysToTrigger;

    // 5. Analyze temperature sensitivity (2024 meta-analysis: OR=1.15, strongest weather factor)
    const tempSensitivity = analyzeTemperatureSensitivity(migraines);
    profile.tempSensitive = tempSensitivity.tempSensitive;
    profile.tempHighSensitive = tempSensitivity.tempHighSensitive;
    profile.avgTempChangeAtMigraine = tempSensitivity.avgTempChangeAtMigraine;

    // Derive strongestWeatherFactor based on personal data (not just population averages)
    const factorScores = {
        pressure: (profile.dropPercentage + profile.risePercentage) / 100,
        temperature: tempSensitivity.tempChangePercentage / 100,
        humidity: profile.highHumiditySensitive ? 0.5 : 0
    };
    profile.strongestWeatherFactor = Object.entries(factorScores)
        .sort((a, b) => b[1] - a[1])[0][0];

    // 6. Analyze seasonal patterns
    profile.seasonalVariation = analyzeSeasonalPatterns(migraines);

    // Update metadata
    profile.lastAnalyzed = Date.now();
    profile.sampleSize = migraines.length;
    profile.confidenceLevel = migraines.length >= 10 ? 'high' :
                              migraines.length >= 5 ? 'medium' : 'low';

    saveWeatherData();

    console.log('[SUCCESS] Personal profile analyzed:', {
        threshold24h: profile.threshold24h,
        thresholdRapid: profile.thresholdRapid,
        dropSensitive: profile.dropSensitive,
        confidence: profile.confidenceLevel,
        sampleSize: profile.sampleSize
    });

    // Train ML model if enough data
    if (migraines.length >= 10 && weatherData.history.length >= 14) {
        trainMigrainePredictionModel(migraines);
    }
}

// Calculate user's personal trigger thresholds based on actual migraine history
function calculatePersonalThresholds(migraines) {
    const changes24h = [];
    const changesRapid = [];

    migraines.forEach(migraine => {
        const migraineDate = new Date(migraine.startTime).toISOString().split('T')[0];

        // Find weather data for days around the migraine
        for (let daysBack = 0; daysBack <= 2; daysBack++) {
            const checkDate = new Date(migraine.startTime);
            checkDate.setDate(checkDate.getDate() - daysBack);
            const checkDateStr = checkDate.toISOString().split('T')[0];

            const weatherEntry = weatherData.history.find(h => h.date === checkDateStr);
            if (weatherEntry) {
                // Record 24h change if available
                if (weatherEntry.maxChange24h && Math.abs(weatherEntry.maxChange24h) > 0) {
                    changes24h.push(Math.abs(weatherEntry.maxChange24h));
                }

                // Record rapid change if available
                if (weatherEntry.maxChange3h && weatherEntry.maxChange3h > 0) {
                    changesRapid.push(weatherEntry.maxChange3h);
                }
            }
        }
    });

    // Calculate median (more robust than mean for outliers)
    const median = arr => {
        if (arr.length === 0) return null;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ?
            (sorted[mid - 1] + sorted[mid]) / 2 :
            sorted[mid];
    };

    // Use 25th percentile (more sensitive - catches more triggers)
    const percentile25 = arr => {
        if (arr.length === 0) return null;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.floor(sorted.length * 0.25);
        return sorted[index];
    };

    return {
        threshold24h: percentile25(changes24h) || 5,  // Default to 5 if no data
        thresholdRapid: percentile25(changesRapid) || 5
    };
}

// Analyze if user is sensitive to pressure drops vs rises
function analyzeDirectionSensitivity(migraines) {
    let dropsCount = 0;
    let risesCount = 0;
    let totalWithData = 0;

    migraines.forEach(migraine => {
        const migraineDate = new Date(migraine.startTime).toISOString().split('T')[0];

        // Check 1-2 days before migraine
        for (let daysBack = 1; daysBack <= 2; daysBack++) {
            const checkDate = new Date(migraine.startTime);
            checkDate.setDate(checkDate.getDate() - daysBack);
            const checkDateStr = checkDate.toISOString().split('T')[0];

            const weatherEntry = weatherData.history.find(h => h.date === checkDateStr);
            if (weatherEntry && weatherEntry.maxChange24h !== null) {
                totalWithData++;
                if (weatherEntry.maxChange24h < -2) { // Significant drop
                    dropsCount++;
                } else if (weatherEntry.maxChange24h > 2) { // Significant rise
                    risesCount++;
                }
            }
        }
    });

    const dropPercentage = totalWithData > 0 ? Math.round((dropsCount / totalWithData) * 100) : 0;
    const risePercentage = totalWithData > 0 ? Math.round((risesCount / totalWithData) * 100) : 0;

    return {
        dropSensitive: dropPercentage >= 40,
        riseSensitive: risePercentage >= 40,
        dropPercentage: dropPercentage,
        risePercentage: risePercentage
    };
}

// Analyze sensitivity to absolute low pressure
function analyzeAbsolutePressureSensitivity(migraines) {
    const pressuresAtMigraine = [];

    migraines.forEach(migraine => {
        const migraineDate = new Date(migraine.startTime).toISOString().split('T')[0];
        const weatherEntry = weatherData.history.find(h => h.date === migraineDate);

        if (weatherEntry) {
            const pressure = weatherEntry.dailyAvg || weatherEntry.pressure;
            if (pressure) {
                pressuresAtMigraine.push(pressure);
            }
        }
    });

    if (pressuresAtMigraine.length === 0) {
        return { lowPressureSensitive: false, avgTriggerPressure: null };
    }

    const avgPressure = pressuresAtMigraine.reduce((a, b) => a + b, 0) / pressuresAtMigraine.length;
    const lowPressureCount = pressuresAtMigraine.filter(p => p < 1007).length;
    const lowPressurePercent = (lowPressureCount / pressuresAtMigraine.length) * 100;

    return {
        lowPressureSensitive: lowPressurePercent >= 40,
        avgTriggerPressure: Math.round(avgPressure * 10) / 10
    };
}

// Analyze user's personal temperature sensitivity
// 2024 meta-analysis: temperature OR=1.15, strongest weather factor in population data
// Mukamal 2009: 5°C/24h increase = +7.5% headache risk in 7,054 patients
function analyzeTemperatureSensitivity(migraines) {
    const tempChangesAtMigraine = [];
    const tempsAtMigraine = [];
    let tempChangeCount = 0;

    migraines.forEach(migraine => {
        for (let daysBack = 0; daysBack <= 1; daysBack++) {
            const checkDate = new Date(migraine.startTime);
            checkDate.setDate(checkDate.getDate() - daysBack);
            const checkDateStr = checkDate.toISOString().split('T')[0];

            const weatherEntry = weatherData.history.find(h => h.date === checkDateStr);
            if (weatherEntry && weatherEntry.dailyTempAvg !== null && weatherEntry.dailyTempAvg !== undefined) {
                tempsAtMigraine.push(weatherEntry.dailyTempAvg);

                // Calculate temp change for this day vs. previous
                const prevDate = new Date(checkDate);
                prevDate.setDate(prevDate.getDate() - 1);
                const prevEntry = weatherData.history.find(h => h.date === prevDate.toISOString().split('T')[0]);
                if (prevEntry && prevEntry.dailyTempAvg !== null && prevEntry.dailyTempAvg !== undefined) {
                    const change = Math.abs(weatherEntry.dailyTempAvg - prevEntry.dailyTempAvg);
                    tempChangesAtMigraine.push(change);
                    if (change >= 5) tempChangeCount++;
                }
            }
        }
    });

    if (tempChangesAtMigraine.length === 0) {
        return { tempSensitive: false, tempHighSensitive: false, avgTempChangeAtMigraine: null, tempChangePercentage: 0 };
    }

    const avgChange = tempChangesAtMigraine.reduce((a, b) => a + b, 0) / tempChangesAtMigraine.length;
    const tempChangePercentage = Math.round((tempChangeCount / migraines.length) * 100);
    const highTempCount = tempsAtMigraine.filter(t => t > 32).length;
    const highTempPercentage = Math.round((highTempCount / tempsAtMigraine.length) * 100);

    return {
        tempSensitive: tempChangePercentage >= 35,         // ≥35% of attacks preceded by ≥5°C swing
        tempHighSensitive: highTempPercentage >= 40,       // ≥40% of attacks on hot days (>32°C/90°F)
        avgTempChangeAtMigraine: Math.round(avgChange * 10) / 10,
        tempChangePercentage
    };
}

// Detect if user reacts to cumulative multi-day pressure changes
function detectMultiDayPatterns(migraines) {
    let cumulativeCount = 0;
    let totalAnalyzed = 0;
    const daysToTrigger = [];

    migraines.forEach(migraine => {
        const migraineDate = new Date(migraine.startTime);

        // Look back 5 days to find pressure change patterns
        let cumulativeChange = 0;
        let daysSinceChange = null;

        for (let daysBack = 1; daysBack <= 5; daysBack++) {
            const checkDate = new Date(migraineDate);
            checkDate.setDate(checkDate.getDate() - daysBack);
            const checkDateStr = checkDate.toISOString().split('T')[0];

            const weatherEntry = weatherData.history.find(h => h.date === checkDateStr);
            if (weatherEntry && weatherEntry.maxChange24h !== null) {
                cumulativeChange += weatherEntry.maxChange24h;

                // If cumulative drop > 8 hPa over multiple days
                if (cumulativeChange < -8) {
                    cumulativeCount++;
                    daysSinceChange = daysBack;
                    daysToTrigger.push(daysBack);
                    totalAnalyzed++;
                    break;
                }
            }
        }

        if (daysSinceChange === null) {
            totalAnalyzed++;
        }
    });

    const avgDays = daysToTrigger.length > 0 ?
        daysToTrigger.reduce((a, b) => a + b, 0) / daysToTrigger.length : 1;

    return {
        cumulativeSensitive: totalAnalyzed > 0 && (cumulativeCount / totalAnalyzed) >= 0.3,
        avgDaysToTrigger: Math.round(avgDays * 10) / 10
    };
}

// Analyze seasonal variation in weather sensitivity
function analyzeSeasonalPatterns(migraines) {
    const seasons = { winter: [], spring: [], summer: [], fall: [] };
    const weatherMigraines = [];

    migraines.forEach(migraine => {
        const migraineDate = new Date(migraine.startTime);
        const month = migraineDate.getMonth();
        const season = month <= 2 ? 'winter' :
                      month <= 5 ? 'spring' :
                      month <= 8 ? 'summer' : 'fall';

        // Check if weather-related (significant pressure change 0-2 days before)
        let wasWeatherRelated = false;
        for (let daysBack = 0; daysBack <= 2; daysBack++) {
            const checkDate = new Date(migraineDate);
            checkDate.setDate(checkDate.getDate() - daysBack);
            const checkDateStr = checkDate.toISOString().split('T')[0];

            const weatherEntry = weatherData.history.find(h => h.date === checkDateStr);
            if (weatherEntry && weatherEntry.maxChange24h && Math.abs(weatherEntry.maxChange24h) > 5) {
                wasWeatherRelated = true;
                break;
            }
        }

        seasons[season].push(wasWeatherRelated ? 1 : 0);
    });

    // Calculate weather-sensitivity ratio per season
    const seasonalRatios = {};
    let avgRatio = 0;
    let seasonCount = 0;

    for (const season in seasons) {
        if (seasons[season].length > 0) {
            const weatherCount = seasons[season].filter(x => x === 1).length;
            const ratio = weatherCount / seasons[season].length;
            seasonalRatios[season] = ratio;
            avgRatio += ratio;
            seasonCount++;
        }
    }

    avgRatio = seasonCount > 0 ? avgRatio / seasonCount : 1;

    // Normalize to show relative sensitivity (1.0 = average)
    const normalized = {};
    for (const season in seasonalRatios) {
        normalized[season] = avgRatio > 0 ?
            Math.round((seasonalRatios[season] / avgRatio) * 10) / 10 : 1.0;
    }

    return normalized;
}

// Get effective threshold based on user settings and learned thresholds
function getEffectiveThreshold(type = '24h') {
    const profile = weatherData.personalProfile;

    // Check user's sensitivity setting
    if (profile.sensitivityLevel === 'custom') {
        return type === '24h' ?
            (profile.customThreshold24h || 5) :
            (profile.customThresholdRapid || 5);
    }

    // Use learned threshold if confidence is high
    if (profile.confidenceLevel === 'high') {
        const learned = type === '24h' ? profile.threshold24h : profile.thresholdRapid;
        if (learned !== null) {
            // Apply sensitivity level multiplier
            const multiplier = profile.sensitivityLevel === 'sensitive' ? 0.7 :
                              profile.sensitivityLevel === 'conservative' ? 1.3 : 1.0;
            return Math.round(learned * multiplier * 10) / 10;
        }
    }

    // Fall back to standard thresholds with sensitivity adjustment
    const standard = type === '24h' ? 5 : 5;
    const multiplier = profile.sensitivityLevel === 'sensitive' ? 0.6 :
                      profile.sensitivityLevel === 'conservative' ? 1.5 : 1.0;
    return Math.round(standard * multiplier * 10) / 10;
}

// Generate predictive alerts based on forecast and personal profile
// UPDATED 2026-02-27: Temperature now weighted more heavily per 2024 meta-analysis (OR=1.15)
// Pressure still dominant in 6h window (Katsuki 2023), but temperature adds compound risk
function generatePredictiveAlerts() {
    if (!weatherData.enabled || !weatherData.forecast || weatherData.forecast.length < 12) {
        return [];
    }

    const alerts = [];
    const profile = weatherData.personalProfile;
    const threshold24h = getEffectiveThreshold('24h');
    const thresholdRapid = getEffectiveThreshold('rapid');

    // Analyze next 24 hours of forecast
    const now = new Date();
    for (let i = 0; i < Math.min(weatherData.forecast.length - 6, 24); i++) {
        const window = weatherData.forecast.slice(i, i + 7);
        const startTime = new Date(window[0].time);

        if (startTime <= now) continue; // Only future predictions

        const pressures = window.map(r => r.pressure);
        const temps = window.map(r => r.temperature).filter(t => t !== null && t !== undefined);
        const currentPressure = pressures[0];
        const totalChange = pressures[6] - pressures[0];
        const rapidChange = Math.max(...pressures) - Math.min(...pressures);
        const tempSwing = temps.length >= 2
            ? Math.abs(Math.max(...temps) - Math.min(...temps))
            : 0;
        const currentTemp = temps.length > 0 ? temps[0] : null;

        // Check if this matches user's trigger pattern
        let triggerProbability = 0;
        const triggers = [];

        // Check rapid pressure change (primary clinical metric, Katsuki 2023)
        if (rapidChange >= thresholdRapid) {
            triggerProbability += 30;
            const changeDisplay = formatPressureChange(totalChange < 0 ? -rapidChange : rapidChange);
            triggers.push(`Rapid pressure ${totalChange < 0 ? 'drop' : 'rise'} (${changeDisplay} in 6h)`);
        }

        // Check if pressure direction matches user's sensitivity
        if (totalChange < 0 && profile.dropSensitive) {
            triggerProbability += 20;
        } else if (totalChange > 0 && profile.riseSensitive) {
            triggerProbability += 15;
        }

        // Check absolute low pressure (Okuma 2015, confirmed Farah 2025)
        if (profile.lowPressureSensitive && currentPressure < 1007) {
            triggerProbability += 25;
            triggers.push(`Low pressure zone (${formatPressure(currentPressure)})`);
        }

        // Check 24h pressure projection
        if (i + 24 < weatherData.forecast.length) {
            const pressure24hLater = weatherData.forecast[i + 24].pressure;
            const change24h = Math.abs(pressure24hLater - currentPressure);
            if (change24h >= threshold24h) {
                triggerProbability += 20;
                const dir = pressure24hLater < currentPressure ? 'drop' : 'rise';
                triggers.push(`24h pressure ${dir} (${formatPressureChange(pressure24hLater - currentPressure)})`);
            }
        }

        // Temperature factor (2024 meta-analysis: OR=1.15, stronger than pressure OR=1.07)
        // Only add probability if user is personally temperature-sensitive OR swing is extreme
        if (tempSwing >= 10) {
            // Extreme swing (>10°C/18°F) — relevant for everyone
            triggerProbability += 20;
            triggers.push(`Large temperature swing (${formatTemperature(Math.min(...temps))}–${formatTemperature(Math.max(...temps))})`);
        } else if (tempSwing >= 5 && profile.tempSensitive) {
            triggerProbability += 15;
            triggers.push(`Temperature change (${formatTemperature(Math.min(...temps))}–${formatTemperature(Math.max(...temps))})`);
        }
        // Extreme heat/cold compound
        if (currentTemp !== null && (currentTemp > 32 || currentTemp < -5) && profile.tempHighSensitive) {
            triggerProbability += 10;
        }

        // If probability high enough, create alert
        if (triggerProbability >= 40) {
            const hoursUntil = Math.round((startTime - now) / (1000 * 60 * 60));
            alerts.push({
                time: startTime.toISOString(),
                hoursUntil: hoursUntil,
                probability: Math.min(triggerProbability, 95), // Cap at 95%
                triggers: triggers,
                pressure: currentPressure,
                change: totalChange,
                recommendation: getPredictiveRecommendation(triggerProbability, hoursUntil)
            });
        }
    }

    // Return only the most imminent high-probability alerts
    return alerts
        .filter(a => a.probability >= 50)
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3);
}

// Get recommendation based on prediction
function getPredictiveRecommendation(probability, hoursUntil) {
    if (probability >= 75) {
        if (hoursUntil <= 6) {
            return 'HIGH RISK - Consider taking preventive medication now';
        } else {
            return 'High risk predicted - Plan ahead and have medication ready';
        }
    } else if (probability >= 60) {
        return 'Moderate risk - Monitor symptoms and be prepared';
    } else {
        return 'Elevated risk - Stay aware of potential triggers';
    }
}

// Simple ML model: Logistic Regression for migraine probability
function trainMigrainePredictionModel(migraines) {
    console.log('🤖 Training migraine prediction model...');

    const trainingData = [];
    const labels = [];

    // Build training dataset from last 30 days
    const sortedHistory = [...weatherData.history]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-30);

    sortedHistory.forEach(day => {
        const dayDate = new Date(day.date);

        // Features
        // v5: Added temp change (index 7) per 2024 meta-analysis (OR=1.15, strongest)
        const prevDay = sortedHistory[sortedHistory.indexOf(day) - 1];
        const tempChange24h = (day.dailyTempAvg !== null && day.dailyTempAvg !== undefined &&
                               prevDay && prevDay.dailyTempAvg !== null && prevDay.dailyTempAvg !== undefined)
            ? Math.abs(day.dailyTempAvg - prevDay.dailyTempAvg) : 0;
        const features = [
            day.dailyAvg || day.pressure || 1013, // Absolute pressure
            day.maxChange24h || 0,                 // 24h pressure change
            day.maxChange3h || 0,                  // Rapid (6h) pressure change
            dayDate.getDay(),                      // Day of week (0-6)
            dayDate.getMonth(),                    // Month (0-11)
            day.dailyAvg < 1007 ? 1 : 0,          // Low pressure flag
            (day.maxChange24h || 0) < 0 ? 1 : 0,  // Dropping flag
            tempChange24h                          // Temperature change (°C) — 2024 meta OR=1.15
        ];

        // Label: Did migraine occur on this day?
        const hadMigraine = migraines.some(m => {
            const mDate = new Date(m.startTime).toISOString().split('T')[0];
            return mDate === day.date;
        });

        trainingData.push(features);
        labels.push(hadMigraine ? 1 : 0);
    });

    // Z-score normalize features so absolute pressure (~1013) can't
    // drown out the 0-11 scale features during gradient descent
    const { means, stds } = computeFeatureStats(trainingData);
    const normalizedData = trainingData.map(row => normalizeFeatures(row, means, stds));

    // Simple logistic regression (gradient descent)
    const weights = simpleLogisticRegression(normalizedData, labels);

    // Evaluate with balanced accuracy (mean of sensitivity and
    // specificity). Plain accuracy is trivially high on imbalanced
    // data - an all-'no migraine' predictor can score 80%+ - so the
    // old 'accuracy >= 60' gate enabled meaningless models.
    let truePos = 0, trueNeg = 0, falsePos = 0, falseNeg = 0;
    normalizedData.forEach((features, i) => {
        const prediction = sigmoid(dotProduct(weights, features)) > 0.5 ? 1 : 0;
        if (prediction === 1 && labels[i] === 1) truePos++;
        else if (prediction === 0 && labels[i] === 0) trueNeg++;
        else if (prediction === 1 && labels[i] === 0) falsePos++;
        else falseNeg++;
    });
    const positives = truePos + falseNeg;
    const negatives = trueNeg + falsePos;
    const sensitivity = positives > 0 ? truePos / positives : 0;
    const specificity = negatives > 0 ? trueNeg / negatives : 0;
    const balancedAccuracy = (sensitivity + specificity) / 2;
    const accuracy = Math.round(((truePos + trueNeg) / normalizedData.length) * 100);

    // Enable only when the model shows real skill over guessing
    // (balanced accuracy > 0.55) and there are enough migraine days
    // to have learned anything (>= 3 positive examples)
    const enabled = balancedAccuracy >= 0.55 && positives >= 3;

    weatherData.mlModel = {
        modelVersion: 2, // v2: normalized features + balanced-accuracy gate
        enabled: enabled,
        weights: weights,
        featureMeans: means,
        featureStds: stds,
        features: ['pressure', 'change24h', 'changeRapid', 'dayOfWeek', 'month', 'lowPressure', 'dropping', 'tempChange24h'],
        accuracy: accuracy,
        balancedAccuracy: Math.round(balancedAccuracy * 100),
        lastTrained: Date.now(),
        predictions: []
    };

    saveWeatherData();

    console.log(`[SUCCESS] Model trained - Balanced accuracy: ${Math.round(balancedAccuracy * 100)}% (raw ${accuracy}%)`,
                enabled ? '(enabled)' : '(disabled - no skill over baseline)');
}

function computeFeatureStats(data) {
    const n = data[0].length;
    const means = new Array(n).fill(0);
    const stds = new Array(n).fill(0);

    data.forEach(row => row.forEach((v, j) => { means[j] += v; }));
    means.forEach((sum, j) => { means[j] = sum / data.length; });

    data.forEach(row => row.forEach((v, j) => {
        stds[j] += Math.pow(v - means[j], 2);
    }));
    stds.forEach((sum, j) => {
        stds[j] = Math.sqrt(sum / data.length) || 1; // avoid divide-by-zero
    });

    return { means, stds };
}

function normalizeFeatures(row, means, stds) {
    return row.map((v, j) => (v - means[j]) / stds[j]);
}

// Simple logistic regression implementation
function simpleLogisticRegression(X, y, learningRate = 0.01, iterations = 1000) {
    const m = X.length;
    const n = X[0].length;
    let weights = new Array(n).fill(0);

    for (let iter = 0; iter < iterations; iter++) {
        const gradients = new Array(n).fill(0);

        for (let i = 0; i < m; i++) {
            const prediction = sigmoid(dotProduct(weights, X[i]));
            const error = prediction - y[i];

            for (let j = 0; j < n; j++) {
                gradients[j] += error * X[i][j];
            }
        }

        for (let j = 0; j < n; j++) {
            weights[j] -= (learningRate / m) * gradients[j];
        }
    }

    return weights;
}

function sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
}

function dotProduct(a, b) {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

// Predict migraine probability using ML model
function predictMigraineProbability(pressureFeatures) {
    if (!weatherData.mlModel.enabled || !weatherData.mlModel.weights) {
        return null;
    }

    // Guard against stale models: wrong feature count (pre-v5) or
    // trained before normalization was introduced (modelVersion < 2)
    if (!weatherData.mlModel.weights ||
        weatherData.mlModel.weights.length !== 8 ||
        weatherData.mlModel.modelVersion !== 2 ||
        !weatherData.mlModel.featureMeans || !weatherData.mlModel.featureStds) {
        return null; // Model needs retraining
    }
    const features = [
        pressureFeatures.pressure,
        pressureFeatures.change24h || 0,
        pressureFeatures.changeRapid || 0,
        new Date().getDay(),
        new Date().getMonth(),
        pressureFeatures.pressure < 1007 ? 1 : 0,
        (pressureFeatures.change24h || 0) < 0 ? 1 : 0,
        pressureFeatures.tempChange24h || 0  // 2024 meta-analysis: OR=1.15
    ];

    const normalized = normalizeFeatures(
        features, weatherData.mlModel.featureMeans, weatherData.mlModel.featureStds
    );
    const probability = sigmoid(dotProduct(weatherData.mlModel.weights, normalized));
    return Math.round(probability * 100);
}

// ============================================
// ANALYTICS SYSTEM
// ============================================

let analyticsCharts = {
    frequency: null,
    pain: null,
    time: null,
    dow: null,
    pressure: null
};

// Light themes use a light chart palette; warm-dark and high-contrast
// (a dark high-contrast theme) use the dark palette.
const LIGHT_THEMES = new Set(['warm-light']);
function isDarkTheme() {
    return !LIGHT_THEMES.has(document.documentElement.getAttribute('data-theme'));
}

// Read a CSS custom property off :root so charts follow whichever theme
// is live rather than carrying their own palette.
function themeToken(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

// Accepts #rgb / #rrggbb / rgb() / rgba() and returns an rgba() string.
function withAlpha(color, alpha) {
    if (!color) return `rgba(0, 0, 0, ${alpha})`;
    const hex = color.trim();
    if (hex.startsWith('#')) {
        let h = hex.slice(1);
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const n = parseInt(h, 16);
        if (h.length !== 6 || isNaN(n)) return `rgba(0, 0, 0, ${alpha})`;
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    }
    const m = hex.match(/rgba?\(([^)]+)\)/);
    if (m) {
        const [r, g, b] = m[1].split(',').map(p => parseFloat(p));
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return hex;
}

// Chart palette, derived from the active theme's brand tokens.
function getChartColors() {
    const primary = themeToken('--accent-green', '#8fb394');
    const text = themeToken('--text-primary', '#ede8df');

    return {
        text: text,
        textSecondary: themeToken('--text-secondary', '#cfc7b8'),
        grid: withAlpha(text, 0.12),
        primary: primary,
        primaryBg: withAlpha(primary, 0.2),
        primaryFill: withAlpha(primary, 0.6),
        green: themeToken('--pain-mild', '#8fb394'),
        yellow: themeToken('--pain-moderate', '#d4a574'),
        red: themeToken('--pain-severe', '#c97a6f'),
        blue: themeToken('--accent-blue', '#7a95b8')
    };
}

async function initializeAnalytics() {
    if (!chartsAvailable()) {
        try { await loadOptionalLibrary('chart'); } catch { /* Existing fallback explains missing charts. */ }
    }
    // Set up event listener for range change
    document.getElementById('analytics-range').addEventListener('change', renderAnalytics);

    const emptyCta = document.getElementById('analytics-empty-cta');
    if (emptyCta && !emptyCta.dataset.wired) {
        emptyCta.dataset.wired = 'true';
        emptyCta.addEventListener('click', () => showPage('log'));
    }

    // Initial render
    renderAnalytics();
}

// Chart.js and jsPDF come from a CDN, but the app is offline-first: a
// first load without a connection, or a blocked CDN, leaves them
// undefined. Say so rather than rendering empty boxes under headings
// that promise trends.
function chartsAvailable() {
    return typeof Chart !== 'undefined';
}

function showChartFallback() {
    const message = navigator.onLine
        ? 'Charts could not be loaded. Reconnect or reload to see them.'
        : "Charts need a connection the first time they load. Everything else works offline, and your data is safe.";
    ['frequency-chart', 'pain-chart', 'time-chart', 'dow-chart', 'pressure-chart'].forEach(id => {
        const canvas = document.getElementById(id);
        if (!canvas || !canvas.parentNode) return;
        let note = canvas.parentNode.querySelector('.chart-fallback');
        if (!note) {
            note = document.createElement('p');
            note.className = 'chart-fallback';
            note.style.cssText = 'color: var(--text-secondary); font-size: var(--text-md); padding: var(--space-4) 0;';
            canvas.parentNode.insertBefore(note, canvas);
        }
        note.textContent = message;
        canvas.style.display = 'none';
    });
}

function renderAnalytics() {
    if (!chartsAvailable()) {
        // Everything below except the five canvases is plain DOM, so the
        // metrics and the ranked breakdowns still render normally.
        showChartFallback();
        renderAnalyticsData();
        return;
    }

    // Check for reduced motion preference and disable Chart.js animations
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        Chart.defaults.animation = false;
        Chart.defaults.animations = {
            colors: false,
            x: false,
            y: false
        };
        Chart.defaults.transitions = {
            active: { animation: { duration: 0 } },
            resize: { animation: { duration: 0 } },
            show: { animation: { duration: 0 } },
            hide: { animation: { duration: 0 } }
        };
    } else {
        // Enable smooth animations for users who haven't opted out
        Chart.defaults.animation = {
            duration: 400,
            easing: 'easeInOutQuart'
        };
    }

    renderAnalyticsData();
}

// Everything that does not itself require Chart.js. Charts are rendered
// from here too, but each call is guarded so this whole path still works
// when the CDN library is unavailable.
// Show either the analysis or the empty state, never a mix of zeros and
// headings promising trends.
function setAnalyticsEmptyState(isEmpty) {
    const empty = document.getElementById('analytics-empty');
    if (empty) empty.style.display = isEmpty ? 'block' : 'none';
    ['analytics-range-card', 'analytics-metrics'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isEmpty ? 'none' : '';
    });
    ['frequency-chart', 'pain-chart', 'time-chart', 'dow-chart'].forEach(id => {
        const card = document.getElementById(id)?.closest('.section-card');
        if (card) card.style.display = isEmpty ? 'none' : '';
    });
}

function renderAnalyticsData() {
    if (getActiveMigraines().length === 0) {
        setAnalyticsEmptyState(true);
        return;
    }
    setAnalyticsEmptyState(false);

    const range = document.getElementById('analytics-range').value;
    const activeMigraines = getActiveMigraines();

    // Filter data by range
    let startDate;
    const endDate = new Date();

    if (range === 'all') {
        // Span from the first logged episode, not the Unix epoch -
        // an epoch start made avg/month ~0 and generated ~670
        // frequency-chart buckets
        const earliest = activeMigraines.reduce((min, m) => {
            const t = new Date(m.startTime);
            return (!min || t < min) ? t : min;
        }, null);
        startDate = earliest || new Date();
    } else {
        const days = parseInt(range);
        startDate = new Date(endDate - days * 24 * 60 * 60 * 1000);
    }

    const filteredData = activeMigraines.filter(m => {
        const date = new Date(m.startTime);
        return date >= startDate && date <= endDate;
    });

    // Calculate and display metrics
    updateAnalyticsMetrics(filteredData, startDate, endDate);

    // Render charts
    if (chartsAvailable()) {
        renderFrequencyChart(filteredData, startDate, endDate);
        renderPainChart(filteredData);
        renderTimeChart(filteredData);
        renderDayOfWeekChart(filteredData);
    }

    // Render weather-related analytics if enabled
    if (weatherData.enabled && weatherData.history.length >= 7) {
        renderWeatherCorrelation(filteredData);
        if (chartsAvailable()) renderPressureChart(filteredData, startDate, endDate);
    } else {
        // Hide weather analytics if not enabled or insufficient data
        document.getElementById('weather-correlation-card').style.display = 'none';
        document.getElementById('pressure-chart-card').style.display = 'none';
    }

    // Render medication analytics if any medication data exists
    renderMedicationAnalytics(filteredData);

    // Render symptom and trigger frequency breakdowns
    renderSymptomAnalytics(filteredData);
    renderTriggerAnalytics(filteredData);

    // Cross-tabulate triggers against measured pressure activity
    renderTriggerWeatherCorrelation(filteredData);

    // Phase breakdowns: warning signs (prodrome) + after-effects (postdrome)
    renderOptionAnalytics('prodrome-analytics-card', 'prodrome-analytics-content', filteredData, 'prodrome', PRODROME_KEYS, PRODROME_LABELS, 'warning signs');
    renderOptionAnalytics('postdrome-analytics-card', 'postdrome-analytics-content', filteredData, 'postdrome', POSTDROME_KEYS, POSTDROME_LABELS, 'after-effects');

    // Head-pain location + quality breakdowns
    renderOptionAnalytics('location-analytics-card', 'location-analytics-content', filteredData, 'painLocations', HEAD_ZONE_KEYS, HEAD_ZONE_LABELS, 'pain locations');
    renderOptionAnalytics('quality-analytics-card', 'quality-analytics-content', filteredData, 'painQuality', PAIN_QUALITY_KEYS, PAIN_QUALITY_LABELS, 'pain quality');
}

// Ranked frequency breakdown of a controlled option list across episodes.
function renderOptionAnalytics(cardId, contentId, data, field, keySet, labelMap, noun) {
    const card = document.getElementById(cardId);
    const content = document.getElementById(contentId);
    if (!card || !content) return;

    const counts = {};
    let episodesWith = 0;
    data.forEach(m => {
        const keys = Array.isArray(m[field]) ? m[field].filter(k => keySet.has(k)) : [];
        if (keys.length > 0) episodesWith++;
        keys.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
    });

    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (ranked.length === 0) {
        card.style.display = 'none';
        return;
    }
    card.style.display = 'block';

    const colors = getChartColors();
    const rows = ranked.map(([key, count]) => {
        // Bar length must match the percentage printed beside it. It was
        // previously scaled to the top item, so a lone "1 (14%)" entry
        // drew a full-width bar.
        const pct = Math.round((count / data.length) * 100);
        const barPct = pct;
        return `
            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 4px;">
                    <span>${safeText(labelMap[key])}</span>
                    <span style="color: var(--text-secondary);">${count} (${pct}%)</span>
                </div>
                <div style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${barPct}%; background: ${colors.primary}; border-radius: 4px;"></div>
                </div>
            </div>`;
    }).join('');

    content.innerHTML = safeHTML(`
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 12px;">
            ${episodesWith} of ${data.length} episodes in this range had ${noun} logged.
        </p>
        ${rows}
    `);
}

function renderSymptomAnalytics(data) {
    renderOptionAnalytics('symptom-analytics-card', 'symptom-analytics-content', data, 'symptoms', SYMPTOM_KEYS, SYMPTOM_LABELS, 'symptoms');
}

function renderTriggerAnalytics(data) {
    renderOptionAnalytics('trigger-analytics-card', 'trigger-analytics-content', data, 'triggers', TRIGGER_KEYS, TRIGGER_LABELS, 'triggers');
}

// Cross-tabulate each logged trigger against the MEASURED pressure
// activity stored on that episode (migraine.weather), so self-reported
// triggers — especially "Weather change" — can be validated against the
// barometer instead of taken at face value. Each episode is classed as
// a "pressure-change" episode when its recorded 6h or 24h change crossed
// the user's threshold; per-trigger rates are compared to the baseline
// rate across all weather-tracked episodes.
function calculateTriggerWeatherCorrelation(data) {
    const t6 = weatherData.userThreshold6h || 5;
    const t24 = weatherData.userThreshold24h || 5;

    const hasWeather = (w) => w && (w.maxChange3h != null || w.change24h != null);
    const hasPressureActivity = (w) =>
        (w.maxChange3h != null && w.maxChange3h >= t6) ||
        (w.change24h != null && Math.abs(w.change24h) >= t24);

    const withWeather = data.filter(m => hasWeather(m.weather));
    if (withWeather.length < 3) return null;

    const baselineCount = withWeather.filter(m => hasPressureActivity(m.weather)).length;
    const baselineRate = baselineCount / withWeather.length;

    const perTrigger = [];
    TRIGGER_OPTIONS.forEach(({ key }) => {
        const eps = withWeather.filter(m => Array.isArray(m.triggers) && m.triggers.includes(key));
        if (eps.length < 2) return; // Too few to be meaningful
        const coincided = eps.filter(m => hasPressureActivity(m.weather)).length;
        perTrigger.push({ key, total: eps.length, coincided, rate: coincided / eps.length });
    });
    perTrigger.sort((a, b) => b.rate - a.rate || b.total - a.total);

    if (perTrigger.length === 0) return null;

    return {
        withWeatherCount: withWeather.length,
        baselineCount,
        baselineRate,
        perTrigger,
        weatherTrigger: perTrigger.find(p => p.key === 'weather') || null,
        t6, t24
    };
}

function renderTriggerWeatherCorrelation(data) {
    const card = document.getElementById('trigger-weather-card');
    const content = document.getElementById('trigger-weather-content');
    if (!card || !content) return;

    if (!weatherData.enabled) { card.style.display = 'none'; return; }

    const corr = calculateTriggerWeatherCorrelation(data);
    if (!corr) { card.style.display = 'none'; return; }

    card.style.display = 'block';
    const colors = getChartColors();
    const basePct = Math.round(corr.baselineRate * 100);

    // Honest validation of the self-reported "Weather change" trigger.
    let verdict = '';
    const wt = corr.weatherTrigger;
    if (wt && wt.total >= 3) {
        const wtPct = Math.round(wt.rate * 100);
        let msg, color;
        if (wt.rate >= Math.max(0.5, corr.baselineRate * 1.3)) {
            color = 'var(--accent-red)';
            msg = `Your "Weather change" logs line up with the barometer: ${wtPct}% fell on measured pressure-change days (vs ${basePct}% baseline). Pressure looks like a real trigger for you.`;
        } else if (wt.rate <= corr.baselineRate * 0.8) {
            color = 'var(--accent-green)';
            msg = `Your "Weather change" logs don't line up with measured swings (${wtPct}% vs ${basePct}% baseline). The barometer may not be the driver, or changes are subtler than your threshold.`;
        } else {
            color = 'var(--pain-moderate)';
            msg = `Your "Weather change" logs roughly match your baseline (${wtPct}% vs ${basePct}%) — no strong signal either way yet.`;
        }
        verdict = `<div style="padding: 12px 14px; border-radius: 10px; background: var(--bg-tertiary); border-left: 3px solid ${color}; margin-bottom: 14px;">
            <strong>Weather-change check:</strong> ${msg}</div>`;
    }

    const rows = corr.perTrigger.map(p => {
        const pct = Math.round(p.rate * 100);
        const barPct = pct;
        const above = p.rate > corr.baselineRate + 0.0001;
        const barColor = above ? colors.red : colors.primary;
        const flag = above ? ` <span style="color: ${colors.red};" title="Above your baseline">▲</span>` : '';
        return `
            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 4px;">
                    <span>${safeText(TRIGGER_LABELS[p.key])}${flag}</span>
                    <span style="color: var(--text-secondary);">${p.coincided}/${p.total} (${pct}%)</span>
                </div>
                <div style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${barPct}%; background: ${barColor}; border-radius: 4px;"></div>
                </div>
            </div>`;
    }).join('');

    content.innerHTML = safeHTML(`
        ${verdict}
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 12px;">
            Share of each trigger's episodes that fell on a <strong>measured pressure-change day</strong>
            (&ge;${formatThreshold(corr.t6)} in 6h or &ge;${formatThreshold(corr.t24)} in 24h).
            Your baseline across ${corr.withWeatherCount} weather-tracked episodes is <strong>${basePct}%</strong>;
            &#9650; marks triggers above it.
        </p>
        ${rows}
    `);
}

function updateAnalyticsMetrics(data, startDate, endDate) {
    // Count unique migraine days (including multi-day attacks)
    const migraineDays = new Set();
    data.forEach(m => {
        const days = getMigraineDays(m);
        days.forEach(day => migraineDays.add(day));
    });

    const totalDays = migraineDays.size;
    const daysInRange = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const monthsInRange = daysInRange / 30;
    const avgPerMonth = (totalDays / monthsInRange).toFixed(1);

    const avgPain = data.length > 0
        ? (data.reduce((sum, m) => sum + m.painLevel, 0) / data.length).toFixed(1)
        : 0;

    const avgDuration = data.length > 0
        ? data.reduce((sum, m) => sum + (m.duration || 0), 0) / data.length
        : 0;

    document.getElementById('analytics-total-days').textContent = totalDays;
    document.getElementById('analytics-avg-month').textContent = avgPerMonth;
    document.getElementById('analytics-avg-pain').textContent = `${avgPain}/10`;
    document.getElementById('analytics-avg-duration').textContent = formatDuration(Math.floor(avgDuration));
}

function renderFrequencyChart(data, startDate, endDate) {
    const canvas = document.getElementById('frequency-chart');
    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (analyticsCharts.frequency) {
        analyticsCharts.frequency.destroy();
    }

    // Group data by month (including multi-day attacks)
    const monthlyData = {};
    data.forEach(m => {
        const days = getMigraineDays(m);
        days.forEach(day => {
            const date = new Date(day + 'T00:00:00');
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = new Set();
            }
            monthlyData[monthKey].add(day);
        });
    });

    // Generate labels for all months in range
    const labels = [];
    const values = [];
    const current = new Date(startDate);
    current.setDate(1);

    while (current <= endDate) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        const label = current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        labels.push(label);
        values.push(monthlyData[monthKey] ? monthlyData[monthKey].size : 0);
        current.setMonth(current.getMonth() + 1);
    }

    const colors = getChartColors();

    analyticsCharts.frequency = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Migraine Days',
                data: values,
                borderColor: colors.primary,
                backgroundColor: colors.primaryBg,
                borderWidth: 3,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: colors.textSecondary
                    },
                    grid: {
                        color: colors.grid
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 5,
                        color: colors.textSecondary
                    },
                    grid: {
                        color: colors.grid
                    },
                    title: {
                        display: true,
                        text: 'Days per Month',
                        color: colors.text
                    }
                }
            }
        }
    });
}

function renderPainChart(data) {
    const canvas = document.getElementById('pain-chart');
    const ctx = canvas.getContext('2d');

    if (analyticsCharts.pain) {
        analyticsCharts.pain.destroy();
    }

    const mild = data.filter(m => m.painLevel <= 3).length;
    const moderate = data.filter(m => m.painLevel >= 4 && m.painLevel <= 6).length;
    const severe = data.filter(m => m.painLevel >= 7).length;

    const colors = getChartColors();

    analyticsCharts.pain = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Mild (0-3)', 'Moderate (4-6)', 'Severe (7-10)'],
            datasets: [{
                data: [mild, moderate, severe],
                backgroundColor: [
                    colors.green,
                    colors.yellow,
                    colors.red
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: colors.text,
                        padding: 12,
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

function renderTimeChart(data) {
    const canvas = document.getElementById('time-chart');
    const ctx = canvas.getContext('2d');

    if (analyticsCharts.time) {
        analyticsCharts.time.destroy();
    }

    // Group by time of day (4-hour blocks)
    const timeBlocks = {
        'Night (12am-4am)': 0,
        'Early Morning (4am-8am)': 0,
        'Morning (8am-12pm)': 0,
        'Afternoon (12pm-4pm)': 0,
        'Evening (4pm-8pm)': 0,
        'Night (8pm-12am)': 0
    };

    data.forEach(m => {
        const hour = new Date(m.startTime).getHours();
        if (hour >= 0 && hour < 4) timeBlocks['Night (12am-4am)']++;
        else if (hour >= 4 && hour < 8) timeBlocks['Early Morning (4am-8am)']++;
        else if (hour >= 8 && hour < 12) timeBlocks['Morning (8am-12pm)']++;
        else if (hour >= 12 && hour < 16) timeBlocks['Afternoon (12pm-4pm)']++;
        else if (hour >= 16 && hour < 20) timeBlocks['Evening (4pm-8pm)']++;
        else timeBlocks['Night (8pm-12am)']++;
    });

    const colors = getChartColors();

    analyticsCharts.time = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(timeBlocks),
            datasets: [{
                label: 'Number of Migraines',
                data: Object.values(timeBlocks),
                backgroundColor: colors.primaryFill,
                borderColor: colors.primary,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: colors.textSecondary
                    },
                    grid: {
                        color: colors.grid
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: colors.textSecondary
                    },
                    grid: {
                        color: colors.grid
                    }
                }
            }
        }
    });
}

function renderDayOfWeekChart(data) {
    const canvas = document.getElementById('dow-chart');
    const ctx = canvas.getContext('2d');

    if (analyticsCharts.dow) {
        analyticsCharts.dow.destroy();
    }

    const dowCounts = {
        'Sunday': 0,
        'Monday': 0,
        'Tuesday': 0,
        'Wednesday': 0,
        'Thursday': 0,
        'Friday': 0,
        'Saturday': 0
    };

    data.forEach(m => {
        const dayName = new Date(m.startTime).toLocaleDateString('en-US', { weekday: 'long' });
        dowCounts[dayName]++;
    });

    const colors = getChartColors();

    analyticsCharts.dow = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(dowCounts),
            datasets: [{
                label: 'Number of Migraines',
                data: Object.values(dowCounts),
                backgroundColor: colors.blue,
                borderColor: colors.blue,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: colors.textSecondary
                    },
                    grid: {
                        color: colors.grid
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: colors.textSecondary
                    },
                    grid: {
                        color: colors.grid
                    }
                }
            }
        }
    });
}

function renderWeatherCorrelation(data) {
    const correlationCard = document.getElementById('weather-correlation-card');

    if (!weatherData.enabled || weatherData.history.length < 7) {
        if (correlationCard) correlationCard.style.display = 'none';
        return;
    }

    if (correlationCard) correlationCard.style.display = 'block';

    const correlation = calculateWeatherCorrelation();

    if (!correlation) {
        if (correlationCard) correlationCard.style.display = 'none';
        return;
    }

    // Percentage display
    const pct = correlation.percentage != null ? correlation.percentage : correlation.primaryCorrelation || 0;
    const strengthEl = document.getElementById('correlation-strength');
    if (strengthEl) strengthEl.textContent = `${Math.round(pct)}%`;

    // Color and label — including honest "not your trigger" messaging.
    // Strength reflects the rate vs the user's BASELINE migraine
    // rate, not the raw conditional probability.
    const rrNote = correlation.relativeRisk != null && correlation.baselinePercentage > 0
        ? ` Migraines followed ${Math.round(pct)}% of pressure-change days vs ${correlation.baselinePercentage}% of all tracked days (${correlation.relativeRisk.toFixed(1)}x baseline).`
        : '';
    let strengthText, strengthColor, messageSuffix;
    if (correlation.level === 'insufficient') {
        strengthText = 'Not enough data yet';
        strengthColor = 'var(--text-secondary)';
        messageSuffix = correlation.message || 'More pressure-change days are needed before a reliable pattern can be identified.';
    } else if (correlation.level === 'strong') {
        strengthText = 'Strong correlation';
        strengthColor = 'var(--accent-red)';
        messageSuffix = `Pressure changes appear to be a real trigger for you.${rrNote}`;
    } else if (correlation.level === 'moderate') {
        strengthText = 'Moderate correlation';
        strengthColor = 'var(--pain-moderate)';
        messageSuffix = `Pressure may be contributing to some of your attacks.${rrNote}`;
    } else {
        // Honest disconfirmation — this is valuable information, not a failure
        strengthText = 'Low correlation';
        strengthColor = 'var(--accent-green)';
        messageSuffix = `Pressure-change days don't show meaningfully more migraines than your baseline. Other triggers may be more significant.${rrNote}`;
    }

    const descEl = document.getElementById('correlation-description');
    if (descEl) {
        descEl.textContent = strengthText;
        descEl.style.color = strengthColor;
    }
    if (strengthEl) strengthEl.style.color = strengthColor;

    // Stats
    const changesEl = document.getElementById('correlation-changes');
    if (changesEl) changesEl.textContent = `${correlation.significantChangeDays || 0} days`;
    const migrainesEl = document.getElementById('correlation-migraines');
    if (migrainesEl) migrainesEl.textContent = `${correlation.migrainesOnChangeDays || 0} attacks`;
    const percentEl = document.getElementById('correlation-percent');
    if (percentEl) percentEl.textContent = `${Math.round(pct)}%`;

    // Update the info-box text with honest messaging
    const infoBox = document.getElementById('correlation-info-box');
    if (infoBox) {
        const sampleNote = correlation.sampleSize < 10
            ? ` (${correlation.sampleSize || 'limited'} attacks analyzed — more data will improve accuracy)`
            : '';
        infoBox.innerHTML = `<strong>What this means for you:</strong> ${messageSuffix}${sampleNote} ` +
            `Thresholds used: &gt;${formatThreshold(weatherData.userThreshold24h || 5)} in 24h (slow change), ` +
            `&gt;${formatThreshold(weatherData.userThreshold6h || 5)} in 6h (rapid change).`;
    }
}

function renderPressureChart(data, startDate, endDate) {
    const chartCard = document.getElementById('pressure-chart-card');

    if (!weatherData.enabled || weatherData.history.length < 7) {
        if (chartCard) chartCard.style.display = 'none';
        return;
    }

    if (chartCard) chartCard.style.display = 'block';

    const canvas = document.getElementById('pressure-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (analyticsCharts.pressure) {
        analyticsCharts.pressure.destroy();
        analyticsCharts.pressure = null;
    }

    // Use up to 60 days of history (sorted oldest-first)
    const sortedHistory = [...weatherData.history]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-60);

    // Build migraine day set
    const migraineDays = new Set();
    if (data && Array.isArray(data)) {
        data.forEach(m => {
            if (typeof getMigraineDays === 'function') {
                getMigraineDays(m).forEach(d => migraineDays.add(d));
            } else {
                migraineDays.add(m.startTime.split('T')[0]);
            }
        });
    }

    const labels = [];
    const pressureData = [];
    const migraineMarkers = [];  // Pressure value on migraine days (shown as scatter points)
    const migraineBarData = []; // Full-height bar on migraine day

    // Fixed Y-axis range — critical so changes are comparable across weeks
    // 980-1040 hPa (28.94-30.71 inHg) covers virtually all sea-level weather events
    const useInHg = weatherData.displayUnit === 'inHg';
    const Y_MIN = useInHg ? hPaToInHg(980) : 980;
    const Y_MAX = useInHg ? hPaToInHg(1040) : 1040;
    const pressureUnit = useInHg ? 'inHg' : 'hPa';
    // Risk threshold labels (Okuma 2015, confirmed Farah et al. 2025 systematic review)
    const RISK_LOW = useInHg ? hPaToInHg(1007) : 1007;   // 29.74 inHg
    const RISK_HIGH = useInHg ? hPaToInHg(1005) : 1005;  // 29.68 inHg

    sortedHistory.forEach((entry) => {
        const date = new Date(entry.date);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

        const pressureHPa = entry.dailyAvg || entry.pressure || 1013.25;
        const pressure = useInHg ? hPaToInHg(pressureHPa) : pressureHPa;
        pressureData.push(pressure);

        const dateKey = entry.date.split('T')[0];
        const hasMigraine = migraineDays.has(dateKey);
        // Migraine marker at the pressure value; bar reaches from bottom of chart
        migraineMarkers.push(hasMigraine ? pressure : null);
        migraineBarData.push(hasMigraine ? Y_MAX : null);
    });

    const colors = getChartColors();
    const isDark = isDarkTheme();
    const threshold = weatherData.userThreshold24h || 5;

    analyticsCharts.pressure = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    // Migraine day shading (bar behind pressure line)
                    label: 'Migraine day',
                    type: 'bar',
                    data: migraineBarData,
                    backgroundColor: isDark ? 'rgba(201, 104, 104, 0.18)' : 'rgba(201, 104, 104, 0.12)',
                    borderColor: 'transparent',
                    borderWidth: 0,
                    yAxisID: 'y',
                    order: 3,
                    barPercentage: 1.0,
                    categoryPercentage: 1.0
                },
                {
                    // Main pressure line
                    label: `Pressure (${pressureUnit})`,
                    data: pressureData,
                    borderColor: colors.blue,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    pointBackgroundColor: colors.blue,
                    tension: 0.3,
                    yAxisID: 'y',
                    order: 1
                },
                {
                    // Migraine day dot markers on the pressure line
                    label: 'Attack occurred',
                    data: migraineMarkers,
                    borderColor: colors.red,
                    backgroundColor: colors.red,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointStyle: 'circle',
                    showLine: false,
                    yAxisID: 'y',
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: colors.textSecondary,
                        boxWidth: 16,
                        padding: 12,
                        filter: (item) => item.text !== 'Migraine day' // Hide bar from legend
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) return null; // hide bar from tooltip
                            if (context.datasetIndex === 1 && context.parsed.y !== null) {
                                const decimals = useInHg ? 2 : 1;
                                return `Pressure: ${context.parsed.y.toFixed(decimals)} ${pressureUnit}`;
                            }
                            if (context.datasetIndex === 2 && context.parsed.y !== null) {
                                return 'Attack occurred';
                            }
                            return null;
                        }
                    }
                },
                // Shade the high-risk absolute pressure zone (1003-1007 hPa)
                annotation: undefined
            },
            scales: {
                x: {
                    ticks: { color: colors.textSecondary, maxRotation: 45, minRotation: 45, maxTicksLimit: 15 },
                    grid: { color: colors.grid }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    // Fixed range so a 5 hPa drop always looks the same across weeks
                    min: Y_MIN,
                    max: Y_MAX,
                    title: { display: true, text: `Pressure (${pressureUnit})`, color: colors.textSecondary },
                    ticks: {
                        color: colors.textSecondary,
                        callback: (v) => {
                            // Mark clinical thresholds (Okuma 2015, confirmed Farah et al. 2025)
                            const riskLowLabel = useInHg ? '29.74 (risk)' : '1007 (risk)';
                            const riskHighLabel = useInHg ? '29.68 (high risk)' : '1005 (high risk)';
                            const tolerance = useInHg ? 0.005 : 0.5;
                            if (Math.abs(v - RISK_LOW) < tolerance) return riskLowLabel;
                            if (Math.abs(v - RISK_HIGH) < tolerance) return riskHighLabel;
                            return useInHg ? v.toFixed(2) : v;
                        }
                    },
                    grid: { color: colors.grid }
                }
            }
        }
    });
}

// ============================================
// MEDICATION ANALYTICS
// ============================================

function renderMedicationAnalytics(data) {
    // Calculate medication statistics
    const stats = calculateMedicationStats(data);

    if (stats.totalMedications === 0) {
        // Hide medication analytics if no medication data
        document.getElementById('medication-effectiveness-card').style.display = 'none';
        document.getElementById('medication-usage-card').style.display = 'none';
        return;
    }

    // Show and render medication analytics
    document.getElementById('medication-effectiveness-card').style.display = 'block';
    document.getElementById('medication-usage-card').style.display = 'block';

    renderMedicationEffectiveness(stats);
    renderMedicationUsage(stats);
}

function calculateMedicationStats(data) {
    const medicationStats = {};
    let totalMedications = 0;

    // Process all migraines with medications
    data.forEach(migraine => {
        if (!migraine.medications || migraine.medications.length === 0) return;

        migraine.medications.forEach(med => {
            const medName = med.name;
            totalMedications++;

            if (!medicationStats[medName]) {
                medicationStats[medName] = {
                    name: medName,
                    type: med.type || 'unknown',
                    category: med.category || 'unknown',
                    uses: 0,
                    effectivenessRatings: [],
                    timeToReliefValues: [],
                    sideEffects: {},
                    daysUsed: new Set() // Track unique days for MOH
                };
            }

            const stat = medicationStats[medName];
            stat.uses++;

            // Track day used for MOH calculation
            const dayUsed = migraine.startTime.split('T')[0];
            stat.daysUsed.add(dayUsed);

            // Add effectiveness rating if exists
            if (med.effectiveness) {
                stat.effectivenessRatings.push(med.effectiveness);
            }

            // Add time to relief if exists
            if (med.timeToRelief) {
                stat.timeToReliefValues.push(med.timeToRelief);
            }

            // Track side effects
            if (med.sideEffects && med.sideEffects.length > 0) {
                med.sideEffects.forEach(effect => {
                    stat.sideEffects[effect] = (stat.sideEffects[effect] || 0) + 1;
                });
            }
        });
    });

    // Calculate averages
    Object.values(medicationStats).forEach(stat => {
        stat.avgEffectiveness = stat.effectivenessRatings.length > 0
            ? (stat.effectivenessRatings.reduce((sum, val) => sum + val, 0) / stat.effectivenessRatings.length)
            : null;

        stat.avgTimeToRelief = stat.timeToReliefValues.length > 0
            ? (stat.timeToReliefValues.reduce((sum, val) => sum + val, 0) / stat.timeToReliefValues.length)
            : null;
    });

    // Calculate MOH risk (medication overuse headache) - always
    // computed from the full dataset, not the date-range filter
    const mohStats = calculateMOHRisk();

    return {
        totalMedications,
        medications: Object.values(medicationStats),
        mohRisk: mohStats
    };
}

function calculateMOHRisk() {
    // Clinical MOH (ICHD-3) thresholds are medication-class specific:
    // >=10 days/month for triptans, ergots, opioids, and combination
    // analgesics; >=15 days/month for simple analgesics/NSAIDs.
    // Uses the FULL dataset (not the analytics date-range filter) so
    // the trailing calendar months are never undercounted.
    const HIGH_RISK_THRESHOLD = 10;  // triptan/combination/opioid/ergot
    const SIMPLE_ANALGESIC_THRESHOLD = 15;  // NSAIDs, simple analgesics
    const highRiskCategories = ['triptan', 'combination', 'opioid', 'ergot', 'cgrp'];

    const now = new Date();
    const months = [];

    for (let i = 0; i < 3; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        months.push({
            key: monthKey,
            name: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            daysUsed: new Set(),        // any abortive
            highRiskDaysUsed: new Set() // class-10 abortives only
        });
    }

    // Count days with abortive medication use across all episodes
    getActiveMigraines().forEach(migraine => {
        if (!migraine.medications || migraine.medications.length === 0) return;

        const abortives = migraine.medications.filter(med => med.type === 'abortive');
        if (abortives.length === 0) return;

        const migraineDate = new Date(migraine.startTime);
        const monthKey = `${migraineDate.getFullYear()}-${String(migraineDate.getMonth() + 1).padStart(2, '0')}`;
        const dayKey = migraine.startTime.split('T')[0];

        const month = months.find(m => m.key === monthKey);
        if (month) {
            month.daysUsed.add(dayKey);
            if (abortives.some(med => highRiskCategories.includes(med.category))) {
                month.highRiskDaysUsed.add(dayKey);
            }
        }
    });

    // A month meets the MOH threshold when class-10 medications were
    // used on >=10 days, or any abortive on >=15 days
    months.forEach(month => {
        month.count = month.daysUsed.size;
        month.highRiskCount = month.highRiskDaysUsed.size;
        month.atThreshold =
            month.highRiskCount >= HIGH_RISK_THRESHOLD ||
            month.count >= SIMPLE_ANALGESIC_THRESHOLD;
    });

    const atRisk = months.filter(m => m.atThreshold).length >= 2;

    return {
        atRisk,
        currentMonth: months[0],
        lastThreeMonths: months,
        threshold: HIGH_RISK_THRESHOLD,
        simpleAnalgesicThreshold: SIMPLE_ANALGESIC_THRESHOLD
    };
}

function renderMedicationEffectiveness(stats) {
    const content = document.getElementById('medication-effectiveness-content');

    // Sort medications by average effectiveness (highest first)
    const sortedMeds = stats.medications
        .filter(med => med.avgEffectiveness !== null)
        .sort((a, b) => b.avgEffectiveness - a.avgEffectiveness);

    if (sortedMeds.length === 0) {
        content.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No effectiveness ratings yet. Rate medications after ending an episode to see analytics here.</p>';
        return;
    }

    const colors = getChartColors();

    content.innerHTML = safeHTML(sortedMeds.map(med => {
        const effectiveness = med.avgEffectiveness.toFixed(1);
        const percentage = (effectiveness / 5) * 100;
        const stars = '⭐'.repeat(Math.round(effectiveness));
        const avgRelief = med.avgTimeToRelief
            ? `${Math.round(med.avgTimeToRelief)} min`
            : 'N/A';

        return `
            <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: 8px; border-left: 3px solid ${med.type === 'abortive' ? 'var(--accent-blue)' : 'var(--accent-green)'};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div>
                        <div style="font-weight: 600; font-size: 1.1rem;">${safeText(med.name)}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
                            ${med.type === 'abortive' ? 'Abortive' : 'Preventive'} • ${med.uses} uses
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.3rem;">${stars}</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">${effectiveness}/5</div>
                    </div>
                </div>

                <div style="height: 8px; background: var(--bg-primary); border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
                    <div style="height: 100%; width: ${percentage}%; background: var(--accent-gold); transition: width 0.3s;"></div>
                </div>

                <div style="display: flex; gap: 24px; font-size: 0.9rem; color: var(--text-secondary);">
                    <div>
                        <strong>Avg time to relief:</strong> ${avgRelief}
                    </div>
                    ${Object.keys(med.sideEffects).length > 0 ? `
                        <div>
                            <strong>Common side effects:</strong> ${Object.keys(med.sideEffects).slice(0, 2).join(', ')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('')); // Fixed: Added missing closing paren for safeHTML()
}

function renderMedicationUsage(stats) {
    const content = document.getElementById('medication-usage-content');
    const mohWarning = document.getElementById('moh-warning');

    // Check MOH risk and show warning if necessary
    if (stats.mohRisk.atRisk || stats.mohRisk.currentMonth.atThreshold) {
        mohWarning.style.display = 'block';
        document.getElementById('moh-days-this-month').textContent = stats.mohRisk.currentMonth.count;

        const monthsHTML = stats.mohRisk.lastThreeMonths.map(month => {
            const isWarning = month.atThreshold;
            return `<div style="color: ${isWarning ? 'var(--pain-severe)' : 'var(--text-secondary)'}; padding: 4px 0;">
                ${month.name}: <strong>${month.count} days</strong>${month.highRiskCount > 0 && month.highRiskCount !== month.count ? ` (${month.highRiskCount} triptan/combination)` : ''} ${isWarning ? '[WARNING]' : ''}
            </div>`;
        }).join('');

        document.getElementById('moh-three-months').innerHTML = monthsHTML;
    } else {
        mohWarning.style.display = 'none';
    }

    // Show medication usage list
    const sortedByUse = [...stats.medications].sort((a, b) => b.uses - a.uses);

    // Without this the heading rendered with nothing beneath it.
    if (sortedByUse.length === 0) {
        content.innerHTML = safeHTML(
            '<p style="color: var(--text-secondary); margin-top: var(--space-4);">' +
            'No medications recorded yet. Add what you take when logging an episode and ' +
            'usage patterns will appear here.</p>');
        return;
    }

    content.innerHTML = `
        <div style="margin-top: 16px;">
            <h3 style="margin-bottom: 16px;">Medication Usage Frequency</h3>
            ${sortedByUse.map(med => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid ${med.type === 'abortive' ? 'var(--accent-blue)' : 'var(--accent-green)'};">
                    <div>
                        <div style="font-weight: 600;">${safeText(med.name)}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
                            ${med.type === 'abortive' ? 'Abortive' : 'Preventive'}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; font-size: 1.1rem;">${med.uses} uses</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">${med.daysUsed.size} days</div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div style="margin-top: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border-color);">
            <strong>About Medication Overuse Headache (MOH):</strong>
            <p style="margin-top: 8px; color: var(--text-secondary); font-size: 0.9rem;">
                Using abortive medication >10 days/month for >3 months can cause medication overuse headaches,
                making migraines worse. If you're seeing this warning, please consult your doctor about preventive options.
            </p>
        </div>
    `;
}
