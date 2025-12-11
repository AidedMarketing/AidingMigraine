# Entry Editing Feature Specification

## Overview
Allow users to edit previously logged migraine attacks without deleting and re-entering data.

## Philosophy Alignment
- **User Control**: Fix mistakes, maintain data integrity
- **Privacy First**: All editing happens locally (localStorage)
- **Clinically Relevant**: Preserve attack ID, weather data, and timestamps
- **Migraine-Friendly**: Simple modal, clear actions, easy to use

## User Stories

### Primary Use Cases
1. **As a user**, I want to correct the pain level I logged because I initially underestimated it
2. **As a user**, I want to fix a typo in my medication name
3. **As a user**, I want to add notes I forgot to include when logging the attack
4. **As a user**, I want to adjust the start/end time if I logged it late
5. **As a user**, I want to change the date if I accidentally logged it on the wrong day

## UI/UX Design

### Entry Points
1. **Calendar View**: Edit icon (✏️) on each day with logged attacks
2. **History View**: Edit button on expanded attack details (future feature)

### Edit Modal Layout
```
┌─────────────────────────────────────────────┐
│  Edit Migraine Episode                   ✕  │
├─────────────────────────────────────────────┤
│                                             │
│  Start Date & Time                          │
│  [Date Picker] [Time Picker]                │
│                                             │
│  End Date & Time (if completed)             │
│  [Date Picker] [Time Picker]                │
│                                             │
│  Pain Level                                 │
│  [0] [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]│
│                                             │
│  Medication                                 │
│  [Text Input]                               │
│                                             │
│  Notes                                      │
│  [Text Area]                                │
│                                             │
│  ⚠️ Weather data will be preserved          │
│                                             │
├─────────────────────────────────────────────┤
│  [Cancel]              [Save Changes]       │
└─────────────────────────────────────────────┘
```

## Technical Implementation

### Data Preservation
**MUST Preserve (never editable):**
- Attack ID (unique identifier)
- Original weather data (historical accuracy)
- Creation timestamp (audit trail)
- Pain history array (for active attacks)

**CAN Edit:**
- Start date/time
- End date/time
- Current pain level
- Medication
- Notes
- Status (active → completed if needed)

### Validation Rules
1. **Date/Time**:
   - Start time must be before end time
   - Can't set future dates
   - Duration calculation updates automatically

2. **Pain Level**:
   - Must be 0-10
   - Updates category automatically (mild/moderate/severe)

3. **Attack ID**:
   - Never changes
   - Maintains notification schedule associations

### Calendar Update Logic
After editing:
1. Remove attack from original date in calendar
2. Add attack to new date (if date changed)
3. Re-render calendar
4. Re-calculate analytics
5. Save to localStorage
6. Show success message

### Edge Cases
1. **Editing Active Attack**: Allow, but preserve active status
2. **Date Change Creates Conflict**: Allow overlapping attacks (rare but possible)
3. **Editing Removes Multi-Day**: Recalculate if end date changes
4. **Notification Scheduled**: Preserve scheduled notifications (don't reschedule)

## Privacy & Data Integrity

### Local Only
- All edits happen in localStorage
- No server communication
- No audit log sent anywhere
- User has complete control

### Data Versioning
- Add `lastModified` timestamp to track edits
- Add `editCount` to track number of modifications
- Add `originalStartTime` to preserve original data (optional)

## Accessibility
- Keyboard navigation (Tab, Enter, Escape)
- ARIA labels for all inputs
- Clear focus indicators
- Screen reader friendly

## Future Enhancements (Not v1.8.0)
- Edit history/changelog (show what was changed)
- Batch edit multiple attacks
- Undo last edit
- Warning if editing very old entries (>30 days)

## Testing Checklist
- [ ] Edit pain level → Analytics update correctly
- [ ] Edit date → Calendar updates correctly
- [ ] Edit time → Duration recalculates correctly
- [ ] Edit medication → Data persists correctly
- [ ] Edit active attack → Stays active
- [ ] Edit completed attack → Stays completed
- [ ] Cancel editing → No changes saved
- [ ] Weather data preserved → Original data intact
- [ ] Multiple edits → All changes persist
- [ ] Export after edit → PDF shows edited data

## Success Metrics
- Users can correct mistakes without deleting entries
- Zero data loss during editing
- All analytics remain accurate after edits
- Export functions show edited data correctly
