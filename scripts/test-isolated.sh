#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
bds_test_php="${BDS_TEST_PHP:-php}"
bds_test_dir="$(mktemp -d /tmp/bds-tests.XXXXXX)"
bds_test_pid=''

cleanup() {
    if [[ -n "$bds_test_pid" ]]; then
        kill "$bds_test_pid" 2>/dev/null || true
        wait "$bds_test_pid" 2>/dev/null || true
    fi
    rm -rf -- "$bds_test_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

export APP_ENV=testing APP_CONFIG_CACHE="$bds_test_dir/config.php"
export DB_URL='' CACHE_STORE=array SESSION_DRIVER=array QUEUE_CONNECTION=sync

if "$bds_test_php" -r 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);'; then
    export DB_CONNECTION=sqlite DB_DATABASE=:memory:
else
    for bds_test_command in mysqld mysql; do
        if ! command -v "$bds_test_command" >/dev/null; then
            echo "Install pdo_sqlite or MySQL server/client to run isolated tests." >&2
            exit 1
        fi
    done

    export DB_CONNECTION=mysql DB_DATABASE=bds_tests DB_USERNAME=root DB_PASSWORD=''
    export DB_SOCKET="$bds_test_dir/mysql.sock"
    echo 'Starting a disposable MySQL server with networking disabled...'
    if ! mysqld --no-defaults --initialize-insecure --datadir="$bds_test_dir/data" \
        --log-error="$bds_test_dir/init.log"; then
        cat "$bds_test_dir/init.log" >&2
        exit 1
    fi
    mysqld --no-defaults --datadir="$bds_test_dir/data" --socket="$DB_SOCKET" \
        --pid-file="$bds_test_dir/mysql.pid" --log-error="$bds_test_dir/server.log" \
        --skip-networking --mysqlx=OFF --innodb-buffer-pool-size=64M \
        --innodb-flush-log-at-trx-commit=2 &
    bds_test_pid=$!

    bds_test_ready=false
    for ((bds_test_attempt = 0; bds_test_attempt < 600; bds_test_attempt++)); do
        if mysql --no-defaults --socket="$DB_SOCKET" -u root -e 'SELECT 1' >/dev/null 2>&1; then
            bds_test_ready=true
            break
        fi
        if ! kill -0 "$bds_test_pid" 2>/dev/null; then
            break
        fi
        sleep 0.2
    done
    if [[ "$bds_test_ready" != true ]]; then
        cat "$bds_test_dir/server.log" >&2
        exit 1
    fi
    mysql --no-defaults --socket="$DB_SOCKET" -u root \
        -e 'CREATE DATABASE bds_tests CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
fi

"$bds_test_php" artisan test --compact "$@"
