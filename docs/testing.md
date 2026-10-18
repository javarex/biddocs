# Running checks

Use PHP 8.4 or newer with the extensions required by Composer, then run:

```bash
composer test:isolated
composer test:performance
composer test
npm test
npm run types:check
npm run lint:check
npm run build
vendor/bin/phpstan analyse
```

`test:isolated` uses in-memory SQLite when PDO SQLite is installed. Otherwise it
starts a temporary MySQL server on a private Unix socket with networking disabled.
It removes the temporary database and stops that server when the command exits.
It does not use or modify the database configured in `.env`, and it uses a separate
configuration-cache path. MySQL server and client binaries must be available for
the fallback. Run it as a regular user with permission to create files in `/tmp`.
Set `BDS_TEST_PHP` to select a different PHP executable.
`composer test` also runs Pint and PHPStan before using this isolated runner.

Pass a path or filter to the isolated runner for focused checks:

```bash
composer test:isolated -- tests/Feature/Authorization
composer test:isolated -- --filter=ImpersonationTest
```

The performance group checks database query budgets and whether query counts stay
constant as a page grows. It also verifies returned counts, permissions, ownership,
and price selection. These deterministic checks do not measure production response
times, concurrent traffic, or browser rendering.

Database-refreshing tests refuse databases other than in-memory SQLite or a
dedicated MySQL/MariaDB database whose resolved name ends in `_tests`. Do not point
tests at a persistent application database.
