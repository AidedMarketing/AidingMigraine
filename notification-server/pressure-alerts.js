/**
 * Pressure Alerts
 *
 * Pure computation + Open-Meteo fetch for server-side barometric
 * pressure alerts. The app already computes predictive pressure alerts
 * on-device for its Today risk card; this module lets the notification
 * server deliver the same kind of heads-up as a push notification while
 * the app is closed.
 *
 * Semantics mirror the app's rapid-change check (generatePredictiveAlerts):
 * within each 7-point (6-hour) window of hourly forecast pressures, the
 * rapid change is max - min, and the direction comes from the signed
 * change between the window's first and last points.
 */

const WINDOW_POINTS = 7; // hourly points spanning 6 hours
const LOOKAHEAD_HOURS = 24;

/**
 * Find the strongest 6-hour pressure-change window in the next
 * LOOKAHEAD_HOURS hours of an hourly forecast.
 *
 * @param {Array<{time: string, pressure: number}>} hourly - forecast points
 *   with ISO timestamps, in chronological order
 * @param {number} thresholdHpa - minimum rapid change that counts as an alert
 * @param {Date} [now] - reference time (defaults to current time)
 * @returns {null|{startTime: string, hoursUntil: number, rapidChange: number,
 *   totalChange: number, direction: 'drop'|'rise', eventKey: string}}
 */
function findStrongestPressureWindow(hourly, thresholdHpa, now = new Date()) {
    if (!Array.isArray(hourly) || hourly.length < WINDOW_POINTS) return null;
    if (!Number.isFinite(thresholdHpa) || thresholdHpa <= 0) return null;

    const horizon = now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000;
    let best = null;

    for (let i = 0; i + WINDOW_POINTS - 1 < hourly.length; i++) {
        const window = hourly.slice(i, i + WINDOW_POINTS);
        const start = new Date(window[0].time);
        if (isNaN(start) || start <= now || start > horizon) continue;

        const pressures = window.map(p => p.pressure);
        if (pressures.some(p => !Number.isFinite(p))) continue;

        const rapidChange = Math.max(...pressures) - Math.min(...pressures);
        if (rapidChange < thresholdHpa) continue;

        if (!best || rapidChange > best.rapidChange) {
            const totalChange = pressures[WINDOW_POINTS - 1] - pressures[0];
            best = {
                startTime: window[0].time,
                hoursUntil: Math.max(0, Math.round((start - now) / (60 * 60 * 1000))),
                rapidChange: Math.round(rapidChange * 10) / 10,
                totalChange: Math.round(totalChange * 10) / 10,
                direction: totalChange < 0 ? 'drop' : 'rise',
                eventKey: window[0].time
            };
        }
    }

    return best;
}

/**
 * Local calendar date (YYYY-MM-DD) for a date in an IANA timezone.
 * Falls back to the UTC date when the timezone is missing/invalid.
 */
function localDateKey(date, timeZone) {
    try {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: timeZone || 'UTC',
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(date);
        const get = type => parts.find(p => p.type === type).value;
        return `${get('year')}-${get('month')}-${get('day')}`;
    } catch {
        return date.toISOString().split('T')[0];
    }
}

/**
 * Dedupe rule: at most one pressure alert per user per local day, and
 * never re-fire for the same forecast event (window start) even across
 * days (e.g. when a window straddles local midnight).
 *
 * @param {Object|undefined} state - subscription.pressureAlertState
 * @param {string} eventKey - candidate window's startTime
 * @param {string} todayLocal - user's local date key for today
 */
function shouldSendPressureAlert(state, eventKey, todayLocal) {
    if (!state) return true;
    if (state.lastEventKey === eventKey) return false;
    if (state.lastSentLocalDate === todayLocal) return false;
    return true;
}

/**
 * Fetch the hourly surface-pressure forecast for a location from
 * Open-Meteo (free, no key). Returns [{time: ISO string, pressure}].
 * Uses unixtime so timestamps are unambiguous UTC regardless of the
 * location's timezone.
 */
async function fetchPressureForecast(latitude, longitude, fetchImpl = fetch) {
    const url = 'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${encodeURIComponent(latitude)}` +
        `&longitude=${encodeURIComponent(longitude)}` +
        '&hourly=surface_pressure' +
        '&timeformat=unixtime' +
        '&forecast_days=3';

    const response = await fetchImpl(url);
    if (!response || !response.ok) {
        throw new Error(`Open-Meteo request failed (${response ? response.status : 'no response'})`);
    }
    const data = await response.json();
    if (!data.hourly || !Array.isArray(data.hourly.time) || !Array.isArray(data.hourly.surface_pressure)) {
        throw new Error('Invalid weather data received from Open-Meteo');
    }

    return data.hourly.time.map((unixSeconds, i) => ({
        time: new Date(unixSeconds * 1000).toISOString(),
        pressure: Math.round(data.hourly.surface_pressure[i] * 10) / 10
    }));
}

module.exports = {
    findStrongestPressureWindow,
    localDateKey,
    shouldSendPressureAlert,
    fetchPressureForecast
};
