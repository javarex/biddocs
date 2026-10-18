# BDS review: 18 October 2026

## Authorization fixes

- The user edit action did not load assigned roles before building its response.
  The form therefore started with no roles selected and could remove existing
  assignments on save. It now loads the user's roles, with regression coverage
  for the form response and subsequent save.
- Final active Super Admin protection compared input strictly with `false`,
  although Laravel boolean validation also accepts `0` and `"0"`. Those inputs
  could deactivate or demote the final administrator. The check now normalizes
  the values and locks active administrator rows during the transaction.
- The protected default Administrator role could be renamed and then deleted.
  Its slug is now fixed in both request validation and the editing form.
- Impersonation now validates the original administrator on each request. Deleted,
  demoted, or deactivated original accounts terminate the session. Deleted targets,
  identity mismatches, and targets promoted to Super Admin also terminate it.
  Validation runs before authentication middleware so deleted accounts cannot
  leave stale impersonation metadata behind.
- Identity transitions force an Inertia client reload, regenerate the CSRF token,
  and clear password-confirmation and pending-login state. Permission props come
  from the target account, and nested impersonation is denied. An inactive target
  can still use the leave endpoint when the original administrator remains valid.
- Administration navigation now follows the existing Super-Admin-only routes.
  DUPA item and price synchronization controls use the same dedicated permissions
  as their endpoints. Manual item creation remains forbidden, including through
  policy checks for Super Admins. Inactive accounts fail authorization checks.
  Deactivation logout errors use the login form's actual `login` field.
- Item price-history authorization runs before record lookup, so unauthorized
  requests return a consistent denial even when the item does not exist.

## Resource and query improvements

| Area | Change and regression check |
| --- | --- |
| Project listing | Load successful import ownership in one batch. Query count stays constant from one to ten projects, with a maximum of five queries in the tested request. Failed imports do not grant edit/delete access. |
| Role permissions | Reuse loaded role permissions throughout a request. Refresh them on the next request so changes and revocations take effect without a persistent permission cache. Library checks use two role/permission queries in total. |
| Dashboard | Combine four statistics queries into one aggregate query; the recent-user query brings the tested request total to two. |
| Role listing | Return permission counts instead of every permission record. The tested listing uses one query. |
| Signatory library | Fetch current role assignments once instead of querying separately for each role. |
| DUPA resources | Select only the applicable catalog price for each selected item, instead of loading its full price history into PHP. Both catalog loading and estimate-save pricing use one price query each. Existing active-price/fallback behavior and server-authoritative item details are covered. |
| User editing | Remove unused eager loading of every role's permissions. |

## Test and tooling repairs

- Added `composer test:isolated` and `composer test:performance`; `composer test`
  now uses the isolated runner after Pint and PHPStan. The runner supports
  in-memory SQLite or a disposable MySQL server with networking disabled and
  automatic cleanup, without clearing the application's configuration cache.
- Unified database-refresh guards and verify the resolved database name, including
  URL overrides. Tests reject persistent SQLite files and application databases.
- Updated stale tests to enforce sync-only item creation and to expect persisted
  estimate JSON from JSON save requests. Template immutability checks compare
  persisted, decoded values instead of database-specific JSON formatting.
- Catalog price assertions compare numeric values across MySQL and SQLite.
- Added `npm test` for the existing JavaScript tests and repaired their ESLint
  configuration. Added missing PHP generic/array annotations and corrected the
  document-generation script's existing Pint formatting failures. Repaired four
  existing Prettier failures so the repository formatting check passes.

The connected database was inspected read-only: all four checked feature
permissions (`items.sync`, `categories.sync`, `items.prices.encode`, and
`projects.dupa.view`) exist. No application database migrations, seeders, or data
repairs were performed.

## Verification

- `composer test`: passed on disposable MySQL, with 190 tests passed and two
  feature-gated tests skipped.
- Final in-memory SQLite suite: 191 passed, two skipped, including the added
  deactivation-message regression.
- MySQL performance group: five passed, including 111 assertions.
- JavaScript tests: 16 passed.
- PHPStan, Pint, TypeScript, ESLint, Prettier, Composer validation, production
  build, shell syntax, and `git diff --check`: passed.

See [testing.md](testing.md) for commands. Query budgets are regression checks;
production load timings and a browser walkthrough remain unmeasured.
