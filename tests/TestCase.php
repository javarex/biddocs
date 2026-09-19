<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    protected function beforeRefreshingDatabase()
    {
        if (app()->environment('testing')
            && config('database.default') === 'mysql'
            && config('database.connections.mysql.database') === 'bds') {
            throw new \LogicException('Refusing to refresh the live bds database during tests.');
        }
    }

    protected function skipUnlessFortifyHas(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }
}
