<?php

namespace Tests\Unit;

use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DatabaseIsolationTest extends TestCase
{
    public function test_refreshing_an_application_database_is_rejected_even_when_a_test_name_is_configured(): void
    {
        config([
            'database.default' => 'mysql',
            'database.connections.mysql.database' => 'bds_tests',
            'database.connections.mysql.url' => 'mysql://test:unused@localhost/bds',
        ]);
        DB::purge('mysql');

        $this->expectException(\LogicException::class);
        $this->beforeRefreshingDatabase();
    }

    #[DataProvider('unsafeDatabases')]
    public function test_refreshing_persistent_databases_is_rejected(string $driver, string $database): void
    {
        config([
            'database.default' => $driver,
            "database.connections.{$driver}.database" => $database,
            "database.connections.{$driver}.url" => null,
        ]);
        DB::purge($driver);

        $this->expectException(\LogicException::class);
        $this->beforeRefreshingDatabase();
    }

    /** @return array<string, array{string, string}> */
    public static function unsafeDatabases(): array
    {
        return [
            'application MySQL' => ['mysql', 'bds'],
            'another application' => ['mysql', 'another_application'],
            'application MariaDB' => ['mariadb', 'bds'],
            'persistent SQLite' => ['sqlite', '/tmp/bds.sqlite'],
        ];
    }
}
