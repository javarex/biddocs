# BidDocs Functional Requirements

## 1. Purpose and scope

This document describes the functional behavior currently represented by the BidDocs application as of September 22, 2026. BidDocs is a role-controlled web application for maintaining construction-project data, detailed unit price analyses (DUPAs), resource catalogs, Excel imports, and generated bid documents.

The requirements are implementation-derived. They describe the system as built and provide a baseline for acceptance testing and future change control.

## 2. Actors

| Actor | Description |
| --- | --- |
| Guest | An unauthenticated visitor who may access sign-in and account-recovery functions. |
| User | An authenticated, active account holder. Functional access is determined by assigned role permissions. |
| Project owner | A user who created a project or completed an import associated with it. |
| Super Admin | An active privileged user who bypasses permission checks and may administer users, roles, and system settings. |

## 3. General authorization rules

- **FR-AUTHZ-001:** The system shall require authentication for the dashboard, administration, project, import, library, and account-settings functions.
- **FR-AUTHZ-002:** The system shall terminate the session of an inactive user who attempts to access an active-user route and shall return the user to sign-in with an explanatory error.
- **FR-AUTHZ-003:** The system shall authorize non-Super-Admin users by permissions inherited from their assigned roles.
- **FR-AUTHZ-004:** The system shall allow a Super Admin to pass all application authorization checks.
- **FR-AUTHZ-005:** The system shall restrict project updates to users with `projects.update` permission who own the project.
- **FR-AUTHZ-006:** The system shall restrict project deletion to owners with `projects.delete` permission, while allowing a Super Admin to delete any project.
- **FR-AUTHZ-007:** The system shall treat a user as a project owner when the user created the project or completed an import associated with it.
- **FR-AUTHZ-008:** The system shall enforce authorization on the server even when a function is hidden in the user interface.

## 4. Authentication and account settings

- **FR-AUTH-001:** The system shall allow an active user to sign in using either a username or email address and a password.
- **FR-AUTH-002:** The system shall reject sign-in for inactive accounts or invalid credentials.
- **FR-AUTH-003:** The system shall limit password sign-in attempts to five per minute for each login-and-IP combination.
- **FR-AUTH-004:** The system shall not provide public user registration.
- **FR-AUTH-005:** The system shall support email verification and password-reset requests.
- **FR-AUTH-006:** An authenticated active user shall be able to view and update their profile.
- **FR-AUTH-007:** An authenticated active user shall be able to update their password, subject to throttling and configured password rules.
- **FR-AUTH-008:** An authenticated active non-Super-Admin user shall be able to delete their own profile after confirming their current password; a Super Admin shall not be able to self-delete through profile settings.
- **FR-AUTH-009:** The system shall allow a user to enable, confirm, use, and disable two-factor authentication and to manage recovery codes.
- **FR-AUTH-010:** The system shall allow a user to register, view, authenticate with, and remove passkeys when passkey support is enabled.
- **FR-AUTH-011:** The system shall require password confirmation before opening the security-management page.
- **FR-AUTH-012:** A user shall be able to select an available interface appearance preference.

## 5. Dashboard

- **FR-DASH-001:** The system shall present a dashboard to every authenticated active user.
- **FR-DASH-002:** The dashboard shall show Super Admins the total, active, inactive, and Super Admin user counts.
- **FR-DASH-003:** The dashboard shall show Super Admins the five most recently created users.
- **FR-DASH-004:** The dashboard shall not expose the administrative user statistics or recent-user list to ordinary users.

## 6. User administration

- **FR-USER-001:** A Super Admin shall be able to list users in pages of ten and search by name, username, or email address.
- **FR-USER-002:** A Super Admin shall be able to view a user's account details, roles, and effective role permissions.
- **FR-USER-003:** A Super Admin shall be able to create a user with a unique username, unique email address, confirmed password, active status, Super Admin status, and zero or more roles.
- **FR-USER-004:** Usernames and email addresses shall be stored in lowercase, and usernames shall contain only ASCII letters, numbers, dashes, and underscores.
- **FR-USER-005:** Administratively created users shall be treated as email-verified.
- **FR-USER-006:** A Super Admin shall be able to update a user's identity, status, Super Admin flag, and assigned roles.
- **FR-USER-007:** A Super Admin shall be able to reset another user's password using the configured password policy and password confirmation.
- **FR-USER-008:** A Super Admin shall be able to delete a user, except their own account.
- **FR-USER-009:** The system shall prevent deactivation, demotion, or deletion of the final active Super Admin.
- **FR-USER-010:** A Super Admin shall be able to impersonate an active, non-Super-Admin user and later leave the impersonation session.
- **FR-USER-011:** The system shall clear client navigation history when impersonation starts or ends.

## 7. Role and permission administration

- **FR-ROLE-001:** A Super Admin shall be able to list roles, their permissions, and their user counts.
- **FR-ROLE-002:** A Super Admin shall be able to create a role with a name, unique slug, optional description, and zero or more permissions.
- **FR-ROLE-003:** A Super Admin shall be able to update a role and replace its permission assignments.
- **FR-ROLE-004:** A Super Admin shall be able to delete a role.
- **FR-ROLE-005:** The system shall prevent deletion of the default `administrator` role.
- **FR-ROLE-006:** The system shall group permissions by Dashboard, Libraries, Users, Roles, Settings, Imports, and Projects for role assignment.

## 8. Resource libraries

- **FR-LIB-001:** An authorized user shall be able to view and search paginated catalogs for categories, labor, equipment, items, prices, and signatories.
- **FR-LIB-002:** Create, update, and delete operations shall be controlled independently by the corresponding library permissions.
- **FR-LIB-003:** The labor catalog shall maintain manpower description, non-negative rate, and type of either `Contract` or `Admin`.
- **FR-LIB-004:** The equipment catalog shall maintain equipment description and non-negative rental rate.
- **FR-LIB-005:** The category catalog shall maintain a unique numeric category ID, description, optional fund-center code, and active status.
- **FR-LIB-006:** The item catalog shall maintain a unique item code, category, description, and unit.
- **FR-LIB-007:** The item listing shall display the latest price and its effective date range when price history exists.
- **FR-LIB-008:** The price catalog shall maintain an item, non-negative price with up to two decimal places, effective-from date, and an optional effective-to date not earlier than the effective-from date.
- **FR-LIB-009:** The system shall prevent deletion of a category used by an item and shall report when any other library record cannot be deleted because it is referenced by a DUPA or price record.
- **FR-LIB-010:** Authorized users shall be able to synchronize categories and to synchronize items for one or more selected categories.
- **FR-LIB-011:** Creating labor or equipment through a supported JSON request shall return the created record for immediate use in a DUPA editor.
- **FR-SIG-001:** The signatory catalog shall maintain CATS number, name, position, optional linked system user, active status, and assigned signatory roles.
- **FR-SIG-002:** A system user shall be linked to at most one signatory.
- **FR-SIG-003:** At most one current active signatory shall be assigned to each project signatory role.
- **FR-SIG-004:** Assigning a role already held by another signatory shall require library-update permission and shall transfer the current assignment.
- **FR-SIG-005:** Deactivating a signatory shall remove that signatory's current role assignments.
- **FR-SIG-006:** The system shall retain signatories for project history; users shall deactivate rather than delete them.

## 9. Project management

- **FR-PROJ-001:** An authorized user shall be able to list projects in pages of ten and search by project code, project name, or location.
- **FR-PROJ-002:** The project list shall display section and DUPA-item counts and user-specific edit and delete availability.
- **FR-PROJ-003:** An authorized user shall be able to create a project with required project name, location, and positive contract duration, plus optional code, description, source of funds, classification, dimensions, floor area, implementation scheme, allotment class, charges, and signatories.
- **FR-PROJ-004:** Project type shall accept Buildings, Waterworks, or Others; the category shall be compatible with the selected type or contain a specified alternative category.
- **FR-PROJ-005:** Implementation scheme shall accept Administration or contract, and allotment class shall accept Trust Fund or General Fund.
- **FR-PROJ-006:** Project creation shall require the logged-in user to be linked to an active signatory, and that signatory shall become the project's preparer.
- **FR-PROJ-007:** On project creation, omitted approval signatories shall default to the current active signatory-role assignments.
- **FR-PROJ-008:** A project shall preserve its historical signatory selections, but any newly selected approval signatory shall be the current active assignee for that role.
- **FR-PROJ-009:** The system shall initialize separate ADD and NON-ADD project estimate settings when a project is created or first edited.
- **FR-PROJ-010:** An owner with update permission shall be able to update project details except the recorded preparer.
- **FR-PROJ-011:** An authorized user shall be able to view a project hierarchy and its ADD and NON-ADD financial totals.
- **FR-PROJ-012:** Project editing shall provide details, structure, charges, and review stages and shall report section, DUPA, configured-DUPA, imported-summary, and missing-signatory completion information.
- **FR-PROJ-013:** Project deletion shall also remove any stored edited bid-document file associated with the project.

## 10. Project structure and DUPA items

- **FR-STR-001:** A project owner with update permission shall be able to create, rename, order, and delete sections.
- **FR-STR-002:** The system shall be able to add an idempotent starter structure containing PART I, PART II, and PART III.
- **FR-STR-003:** Within a section, a project owner shall be able to create, rename, order, and delete subsections.
- **FR-STR-004:** Deleting a section or subsection shall delete the DUPA items it contains after user confirmation in the interface.
- **FR-DUPA-001:** Within a section or subsection, a project owner shall be able to create a DUPA with pay-item number, description, and unit.
- **FR-DUPA-002:** Each newly created DUPA shall receive separate ADD and NON-ADD estimates initialized for resource-based calculation with default OCM, profit, and VAT percentages of 12%, 8%, and 5% respectively.
- **FR-DUPA-003:** A project owner shall be able to update a DUPA's section, subsection, pay-item number, description, unit, and order.
- **FR-DUPA-004:** A project owner shall be able to delete a DUPA and all of its estimate resources.
- **FR-DUPA-005:** A project owner shall be able to duplicate a DUPA, including its ADD and NON-ADD estimates and resource rows.
- **FR-DUPA-006:** A duplicated DUPA shall receive a unique pay-item number using `(Copy)` or an incremented copy suffix and shall be placed after the existing items.
- **FR-DUPA-007:** The DUPA editor shall provide previous and next navigation according to section, subsection, and item ordering.

## 11. Detailed estimate calculation

- **FR-EST-001:** A project owner shall be able to maintain ADD and NON-ADD estimates independently for each DUPA.
- **FR-EST-002:** An estimate shall contain a non-negative quantity and OCM, profit, and VAT percentages between 0 and 100.
- **FR-EST-003:** An estimate shall support ordered labor rows containing a catalog labor, designation, persons, days, rate, and inclusion flag.
- **FR-EST-004:** An estimate shall support ordered equipment rows containing catalog equipment, designation, units, days, rental unit cost, and inclusion flag.
- **FR-EST-005:** An estimate shall support ordered material rows containing a catalog item, quantity, optional group, and inclusion flag.
- **FR-EST-006:** On save, material designation and unit shall come from the item catalog, and unit cost shall use the currently effective price or, when none is currently effective, the latest price.
- **FR-EST-007:** The system shall reject an estimate material whose catalog item has no price history.
- **FR-EST-008:** Excluded resource rows shall be retained but omitted from calculated costs.
- **FR-EST-009:** Labor cost shall equal the sum of persons multiplied by days multiplied by rate for included labor rows.
- **FR-EST-010:** Equipment cost shall equal the sum of units multiplied by days multiplied by rental unit cost for included equipment rows.
- **FR-EST-011:** Material cost shall equal the sum of quantity multiplied by unit cost for included material rows.
- **FR-EST-012:** Direct cost shall equal included labor, equipment, and material costs.
- **FR-EST-013:** OCM and profit amounts shall each be calculated from direct cost using their respective percentages.
- **FR-EST-014:** VAT shall be calculated from direct cost plus OCM plus profit using the VAT percentage.
- **FR-EST-015:** Indirect cost shall equal OCM plus profit plus VAT; total cost shall equal direct plus indirect cost; unit cost shall equal total cost divided by quantity.
- **FR-EST-016:** The system shall require a quantity greater than zero whenever direct cost is greater than zero.
- **FR-EST-017:** Monetary estimate results shall be rounded to two decimal places.
- **FR-EST-018:** Saving an estimate shall update the DUPA's combined legacy totals and mark the project's estimates as changed.

## 12. Project-level charges and totals

- **FR-CHG-001:** A project owner shall be able to configure ADD and NON-ADD program-of-work, pre-engineering, supervision, and contingencies values independently.
- **FR-CHG-002:** Pre-engineering and supervision shall be percentages between 0 and 100; program-of-work and contingencies values shall be non-negative amounts.
- **FR-CHG-003:** A project owner shall be able to maintain ordered miscellaneous charge rows with estimate type, description, unit, non-negative amount, and non-negative multiplier.
- **FR-CHG-004:** The system shall calculate each estimate type's pre-engineering and supervision amounts from the summed DUPA direct cost.
- **FR-CHG-005:** Miscellaneous total shall equal the sum of amount multiplied by multiplier for the applicable estimate type.
- **FR-CHG-006:** Charges total shall equal program-of-work, contingencies, pre-engineering, supervision, and miscellaneous amounts.
- **FR-CHG-007:** Grand total shall equal the DUPA total plus charges total, and the project total shall equal the ADD and NON-ADD grand totals.

## 13. Excel import

- **FR-IMP-001:** An authorized user shall be able to download the ABC Excel template using a sanitized custom filename.
- **FR-IMP-002:** An authorized user shall be able to upload an `.xlsx` or `.xlsm` workbook no larger than 50 MB for a new or selected project.
- **FR-IMP-003:** The user shall select insert-only, update-existing, or insert-or-update mode before previewing an import.
- **FR-IMP-004:** The system shall validate the workbook without changing project data and shall present counts, project metadata, up to ten sample rows, and row-level failures before commit.
- **FR-IMP-005:** The workbook shall contain an `ABC.` worksheet, recognized project metadata, the required A:M estimate headers, and at least one importable row.
- **FR-IMP-006:** Project name, location, and contract duration shall be required in the workbook; missing project code shall be replaced by a stable generated import code.
- **FR-IMP-007:** The importer shall recognize Roman-numbered PART rows as sections and lettered PART rows as subsections and shall ignore blank, heading, and total rows.
- **FR-IMP-008:** Each importable row shall require pay-item number, description, unit, and non-negative estimate values.
- **FR-IMP-009:** Pay-item matching shall ignore case and repeated surrounding or internal whitespace.
- **FR-IMP-010:** Insert-only mode shall reject matching stored pay items; update-existing mode shall reject pay items with no stored match; insert-or-update mode shall accept either case.
- **FR-IMP-011:** The importer shall reject duplicate pay-item numbers within a workbook.
- **FR-IMP-012:** A summary import shall not overwrite a stored DUPA that uses resource-calculated estimates.
- **FR-IMP-013:** Import commit shall create or update the project, its section/subsection hierarchy, and valid DUPA rows in one database transaction.
- **FR-IMP-014:** A failed commit shall roll back all project-data changes and mark the import failed.
- **FR-IMP-015:** Imports of more than 1,000 rows shall be queued for background processing; smaller imports shall be processed synchronously.
- **FR-IMP-016:** The system shall record importer, target project, mode, status, row counts, timing, metadata, and failures in import history.
- **FR-IMP-017:** Users with history permission shall be able to view paginated import history, restricted to the selected project where applicable.
- **FR-IMP-018:** Only the importing user or a Super Admin shall be able to commit, download errors for, or delete an import record, subject to the relevant import permission.
- **FR-IMP-019:** An authorized user shall be able to download row-level import errors as CSV and delete an import record and its stored workbook.

## 14. Bid-document generation and editing

- **FR-DOC-001:** An authorized user shall be able to generate and view a DOCX bid document from current project data.
- **FR-DOC-002:** The document page shall show project identity, section and item counts, total project cost, and saved-version metadata.
- **FR-DOC-003:** The client shall render the DOCX in the browser with page breaks, headers, footers, notes, and table-of-contents navigation where present.
- **FR-DOC-004:** An authorized editor shall be able to modify only paragraphs marked by valid `BDS_EDIT_n` references and save at least one and no more than 3,000 text edits per request.
- **FR-DOC-005:** Each editable paragraph value shall contain no more than 20,000 characters.
- **FR-DOC-006:** The system shall persist one saved edited DOCX version per project and record its revision, editor, and edit time.
- **FR-DOC-007:** The system shall reject a save whose submitted revision is no longer current and shall require the editor to reload.
- **FR-DOC-008:** The document page shall indicate when project estimates changed after the saved document version.
- **FR-DOC-009:** An authorized editor shall be able to remove saved edits, after which the document shall be regenerated from current project data.
- **FR-DOC-010:** The user shall be able to download or print the rendered bid document.

## 15. System settings

- **FR-SYS-001:** A Super Admin shall be able to view the configured application name, timezone, and runtime environment.

## 16. Data integrity and user feedback

- **FR-DATA-001:** The system shall validate submitted data before persistence and return field-specific errors for invalid input.
- **FR-DATA-002:** Multi-record estimate, import, role, user, and signatory operations shall be atomic where partial persistence would produce inconsistent data.
- **FR-DATA-003:** Changes affecting project estimates or structure shall update the project's estimate-change timestamp for bid-document freshness tracking.
- **FR-DATA-004:** Destructive user actions shall require confirmation in the user interface where the operation cannot be trivially undone.
- **FR-DATA-005:** Successful create, update, delete, import, and document actions shall return a user-visible status message.

## 17. Traceability note

The primary implementation sources for these requirements are `routes/web.php`, `routes/settings.php`, the controllers under `app/Http/Controllers`, authorization policies and seeders, form requests, `DupaEstimateService`, `BidDocumentImportService`, `BidDocumentWorkbookParser`, the Inertia pages under `resources/js/pages`, and the feature/unit test suite.
