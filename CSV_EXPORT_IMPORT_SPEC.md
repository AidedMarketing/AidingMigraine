# CSV Export/Import Feature Specification

## Overview
Enable users to export migraine data to CSV format and import data from other migraine tracking apps.

## Philosophy Alignment
- **User Control**: Complete data portability
- **Privacy First**: Export/import happens locally, no server
- **Data Ownership**: No vendor lock-in, users own their data
- **Clinically Relevant**: CSV format doctors can open in Excel/Sheets

## CSV Export Format

### Column Structure
```csv
Date,Start Time,End Time,Duration (hours),Pain Level,Category,Medication,Notes,Resolution,Status,Pressure (hPa)
2024-01-15,14:30,18:45,4.25,7,Moderate,Sumatriptan 100mg,Triggered by stress,Resolved with rest,completed,1013.2
2024-01-20,09:00,,,8,Severe,Ibuprofen 800mg,Aura present,Still ongoing,active,
```

### Field Definitions
1. **Date** - ISO date (YYYY-MM-DD)
2. **Start Time** - 24-hour format (HH:MM)
3. **End Time** - 24-hour format (HH:MM) or empty if active
4. **Duration (hours)** - Decimal hours (e.g., 4.25 = 4h 15m) or empty if active
5. **Pain Level** - 0-10 integer
6. **Category** - Mild/Moderate/Severe
7. **Medication** - Text field or empty
8. **Notes** - Text field or empty
9. **Resolution** - End notes or empty
10. **Status** - active/completed
11. **Pressure (hPa)** - Starting pressure or empty if no weather data

### Export Features
- **Date Range Selection**: Export all or specific date range
- **File Naming**: `aiding-migraine-export-YYYY-MM-DD.csv`
- **Encoding**: UTF-8 with BOM for Excel compatibility
- **Sorting**: Chronological order (oldest to newest)

## CSV Import Format

### Supported Formats

#### Standard Import (Our Format)
Same as export format above.

#### Migraine Buddy Format (Common App)
```csv
Date,Time,Pain,Duration,Medication,Triggers,Symptoms,Notes
2024-01-15,14:30,7,4h 15m,Sumatriptan,Stress,"Nausea, Photophobia",Stressful day
```

#### Simple Format (Minimal)
```csv
Date,Time,Pain
2024-01-15,14:30,7
```

### Import Features
- **Auto-detection**: Detect CSV format automatically
- **Column Mapping**: Map columns to our data structure
- **Validation**: Check data types and ranges
- **Merge Strategy**:
  - Add new entries
  - Skip duplicates (same date/time)
  - Ask user about conflicts
- **Preview**: Show first 5 rows before importing

### Import Validation Rules
1. **Date**: Must be valid date, can't be future
2. **Time**: Must be valid 24-hour time
3. **Pain Level**: Must be 0-10 integer
4. **Duration**: Parse various formats (4h 15m, 4.25, 255 minutes)
5. **Required Fields**: Date, Time, Pain Level minimum

## UI/UX Design

### Export UI (Settings Page)
```
┌─────────────────────────────────────────────┐
│  📊 Export Data                             │
├─────────────────────────────────────────────┤
│                                             │
│  Export as CSV                              │
│  ├─ Compatible with Excel, Google Sheets   │
│  ├─ Easy data migration                     │
│  └─ Doctor-friendly format                  │
│                                             │
│  Export Range:                              │
│  ○ All Data                                 │
│  ○ Custom Range                             │
│     [Start Date] to [End Date]              │
│                                             │
│  [Export to CSV]                            │
│                                             │
└─────────────────────────────────────────────┘
```

### Import UI (Settings Page)
```
┌─────────────────────────────────────────────┐
│  📥 Import Data                             │
├─────────────────────────────────────────────┤
│                                             │
│  Import from CSV                            │
│  ├─ Import from other migraine apps        │
│  ├─ Migrate historical data                │
│  └─ Merge with existing entries             │
│                                             │
│  Supported Formats:                         │
│  ✓ Aiding Migraine CSV                     │
│  ✓ Migraine Buddy                          │
│  ✓ Generic CSV (Date, Time, Pain)          │
│                                             │
│  [Choose CSV File]                          │
│                                             │
└─────────────────────────────────────────────┘
```

### Import Preview Modal
```
┌─────────────────────────────────────────────┐
│  Import Preview - 45 entries found       ✕  │
├─────────────────────────────────────────────┤
│                                             │
│  First 5 entries:                           │
│                                             │
│  📅 2024-01-15 14:30 - Pain: 7/10           │
│  📅 2024-01-20 09:00 - Pain: 8/10           │
│  📅 2024-01-22 16:15 - Pain: 5/10           │
│  📅 2024-01-25 11:30 - Pain: 9/10           │
│  📅 2024-01-28 08:45 - Pain: 6/10           │
│                                             │
│  ⚠️ 3 duplicates detected (will be skipped) │
│                                             │
├─────────────────────────────────────────────┤
│  [Cancel]              [Import 42 Entries]  │
└─────────────────────────────────────────────┘
```

## Technical Implementation

### Export Function
```javascript
function exportToCSV(startDate = null, endDate = null) {
    // Filter data by date range
    // Convert to CSV rows
    // Create Blob with UTF-8 BOM
    // Download file
}
```

### Import Function
```javascript
function importFromCSV(csvText) {
    // Parse CSV
    // Detect format
    // Validate data
    // Show preview modal
    // Merge with existing data
    // Update UI
}
```

### CSV Parsing
- Use Papa Parse library (lightweight, robust) OR
- Custom parser (no dependencies, privacy-first)
- Handle quoted fields with commas
- Handle newlines in notes field

### Duplicate Detection
Compare by:
1. Start date/time (within 1 minute tolerance)
2. Pain level match
3. If both match → likely duplicate

### Data Mapping

#### Migraine Buddy → Aiding Migraine
```
Date + Time → startTime
Pain → painLevel
Duration → calculate endTime
Medication → medication
Triggers + Symptoms + Notes → notes (combined)
```

#### Simple Format → Aiding Migraine
```
Date + Time → startTime
Pain → painLevel
(No end time, medication, notes)
```

## Privacy & Data Integrity

### Export Privacy
- All data exported from localStorage
- No server communication
- No tracking of export activity
- File stays on user's device

### Import Privacy
- All data imported to localStorage
- No server communication
- File read client-side only
- Original CSV not stored

### Data Integrity
- Validate all imported data
- Generate new unique IDs
- Don't import weather data (can't recreate historical)
- Mark imported entries: `importedAt` timestamp
- Track import source: `importSource` (migraine-buddy, csv-manual, etc.)

## Edge Cases

1. **Large CSV Files**:
   - Handle 1000+ entries efficiently
   - Show progress indicator
   - Process in chunks if needed

2. **Malformed CSV**:
   - Show clear error messages
   - Highlight problematic rows
   - Allow partial import of valid rows

3. **Encoding Issues**:
   - Handle UTF-8, UTF-16, Windows-1252
   - Detect BOM
   - Convert special characters

4. **Date Format Variations**:
   - Support MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
   - Auto-detect format from data patterns
   - Ask user if ambiguous

5. **Time Zones**:
   - Assume local timezone
   - Warn user about timezone considerations

## Testing Checklist

- [ ] Export all data to CSV
- [ ] Export date range to CSV
- [ ] Open CSV in Excel - displays correctly
- [ ] Open CSV in Google Sheets - displays correctly
- [ ] Import our own exported CSV - perfect round-trip
- [ ] Import Migraine Buddy format
- [ ] Import simple format
- [ ] Handle duplicate detection
- [ ] Handle malformed CSV gracefully
- [ ] Handle empty CSV file
- [ ] Import 500+ entries - performance good
- [ ] Special characters in notes - exported/imported correctly
- [ ] Commas in notes field - quoted correctly
- [ ] Analytics update after import
- [ ] Calendar updates after import

## Future Enhancements (Not v1.8.0)

- Import from Google Calendar
- Export to PDF with charts (already exists)
- Scheduled auto-exports to Google Drive
- Import from Apple Health
- Export to FHIR format (medical standard)

## Success Metrics

- Users can migrate from other apps seamlessly
- Zero data loss during export/import cycle
- CSV opens correctly in Excel and Google Sheets
- Import completes in <5 seconds for 100 entries
