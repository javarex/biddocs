<?php

namespace App\Services\Backup;

use InvalidArgumentException;

/** A deliberately small numeric expression parser. Never evaluates PHP or JavaScript. */
class Formula
{
    /** @var list<string> */
    private array $tokens = [];

    private int $position = 0;

    private \Closure $resolve;

    public function evaluate(string $expression, callable $resolve): float
    {
        if (strlen($expression) > 2000) {
            throw new InvalidArgumentException('Formula exceeds 2000 characters.');
        }
        $expression = ltrim(trim($expression), '=');
        preg_match_all('/\s*(\d+(?:\.\d*)?|\.\d+|[A-Za-z_][A-Za-z_0-9.]*|[+*\/(),-])/', $expression, $matches);
        if (preg_replace('/\s+/', '', implode('', $matches[0])) !== preg_replace('/\s+/', '', $expression)) {
            throw new InvalidArgumentException('Unsupported formula syntax.');
        }
        $this->tokens = $matches[1];
        $this->position = 0;
        $this->resolve = \Closure::fromCallable($resolve);
        $result = $this->expression();
        if ($this->position !== count($this->tokens) || ! is_finite($result)) {
            throw new InvalidArgumentException('Invalid numeric formula result.');
        }

        return $result;
    }

    private function expression(): float
    {
        $value = $this->term();
        while (in_array($this->peek(), ['+', '-'], true)) {
            $op = $this->tokens[$this->position++];
            $right = $this->term();
            $value = $op === '+' ? $value + $right : $value - $right;
        }

        return $value;
    }

    private function term(): float
    {
        $value = $this->atom();
        while (in_array($this->peek(), ['*', '/'], true)) {
            $op = $this->tokens[$this->position++];
            $right = $this->atom();
            if ($op === '/' && $right == 0) {
                throw new InvalidArgumentException('Division by zero.');
            }
            $value = $op === '*' ? $value * $right : $value / $right;
        }

        return $value;
    }

    private function atom(): float
    {
        $token = $this->tokens[$this->position++] ?? '';
        if ($token === '+' || $token === '-') {
            return ($token === '-' ? -1 : 1) * $this->atom();
        }
        if ($token === '(') {
            $value = $this->expression();
            $this->expect(')');

            return $value;
        }
        if (is_numeric($token)) {
            return (float) $token;
        }
        if (! preg_match('/^[A-Za-z_][A-Za-z_0-9.]*$/D', $token)) {
            throw new InvalidArgumentException('Expected a number, variable, or function.');
        }
        if ($this->peek() !== '(') {
            return (float) ($this->resolve)($token);
        }
        $this->position++;
        $arguments = [$this->expression()];
        while ($this->peek() === ',') {
            $this->position++;
            $arguments[] = $this->expression();
        }
        $this->expect(')');
        if (strtoupper($token) === 'SUM') {
            return array_sum($arguments);
        }
        if (! in_array(strtoupper($token), ['ROUND', 'ROUNDUP'], true) || count($arguments) !== 2) {
            throw new InvalidArgumentException('Use SUM(values), ROUND(value, digits), or ROUNDUP(value, digits).');
        }
        [$value, $digits] = $arguments;
        if ($digits !== floor($digits) || abs($digits) > 8) {
            throw new InvalidArgumentException('Rounding digits must be an integer between -8 and 8.');
        }
        if (strtoupper($token) === 'ROUND') {
            return round($value, (int) $digits, PHP_ROUND_HALF_UP);
        }
        $factor = 10 ** (int) $digits;

        return ($value < 0 ? -1 : 1) * ceil(abs($value) * $factor) / $factor;
    }

    private function peek(): ?string
    {
        return $this->tokens[$this->position] ?? null;
    }

    private function expect(string $token): void
    {
        if ($this->peek() !== $token) {
            throw new InvalidArgumentException("Expected {$token}.");
        }
        $this->position++;
    }
}
