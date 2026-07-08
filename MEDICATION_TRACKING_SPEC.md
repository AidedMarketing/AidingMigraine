# Enhanced Medication Tracking Feature Specification

> **v4.1.0 update — MOH thresholds are class-specific.** Any "more than 10 days/month for all medications" wording in this spec is superseded. Medication-overuse-headache risk now follows ICHD-3 classes: **≥10 medication-days/month** for triptans, ergots, opioids, and combination analgesics; **≥15 medication-days/month** for simple analgesics/NSAIDs (e.g. ibuprofen, acetaminophen). The implementation classifies by each medication's `category`.

## Overview
Comprehensive medication tracking system to help users and doctors understand medication effectiveness, usage patterns, and identify potential medication overuse headaches (MOH).

## Philosophy Alignment
- **Clinically Relevant**: Track dosage, timing, effectiveness - data doctors need
- **User Control**: Full medication history, edit/delete capabilities
- **Privacy First**: All data stays local, no sharing with pharmacies/insurance
- **Migraine-Friendly**: Simple UI, quick logging during attacks

## Clinical Background

### Medication Types
1. **Abortive (Acute)**: Taken during attacks to stop/reduce pain
   - Triptans (Sumatriptan, Rizatriptan, Eletriptan)
   - NSAIDs (Ibuprofen, Naproxen, Aspirin)
   - Combination drugs (Excedrin Migraine)
   - Ergotamines
   - CGRP antagonists (Ubrogepant, Rimegepant)

2. **Preventive**: Taken daily to reduce attack frequency
   - Beta-blockers (Propranolol, Metoprolol)
   - Antidepressants (Amitriptyline, Venlafaxine)
   - Anticonvulsants (Topiramate, Valproate)
   - CGRP monoclonal antibodies (Aimovig, Ajovy, Emgality)
   - Botox injections

### Medication Overuse Headache (MOH)
- Using abortive medication **>10 days/month** for **>3 months** → MOH risk
- Using triptans/combination drugs **>10 days/month** → high risk
- Using simple analgesics **>15 days/month** → risk
- **Critical to track and warn users**

---

## Data Structure

### Medication Library Entry
```javascript
{
  id: unique_id,
  name: "Sumatriptan",
  genericName: "Sumatriptan",
  brandNames: ["Imitrex", "Tosymra"],
  type: "abortive", // or "preventive"
  category: "triptan", // triptan, nsaid, combination, etc.
  defaultDosage: "100mg",
  commonDosages: ["25mg", "50mg", "100mg"],
  formulations: ["tablet", "nasal spray", "injection"],
  addedBy: "user", // or "system" for pre-populated
  addedAt: "2024-01-15T10:00:00Z"
}
```

### Medication Usage Entry (tied to migraine episode)
```javascript
{
  migrainId: episode_id,
  medications: [
    {
      medicationId: med_library_id, // or null if free-text
      name: "Sumatriptan",
      dosage: "100mg",
      formulation: "tablet",
      timeTaken: "2024-01-15T14:35:00Z",
      effectiveness: 3, // 1-5 stars
      timeToRelief: 45, // minutes (optional)
      sideEffects: ["nausea", "dizziness"], // optional
      notes: "Took on empty stomach" // optional
    }
  ]
}
```

### Preventive Medication Log
```javascript
{
  id: unique_id,
  medicationId: med_library_id,
  name: "Propranolol",
  dosage: "80mg",
  frequency: "twice daily", // daily, twice daily, etc.
  startDate: "2024-01-01",
  endDate: null, // null if currently active
  effectiveness: 4, // Overall rating after time
  notes: "Doctor prescribed for prevention",
  adherence: [] // Track when taken (optional future feature)
}
```

---

## Features to Implement

### 1. Medication Library
- **Pre-populated** with 30+ common migraine medications
- **User can add** custom medications
- **Search/autocomplete** when selecting medication
- **Categories**: Triptans, NSAIDs, Combinations, Preventives, etc.
- **Edit/delete** user-added medications

### 2. Enhanced Attack Logging
**Add to log screen:**
- "💊 Medication Taken" section (replaces simple text field)
- Multi-medication support (took Sumatriptan + Ibuprofen)
- For each medication:
  - Name (autocomplete from library)
  - Dosage (dropdown + custom)
  - Formulation (tablet/nasal/injection)
  - Time taken (defaults to attack start time)
  - Effectiveness rating (1-5 stars) - can add later
  - Side effects (optional checklist)

### 3. Effectiveness Tracking
**After attack ends or during follow-up:**
- "How effective was [Medication]?" (1-5 stars)
  - ⭐ No relief
  - ⭐⭐ Slight relief
  - ⭐⭐⭐ Moderate relief
  - ⭐⭐⭐⭐ Good relief
  - ⭐⭐⭐⭐⭐ Complete relief
- "Time to relief?" (15min, 30min, 1h, 2h, 4h+)
- "Any side effects?" (checklist)

### 4. Medication Analytics
**New analytics section:**
- **Effectiveness by Medication** (bar chart)
  - Average effectiveness rating per medication
  - Number of uses
- **Medication Usage Frequency** (calendar heatmap)
  - Days/month each medication used
  - MOH warning if >10 days/month
- **Time to Relief** (avg by medication)
- **Most Effective Combinations** (if multi-med used)
- **MOH Risk Indicator**
  - Red warning if using abortives >10 days/month

### 5. Medication Overuse Warning
**Display on:**
- Analytics page (prominent warning)
- Calendar (indicator on high-usage months)
- Settings (notification setting)

**Warning UI:**
```
⚠️ MEDICATION OVERUSE WARNING

You've used abortive medication on 14 days this month.

Using medication >10 days/month for >3 months can cause
Medication Overuse Headache (MOH), making migraines worse.

What to do:
• Consult your doctor immediately
• Discuss preventive medication options
• Don't stop medications suddenly

Last 3 months: Jan: 14 days, Dec: 12 days, Nov: 13 days
```

### 6. Preventive Medication Tracking
**New UI section:**
- "Preventive Medications" card in Settings
- Add preventive med (name, dosage, frequency, start date)
- Mark as "Currently taking" or "Stopped"
- Rate overall effectiveness (after 3+ months)
- Track adherence (future: daily check-in)

---

## UI/UX Design

### Enhanced Log Screen
```
┌─────────────────────────────────────────────┐
│  Log New Episode                            │
├─────────────────────────────────────────────┤
│  [Pain Level: 7/10]                        │
│                                             │
│  💊 Medication Taken                        │
│                                             │
│  [+ Add Medication]                         │
│                                             │
│  Sumatriptan 100mg (tablet)                 │
│  Taken at 2:35 PM                      [✏️] │
│  ──────────────────────────────────         │
│                                             │
│  Ibuprofen 800mg (tablet)                   │
│  Taken at 2:35 PM                      [✏️] │
│  ──────────────────────────────────         │
│                                             │
│  [Log Attack]                               │
└─────────────────────────────────────────────┘
```

### Medication Effectiveness Modal (After Attack/Follow-up)
```
┌─────────────────────────────────────────────┐
│  How effective was your medication?      ✕  │
├─────────────────────────────────────────────┤
│                                             │
│  Sumatriptan 100mg                          │
│                                             │
│  Effectiveness:                             │
│  ⭐ ⭐ ⭐ ⭐ ⭐                              │
│                                             │
│  Time to relief:                            │
│  ○ 15 min  ○ 30 min  ● 1 hour  ○ 2 hours   │
│                                             │
│  Any side effects? (optional)               │
│  ☑ Nausea                                   │
│  ☐ Dizziness                                │
│  ☐ Drowsiness                               │
│                                             │
├─────────────────────────────────────────────┤
│  [Skip]                            [Save]   │
└─────────────────────────────────────────────┘
```

### Analytics - Medication Effectiveness
```
┌─────────────────────────────────────────────┐
│  💊 Medication Effectiveness                │
├─────────────────────────────────────────────┤
│                                             │
│  Sumatriptan      ⭐⭐⭐⭐⭐  (12 uses)      │
│  ████████████████░░ 4.2/5                   │
│  Avg time to relief: 45 min                 │
│                                             │
│  Ibuprofen        ⭐⭐⭐    (8 uses)         │
│  ██████████░░░░░░░░ 2.8/5                   │
│  Avg time to relief: 90 min                 │
│                                             │
│  Rizatriptan      ⭐⭐⭐⭐   (5 uses)        │
│  ██████████████░░░░ 3.8/5                   │
│  Avg time to relief: 30 min                 │
│                                             │
└─────────────────────────────────────────────┘
```

### MOH Warning (Analytics Page)
```
┌─────────────────────────────────────────────┐
│  ⚠️ MEDICATION OVERUSE WARNING               │
├─────────────────────────────────────────────┤
│                                             │
│  You've used abortive medications on        │
│  14 days this month.                        │
│                                             │
│  Using medication >10 days/month can cause  │
│  Medication Overuse Headache (MOH).         │
│                                             │
│  📅 Usage Last 3 Months:                    │
│  Jan 2024: 14 days ⚠️                       │
│  Dec 2023: 12 days ⚠️                       │
│  Nov 2023: 13 days ⚠️                       │
│                                             │
│  📞 Action Required:                        │
│  • Consult your doctor                      │
│  • Discuss preventive options               │
│  • Don't stop meds suddenly                 │
│                                             │
│  [Learn More About MOH]                     │
└─────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Basic Medication Library (Day 1)
- Create pre-populated medication library (30+ common meds)
- Add medication library to localStorage
- Create medication search/autocomplete UI
- Allow users to add custom medications

### Phase 2: Enhanced Logging (Day 2)
- Replace simple medication text field with multi-med UI
- Add medication selection with autocomplete
- Add dosage/formulation/time inputs
- Support multiple medications per attack
- Update logAttack() to save medication array

### Phase 3: Effectiveness Tracking (Day 2-3)
- Add effectiveness modal after attack ends
- Add effectiveness modal to follow-up notifications
- Store effectiveness ratings in medication usage
- Add "Rate medication" button to attack history

### Phase 4: Medication Analytics (Day 3)
- Add "Medication Effectiveness" chart
- Calculate average effectiveness per medication
- Show usage frequency per medication
- Display time to relief averages
- Add to analytics dashboard

### Phase 5: MOH Detection & Warning (Day 4)
- Calculate medication usage days per month
- Detect >10 days/month usage pattern
- Display warning on analytics page
- Add notification option for MOH warning
- Add educational content about MOH

### Phase 6: Preventive Medication (Optional - Day 5)
- Add preventive medication tracking UI
- Log start/end dates for preventives
- Track overall effectiveness
- Display in settings page

---

## Data Migration

### Existing Users
- Current `medication` field (text) → migrate to new structure
- Parse existing medication text (e.g., "Sumatriptan 100mg")
- Create medication usage entries with:
  - name (parsed)
  - dosage (parsed if possible)
  - effectiveness: null (no data yet)
- Keep original text in notes field
- No data loss, seamless migration

---

## Privacy & Clinical Considerations

### Privacy
- All medication data stays in localStorage
- No sharing with pharmacies, insurance, or third parties
- Export includes medication data (PDF, CSV, JSON)
- Users can delete/edit all medication entries

### Clinical Accuracy
- Pre-populated library based on medical literature
- MOH threshold aligned with ICHD-3 criteria (>10 days/month)
- Effectiveness tracking helps identify what works
- Side effect tracking helps spot patterns

### Accessibility
- Large buttons for medication selection
- Clear labels and instructions
- Works during active migraines (simple UI)
- Keyboard navigation supported

---

## Testing Checklist

- [ ] Add medication from library to attack
- [ ] Add custom medication
- [ ] Log attack with multiple medications
- [ ] Rate medication effectiveness
- [ ] View medication effectiveness chart
- [ ] MOH warning appears at >10 days/month
- [ ] Edit attack preserves medication data
- [ ] Export (PDF/CSV/JSON) includes medication data
- [ ] Import preserves medication data
- [ ] Medication autocomplete works
- [ ] Delete medication from library
- [ ] Migrate existing text medication field

---

## Future Enhancements (Not v1.8.2)

- Medication reminders (preventive daily dose)
- Adherence tracking (did you take your preventive today?)
- Drug interaction warnings
- Generic/brand name switching
- Pharmacy integration (optional, with consent)
- Medication cost tracking
- Insurance formulary checking

---

## Success Metrics

- Users can track which medications work best
- Doctors get detailed medication effectiveness data
- MOH warnings help users avoid medication overuse
- Clear clinical value in doctor visits
- No user confusion about effectiveness tracking
