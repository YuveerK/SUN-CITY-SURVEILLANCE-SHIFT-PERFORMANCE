# Sun City Surveillance Shift Performance

A single-page app that loads monthly CSV exports, builds per-officer and per-group statistics, and produces a quarter summary. You can customize the columns (rules), group people by month, and export a formatted Excel workbook.

## What this app does
- Load up to three months of CSV data and switch between Month 1/2/3 and Quarter views.
- Define rule-based columns (counts or sums) with multiple conditions.
- Create groups (officer/manager) and assign people per month.
- View a summary table with group headers, member rows, and totals.
- Export a multi-sheet Excel file with quarter and month summaries plus raw data.
- Toggle light/dark theme.

## Quick start
1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Open the URL printed in the terminal.
4. Upload your Month 1/2/3 CSVs, create groups, and export.

## Data requirements (CSV)
The app uses header names to match fields in rule conditions. These are the typical headers used by the default rules:
- `Captured By` (used to identify the officer)
- `Department`
- `Occurrence Task`
- `Occurrence Type`
- `Station`
- `Detection`

Notes:
- Header matching is case-sensitive because it uses the exact CSV key.
- Empty or missing fields can be targeted with the "Is blank" operator.
- You can still use other headers by choosing them in the rule editor.

## Workflow guide
### 1) Upload monthly CSVs
- Use the Upload buttons for Month 1, Month 2, and Month 3.
- Each upload replaces the data for that month.
- After uploading all months, switch to the Quarter view to see totals across months.

### 2) Configure column rules
Open the "Column Rules" panel to define what each column counts.

Each column has:
- Label: the name shown in the table and exports.
- Type:
  - Count: counts rows matching its conditions.
  - Sum: adds totals from other columns (e.g., Total, Total (T)).
- Match:
  - All: every condition must match.
  - Any: at least one condition matches.
- Conditions: field/operator/value rules.

Supported operators:
- Equals
- Contains
- Starts with
- Equals any (comma list)
- Contains any (comma list)
- Starts with any (comma list)
- Is blank

Tips:
- Use "Equals any" or "Contains any" for multi-value rules.
- For "Is blank", leave the value empty.
- Drag and drop columns to reorder.
- Duplicate or remove a column to iterate quickly.

### 3) Create groups and assign people
In the "Groups" panel:
1. Create a group (name + role).
2. Select a group.
3. Check people from the list and click Assign.

Rules:
- Grouping is per month. Quarter view rolls up all months.
- A person can only belong to one group per month.
- Use Clear to remove all members from a group for that month.
- Use Remove to remove an individual from a group for that month.

### 4) Review the summary table
The table shows:
- A group header
- Each member row
- A totals row for the group

Switch views to compare Month 1/2/3 or the Quarter totals.

### 5) Export to Excel
Click "Export to Excel" to download a workbook with:
- A Quarter Summary sheet (grouped totals)
- One sheet per month (grouped totals)
- A Raw Data sheet (all months combined)

Columns flagged as totals are highlighted in the export.

## Quarter configuration
The quarter label and month names are defined in `src/App.jsx` as:
- `QUARTER_CONFIG.months`
- `QUARTER_CONFIG.quarterName`

If you update these values, the UI tabs and export sheet names will follow.

## Common issues
### I do not see any people in the list
- Make sure at least one CSV is uploaded.
- Ensure the CSV includes the `Captured By` column.

### My rules do not match
- Check that the header names match the CSV exactly.
- Use "Contains" or "Starts with" if your data has prefixes/suffixes.
- Verify you are editing the correct column and view.

### Export button is disabled
- You need at least one group with assigned people.

## Development notes
- Built with React + Vite.
- CSV parsing uses `react-papaparse`.
- Excel export uses `xlsx-js-style`.

