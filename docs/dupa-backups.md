# Detail backup computations

Each DUPA item may have several backup tables, managed together from the estimate toolbar. Backups and variables belong to one ADD or NON-ADD estimate. Labor, equipment and materials can use their exported results. Existing backups remain available regardless of their former detail owner.

## Setup

Apply the additive migration before opening the updated DUPA editor:

```sh
php artisan migrate --path=database/migrations/2026_10_15_000001_create_dupa_detail_backups.php
php artisan migrate --path=database/migrations/2026_10_15_000002_add_backup_template_creators_and_exclusions.php
```

Existing estimates are not backfilled. Saving a resource estimate assigns stable UUIDs to its detail rows. Backups do not require a labor, equipment or material owner.

## Workflow

Create and manage DUPA items under **Projects → Actions → DUPA**. Choose **Add Item**, choose its section/subsection and search the DUPA source catalog for the pay item variant, and choose **Create & open estimate**. The estimate form opens in a dialog on the DUPA page. The original Excel-style summary remains the main DUPA view. Each editable item has an **Edit** action beside its description; this reopens the same modal for item details, ADD/NON-ADD estimates, and backups. Saving and closing refreshes the summary.

**Edit Project** contains project details, project charges and review; DUPA encoding is on the dedicated DUPA page.

1. Add details and save the estimate.
2. Click **Backups** in the DUPA estimate toolbar. Its separate modal lists every backup for the item and current ADD/NON-ADD side. Choose **Custom dimensions table** or a saved template, then **New backup**.
3. Enter measurements in the Excel-style grid. It has column letters, row numbers, a formula bar, sheet tabs, and live calculated totals. Tab moves across cells; Enter moves down. You can paste tab-separated measurements from Excel. Formula cells are green. Open **Inputs & productivity** to change crew counts, output per day or other named inputs. Customize columns, inputs and result formulas in the collapsed section when needed.
4. Under **Use these results in the DUPA**, choose **Use result for…** beside a result and select quantity, days, or another destination. **Linked DUPA fields** shows the connections. Its result dropdown replaces the selected field formula with that one result; repeated selections never append references. Use the collapsed **Formula** editor for arithmetic. Custom formulas remain available in a collapsed section. Fields without a link retain manual values.
5. **Save draft** saves the backup and bindings without changing estimate quantities or costs. Live calculation and **Preview** show proposed values and totals without saving. **Apply & Save** recalculates on the server and saves all changes together.
6. To return a field to manual entry, choose **Use manual value** under **Linked DUPA fields**, then preview and apply. The last applied number remains available as the manual value.

Save, apply, or discard unsaved backup changes before editing the estimate. Applied formula fields are read-only. A concurrent save invalidates older previews; reload and preview again.

## Formula examples

- Row volume: `=ROUND(a*b*depth*count,2)`
- An input: `=Classrooms-1` or `=inputs.classrooms-1`
- Input named Test with value 1000: a result named Test can use `=Test` and returns 1000. Simple input/result names are case-insensitive; row column names take precedence inside row formulas, then inputs, then results. Explicit keys such as `inputs.Test` and `outputs.Test` remain available. Duplicate display names require an explicit key.
- A specific cell: `=rows.footing1.volume`
- Sum a column, including future rows: `=SUM(rows.volume)`
- An output in the same backup: `=outputs.total_volume-outputs.manual_volume`
- A shared variable: `=backup_key.outputs.total_volume`
- A detail binding: `=ROUNDUP(backup_key.outputs.equipment_volume/200,0)`

The picker supplies actual backup and variable keys. Display labels can change without breaking key-based references. Formulas that use a display name must be updated if that name is changed. Renaming keys requires updating references. Another backup's inputs and cells are private; export a variable to share its value. Formulas cannot reference other estimate sides, projects, or resource fields directly. Crew counts and productivity can be entered as named inputs.

Supported operations: `+`, `-`, `*`, `/`, parentheses, `SUM`, `ROUND`, and `ROUNDUP`. `ROUNDUP` rounds away from zero. Unknown variables, cycles, zero divisors, and invalid numeric results are rejected. Bound numbers are rounded to the existing destination precision before costs are calculated: four decimals for quantities/persons/units/days and two for rates.

## Templates and copies

**Save template** in the bottom toolbar asks for a name and stores a new, independent, project-scoped snapshot attributed to the signed-in user. Existing templates cannot be edited or overwritten; use a different name for each new template. Reusing one creates a new backup. A reusable template must be self-contained; replace references to other backups with inputs first.

The built-in **803 (1)a Structure Excavation (ADD example)** follows the commented workbook: 432.36 m³ total, 62.69 m³ manual excavation, 369.67 m³ equipment excavation, 11 labor days with four laborers, and two excavator days at 200 m³/day. Its ADD productivity/rounding assumptions are editable and must be reviewed when reused for NON-ADD or a different project. Creating the table does not create formula bindings automatically.

Duplicating a DUPA or copying ADD to NON-ADD copies backup drafts and applied snapshots, with independent detail UUIDs. Rows with applied formula bindings cannot be removed until their bindings are removed and applied. Backups themselves belong to the item and do not prevent removing an unlinked former owner row.

## Verification

Calculator tests require no database:

```sh
vendor/bin/phpunit tests/Unit/DupaBackupCalculatorTest.php
```

Integration tests explicitly require a disposable MySQL instance with its socket under `/tmp/bds-backup-tests.*` and a database name ending in `_tests`. They refuse the application database. Set `DB_CONNECTION`, `DB_DATABASE`, `DB_SOCKET`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_URL` for that isolated instance, then run `tests/Integration/DupaBackupTest.php`.

The toolbar shows the total backups and how many are in use. Sheet tabs mark each backup **In use**, **Selected · not applied**, or **Unused**. In use includes transitive references through other backups. **Delete backup** is locked while applied links or other backup formulas reference it. Switch linked results and **Apply & Save** first, then delete the unused backup and save. The server rejects deletion of a backup still used by the applied estimate when saving a draft, and validates all references before applying.

Labor **Days** accepts a number or `=` to search exported backup results. Choose a suggestion with the mouse or arrow keys and Enter; Escape cancels. Typing a number in a linked cell removes its binding and leaves the new direct count pending the ordinary estimate save. Equipment **Days** and material **Quantity** keep their value-source dropdown beneath the number. **Direct count** keeps the current number and makes it editable. Choosing an exported result previews and applies the binding immediately, recalculates totals, and locks the numeric cell. Save pending estimate edits and apply saved backup drafts before switching sources. Custom arithmetic remains available in the backup modal.

The template picker searches by name or creator and lists only templates not excluded by the signed-in user. **Hide** creates a unique `excluded_templates` row for that user and template; it does not change the template or other users' choices. **Undo hide** reverses the last exclusion. Existing templates without a recorded creator are labeled Unknown creator. The built-in workbook example is labeled separately.

Open **Procurement → Backup Templates** (`/admin/backup-templates`) to manage visibility after a reload. Search by template, creator or project, and filter Active for me / Hidden for me. **Activate for me** removes only your exclusion and makes the template available when reopening the backup picker. The picker also links to this page in a new tab. Access follows project-update permissions and project ownership/import access; templates remain immutable.
