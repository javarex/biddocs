<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    protected function beforeRefreshingDatabase()
    {
        $connection = app('db')->connection();
        $database = $connection->getDatabaseName();
        $usesMemorySqlite = $connection->getDriverName() === 'sqlite' && $database === ':memory:';
        $usesTestDatabase = in_array($connection->getDriverName(), ['mysql', 'mariadb'], true)
            && str_ends_with($database, '_tests');

        if (! app()->environment('testing') || (! $usesMemorySqlite && ! $usesTestDatabase)) {
            throw new \LogicException('Tests require in-memory SQLite or a dedicated MySQL database ending in _tests.');
        }
    }

    protected function skipUnlessFortifyHas(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }
}
