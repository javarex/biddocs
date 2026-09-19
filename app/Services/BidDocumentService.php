<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectItem;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use Illuminate\Support\Str;
use NumberFormatter;
use RuntimeException;
use ZipArchive;

class BidDocumentService
{
    private const WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    private const EDIT_BOOKMARK_PREFIX = 'BDS_EDIT_';

    public function __construct(private readonly DupaEstimateService $estimates) {}

    public function generate(Project $project): string
    {
        $template = (string) config('bid-documents.template');
        if (! str_starts_with($template, DIRECTORY_SEPARATOR) && ! preg_match('/^[A-Za-z]:[\\\\\/]/', $template)) {
            $template = base_path($template);
        }
        if (! is_file($template) || ! is_readable($template)) {
            throw new RuntimeException('The bid document template is unavailable.');
        }

        $project->load([
            'sections' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.projectItems' => fn ($query) => $query->whereNull('sub_section_id')->orderBy('sort_order')->orderBy('id'),
            'sections.projectItems.estimates',
            'sections.subSections' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.subSections.projectItems' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.subSections.projectItems.estimates',
        ]);

        $temporary = tempnam(storage_path('app/private'), 'bid-doc-');
        if ($temporary === false) {
            throw new RuntimeException('Unable to create the generated bid document.');
        }
        $output = $temporary.'.docx';
        rename($temporary, $output);
        if (! copy($template, $output)) {
            throw new RuntimeException('Unable to copy the bid document template.');
        }

        $archive = new ZipArchive;
        if ($archive->open($output) !== true) {
            throw new RuntimeException('Unable to open the generated bid document.');
        }

        try {
            $xmlEntries = [];
            for ($index = 0; $index < $archive->numFiles; $index++) {
                $name = $archive->getNameIndex($index);
                if (is_string($name) && preg_match('#^word/(document|header\d+|footer\d+)\.xml$#', $name)) {
                    $xmlEntries[] = $name;
                }
            }

            foreach ($xmlEntries as $name) {
                $xml = $archive->getFromName($name);
                if (! is_string($xml)) {
                    continue;
                }

                $document = $this->loadXml($xml);
                $this->replaceProjectContent($document, $project);
                if ($name === 'word/document.xml') {
                    $this->replaceBillOfQuantities($document, $project);
                    $this->addEditableMarkers($document);
                }
                $archive->addFromString($name, $document->saveXML() ?: $xml);
            }
        } finally {
            $archive->close();
        }

        return $output;
    }

    /**
     * @param  array<string, string>  $edits
     */
    public function applyTextEdits(Project $project, array $edits, ?string $source = null): string
    {
        $output = $source !== null && is_file($source)
            ? $this->copyToTemporaryDocument($source)
            : $this->generate($project);

        $archive = new ZipArchive;
        if ($archive->open($output) !== true) {
            throw new RuntimeException('Unable to open the editable bid document.');
        }

        try {
            $xml = $archive->getFromName('word/document.xml');
            if (! is_string($xml)) {
                throw new RuntimeException('The bid document body is unavailable.');
            }

            $document = $this->loadXml($xml);
            $this->repairFlattenedTableOfContents($document);
            $updated = $this->applyEditableParagraphs($document, $edits);
            if ($updated !== count($edits)) {
                throw new RuntimeException('The bid document changed before these edits could be saved. Reload it and try again.');
            }

            $archive->addFromString('word/document.xml', $document->saveXML() ?: $xml);
        } finally {
            $archive->close();
        }

        return $output;
    }

    private function copyToTemporaryDocument(string $source): string
    {
        $temporary = tempnam(storage_path('app/private'), 'bid-doc-edit-');
        if ($temporary === false) {
            throw new RuntimeException('Unable to create the edited bid document.');
        }

        $output = $temporary.'.docx';
        rename($temporary, $output);
        if (! copy($source, $output)) {
            throw new RuntimeException('Unable to copy the editable bid document.');
        }

        return $output;
    }

    private function loadXml(string $xml): DOMDocument
    {
        $document = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        $loaded = $document->loadXML($xml, LIBXML_NONET | LIBXML_COMPACT);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if (! $loaded) {
            throw new RuntimeException('The bid document XML could not be parsed.');
        }

        return $document;
    }

    private function replaceProjectContent(DOMDocument $document, Project $project): void
    {
        $xpath = $this->xpath($document);
        $totals = $this->estimates->projectTotals($project);
        $total = $totals['ADD']['grand_total'] + $totals['NON_ADD']['grand_total'];
        $durationWords = $this->numberWords($project->contract_duration);
        $amountWords = $this->currencyWords($total);
        $projectTitle = $this->projectTitle($project);
        $description = trim((string) $project->project_description);
        $sourceOfFunds = trim((string) $project->source_of_funds);

        foreach ($xpath->query('//w:p') ?: [] as $paragraph) {
            if (! $paragraph instanceof DOMElement) {
                continue;
            }
            $text = $this->nodeText($xpath, $paragraph);
            if ($text === '') {
                continue;
            }

            if (preg_match('/^Name\s+of\s+Project\s*:/i', $text) === 1) {
                $this->setNodeText($xpath, $paragraph, 'Name of Project: '.$projectTitle);

                continue;
            }

            $updated = preg_replace(
                '/Construction of\s*1\s*Unit,?\s*1-Storey,?\s*2[\s-]*Classroom\s*School\s*Building\s*at\s*Buhi\s*Elementary\s*School,?\s*Brgy\s*\.?\s*Ampawid\s*,?\s*Laak\s*,?\s*Davao\s*de\s*Oro/i',
                $projectTitle,
                preg_replace('/\s+/u', ' ', trim($text)) ?? $text,
            ) ?? $text;
            $updated = preg_replace(
                '/Prk\s*\.?\s*1\s*,?\s*(?:Brgy\s*\.?\s*)?Ampawid\s*,?\s*Laak\s*,?\s*Davao\s*de\s*Oro/i',
                $project->location,
                $updated,
            ) ?? $updated;
            $updated = preg_replace(
                '/One\s+Hundred\s+Six\s*ty\s*\(\s*16\s*0\s*\)/i',
                "{$durationWords} ({$project->contract_duration})",
                $updated,
            ) ?? $updated;
            $updated = preg_replace('/CW\d{2}-\s*(?:_+|\d{3})?/i', trim((string) $project->project_code), $updated) ?? $updated;
            $updated = $this->replaceProjectDescription($updated, $description);
            if (preg_match('/^The\s+Project\s+title\s+is\b/i', $text) === 1
                && ! Str::contains(Str::lower($updated), 'required completion period')) {
                $updated = rtrim($updated)." The required completion period is {$durationWords} ({$project->contract_duration}) calendar days.";
            }
            if ($sourceOfFunds !== '') {
                $updated = preg_replace(
                    '/through\s+the\s+.+?\s+intends\s+to\s+apply\s+the\s+sum\s+of/i',
                    'through the '.$sourceOfFunds.' intends to apply the sum of',
                    $updated,
                ) ?? $updated;
                $updated = preg_replace(
                    '/(source\s+of\s+funding\s+as\s+indicated\s+below\s+for)\s+.+?\s+(in\s+the\s+amount\s+of)/i',
                    '$1 '.$sourceOfFunds.' $2',
                    $updated,
                ) ?? $updated;
            }
            $updated = preg_replace('/7\s*,\s*194\s*,\s*519\.49/', number_format($total, 2), $updated) ?? $updated;
            $updated = preg_replace(
                '/Seven\s+Million\s+One\s+Hundred\s+Ninety-Four\s+Thousand\s+Five\s+Hundred\s+Nineteen\s+Pesos\s+and\s+Forty-Nine\s+Centavos\s+Only/i',
                $amountWords,
                $updated,
            ) ?? $updated;

            if ($updated !== $text) {
                $this->setNodeText($xpath, $paragraph, $updated);
            }

        }
    }

    private function replaceProjectDescription(string $text, string $description): string
    {
        $pattern = 'Construction\s+(?:of\s+)?2[\s-]*classroom\s+with\s+toilet?\s+attached\s+in\s+each\s+room\s+and\s+bundled\s+school(?:\s+furnitures?)?';

        if ($description === '') {
            $updated = preg_replace('/\s*\(\s*'.$pattern.'\s*\)/i', '', $text) ?? $text;

            return preg_replace('/'.$pattern.'/i', '', $updated) ?? $updated;
        }

        $updated = preg_replace('/\s*\(\s*'.$pattern.'\s*\)/i', ' '.$description, $text) ?? $text;

        return preg_replace('/'.$pattern.'/i', $description, $updated) ?? $updated;
    }

    private function projectTitle(Project $project): string
    {
        $name = trim($project->project_name);
        $location = trim($project->location);

        if ($location === '' || Str::contains(Str::lower($name), Str::lower($location))) {
            return $name;
        }

        return $name.', '.$location;
    }

    private function replaceBillOfQuantities(DOMDocument $document, Project $project): void
    {
        $xpath = $this->xpath($document);
        foreach ($xpath->query('//w:tbl') ?: [] as $table) {
            if (! $table instanceof DOMElement || ! Str::contains($this->nodeText($xpath, $table), 'BILL OF QUANTITIES')) {
                continue;
            }

            $rows = iterator_to_array($xpath->query('./w:tr', $table) ?: []);
            $header = null;
            $total = null;
            $sectionTemplate = null;
            $itemTemplate = null;

            foreach ($rows as $row) {
                if (! $row instanceof DOMElement) {
                    continue;
                }
                $cells = $xpath->query('./w:tc', $row);
                if ($cells === false) {
                    continue;
                }
                $text = $this->nodeText($xpath, $row);
                if ($cells->length === 6 && Str::contains($text, 'Item No.')) {
                    $header = $row;
                } elseif ($cells->length === 1 && Str::startsWith(trim($text), 'TOTAL BID AMOUNT')) {
                    $total = $row;
                } elseif ($header !== null && $total === null && $cells->length === 1 && $sectionTemplate === null) {
                    $sectionTemplate = $row;
                } elseif ($header !== null && $total === null && $cells->length === 6 && $itemTemplate === null) {
                    $itemTemplate = $row;
                }
            }

            if (! $header instanceof DOMElement || ! $total instanceof DOMElement || ! $sectionTemplate instanceof DOMElement || ! $itemTemplate instanceof DOMElement) {
                return;
            }

            $removing = false;
            foreach ($rows as $row) {
                if ($row === $header) {
                    $removing = true;

                    continue;
                }
                if ($row === $total) {
                    break;
                }
                if ($removing && $row instanceof DOMNode) {
                    $table->removeChild($row);
                }
            }

            foreach ($project->sections as $section) {
                $this->insertSectionRow($document, $xpath, $table, $total, $sectionTemplate, $section->section);
                foreach ($section->projectItems as $item) {
                    $this->insertEstimateRows($document, $xpath, $table, $total, $itemTemplate, $item);
                }
                foreach ($section->subSections as $subSection) {
                    if (Str::lower(trim($subSection->sub_section)) !== 'imported items') {
                        $this->insertSectionRow($document, $xpath, $table, $total, $sectionTemplate, $subSection->sub_section);
                    }
                    foreach ($subSection->projectItems as $item) {
                        $this->insertEstimateRows($document, $xpath, $table, $total, $itemTemplate, $item);
                    }
                }
            }

            $projectTotals = $this->estimates->projectTotals($project);
            $chargeRows = [
                'POL' => 'pol_amount',
                'Pre-engineering' => 'pre_engineering_amount',
                'Supervision' => 'supervision_amount',
                'Contingencies' => 'contingencies_amount',
                'Miscellaneous' => 'miscellaneous_amount',
            ];
            $hasCharges = collect($projectTotals)->contains(fn (array $side) => $side['charges_total'] > 0);
            if ($hasCharges) {
                $this->insertSectionRow($document, $xpath, $table, $total, $sectionTemplate, 'PROJECT-LEVEL CHARGES');
                foreach (['ADD', 'NON_ADD'] as $type) {
                    foreach ($chargeRows as $label => $key) {
                        $amount = (float) $projectTotals[$type][$key];
                        if ($amount > 0) {
                            $this->insertValuesRow($document, $xpath, $table, $total, $itemTemplate, [
                                $type === 'ADD' ? 'CHG-A' : 'CHG-N',
                                $label.' ('.str_replace('_', '-', $type).')',
                                'l.s.', '1.00', number_format($amount, 2), number_format($amount, 2),
                            ]);
                        }
                    }
                }
            }

            $totalValue = $projectTotals['ADD']['grand_total'] + $projectTotals['NON_ADD']['grand_total'];
            $this->setNodeText($xpath, $total, 'TOTAL BID AMOUNT (PHP) '.number_format($totalValue, 2));
            $next = $total->nextSibling;
            while ($next !== null && ! $next instanceof DOMElement) {
                $next = $next->nextSibling;
            }
            if ($next instanceof DOMElement) {
                $this->setNodeText($xpath, $next, 'AMOUNT IN WORDS: '.$this->currencyWords($totalValue));
            }

            return;
        }
    }

    private function insertSectionRow(DOMDocument $document, DOMXPath $xpath, DOMElement $table, DOMElement $before, DOMElement $template, string $label): void
    {
        $row = $document->importNode($template->cloneNode(true), true);
        if ($row instanceof DOMElement) {
            $this->setNodeText($xpath, $row, $label);
            $table->insertBefore($row, $before);
        }
    }

    private function insertEstimateRows(DOMDocument $document, DOMXPath $xpath, DOMElement $table, DOMElement $before, DOMElement $template, ProjectItem $item): void
    {
        $estimates = $item->estimates->filter(fn ($estimate) => $estimate->quantity > 0 || $estimate->total_cost > 0)->values();
        if ($estimates->isEmpty()) {
            $this->insertValuesRow($document, $xpath, $table, $before, $template, [
                $item->pay_item_no, $item->description, $item->unit, '0.00', '0.00', '0.00',
            ]);

            return;
        }

        $showType = $estimates->count() > 1;
        foreach ($estimates as $estimate) {
            $this->insertValuesRow($document, $xpath, $table, $before, $template, [
                $item->pay_item_no.($showType ? ' ('.str_replace('_', '-', $estimate->estimate_type).')' : ''),
                $item->description,
                $item->unit,
                number_format($estimate->quantity, 2),
                number_format($estimate->unit_cost, 2),
                number_format($estimate->total_cost, 2),
            ]);
        }
    }

    /** @param list<string> $values */
    private function insertValuesRow(DOMDocument $document, DOMXPath $xpath, DOMElement $table, DOMElement $before, DOMElement $template, array $values): void
    {
        $row = $document->importNode($template->cloneNode(true), true);
        if (! $row instanceof DOMElement) {
            return;
        }
        $cells = $xpath->query('./w:tc', $row);
        if ($cells === false) {
            return;
        }
        foreach ($values as $index => $value) {
            $cell = $cells->item($index);
            if ($cell instanceof DOMElement) {
                $this->setNodeText($xpath, $cell, $value);
            }
        }
        $table->insertBefore($row, $before);
    }

    private function addEditableMarkers(DOMDocument $document): void
    {
        $xpath = $this->xpath($document);
        $paragraphs = iterator_to_array($xpath->query('//w:p[.//w:t]') ?: []);
        $bookmarkId = 0;

        foreach ($xpath->query('//w:bookmarkStart/@w:id') ?: [] as $id) {
            $bookmarkId = max($bookmarkId, (int) $id->nodeValue);
        }

        foreach ($paragraphs as $index => $paragraph) {
            if (! $paragraph instanceof DOMElement) {
                continue;
            }

            $id = (string) ++$bookmarkId;
            $name = self::EDIT_BOOKMARK_PREFIX.($index + 1);
            $start = $document->createElementNS(self::WORD_NAMESPACE, 'w:bookmarkStart');
            $start->setAttributeNS(self::WORD_NAMESPACE, 'w:id', $id);
            $start->setAttributeNS(self::WORD_NAMESPACE, 'w:name', $name);
            $end = $document->createElementNS(self::WORD_NAMESPACE, 'w:bookmarkEnd');
            $end->setAttributeNS(self::WORD_NAMESPACE, 'w:id', $id);

            $firstContent = $paragraph->firstChild;
            while ($firstContent !== null
                && (! $firstContent instanceof DOMElement || $firstContent->namespaceURI !== self::WORD_NAMESPACE || $firstContent->localName === 'pPr')) {
                $firstContent = $firstContent->nextSibling;
            }

            if ($firstContent !== null) {
                $paragraph->insertBefore($start, $firstContent);
            } else {
                $paragraph->appendChild($start);
            }
            $paragraph->appendChild($end);
        }
    }

    /**
     * @param  array<string, string>  $edits
     */
    private function applyEditableParagraphs(DOMDocument $document, array $edits): int
    {
        $xpath = $this->xpath($document);
        $updated = 0;

        foreach ($edits as $bookmark => $value) {
            $query = sprintf(
                '//w:bookmarkStart[@w:name="%s"]',
                $bookmark,
            );
            $markers = $xpath->query($query);
            if ($markers === false) {
                continue;
            }
            $marker = $markers->item(0);
            $paragraph = $marker?->parentNode;

            if (! $paragraph instanceof DOMElement || $paragraph->localName !== 'p') {
                continue;
            }

            $this->setEditableParagraphText($xpath, $paragraph, $value);
            $updated++;
        }

        return $updated;
    }

    private function setEditableParagraphText(DOMXPath $xpath, DOMElement $paragraph, string $value): void
    {
        $groups = $this->paragraphTextGroups($xpath, $paragraph);

        if (count($groups) === 1) {
            $this->setTextNodesPreservingRuns($groups[0], $value);

            return;
        }

        $normalized = str_replace(["\u{2002}", "\u{2003}"], "\t", $value);
        $values = explode("\t", $normalized);

        if (count($values) !== count($groups)) {
            throw new RuntimeException('Tabs and table-of-contents leaders cannot be removed. Reload the document and edit only its text.');
        }

        foreach ($groups as $index => $nodes) {
            $this->setTextNodesPreservingRuns($nodes, $values[$index]);
        }
    }

    /**
     * @return array<int, array<int, DOMNode>>
     */
    private function paragraphTextGroups(DOMXPath $xpath, DOMElement $paragraph): array
    {
        $groups = [[]];
        $group = 0;

        foreach ($xpath->query('.//w:t | .//w:tab[not(ancestor::w:pPr)]', $paragraph) ?: [] as $node) {
            if ($node instanceof DOMElement && $node->localName === 'tab') {
                $group++;
                $groups[$group] = [];

                continue;
            }

            if ($node instanceof DOMNode && $node->localName === 't') {
                $groups[$group][] = $node;
            }
        }

        return $groups;
    }

    /**
     * @param  array<int, DOMNode>  $textNodes
     */
    private function setTextNodesPreservingRuns(array $textNodes, string $value): void
    {
        if ($textNodes === []) {
            if ($value !== '') {
                throw new RuntimeException('This part of the Word document cannot be edited without changing its structure.');
            }

            return;
        }

        $original = implode('', array_map(fn (DOMNode $node): string => $node->nodeValue ?? '', $textNodes));
        if ($original === $value) {
            return;
        }

        $originalLength = mb_strlen($original);
        $valueLength = mb_strlen($value);
        $prefix = 0;

        while ($prefix < $originalLength
            && $prefix < $valueLength
            && mb_substr($original, $prefix, 1) === mb_substr($value, $prefix, 1)) {
            $prefix++;
        }

        $suffix = 0;
        while ($suffix < $originalLength - $prefix
            && $suffix < $valueLength - $prefix
            && mb_substr($original, $originalLength - $suffix - 1, 1) === mb_substr($value, $valueLength - $suffix - 1, 1)) {
            $suffix++;
        }

        $changeEnd = $originalLength - $suffix;
        $replacement = mb_substr($value, $prefix, $valueLength - $prefix - $suffix);
        $offset = 0;
        $target = count($textNodes) - 1;

        foreach ($textNodes as $index => $textNode) {
            $length = mb_strlen($textNode->nodeValue ?? '');
            if ($prefix < $offset + $length || ($prefix === $offset && $length > 0)) {
                $target = $index;

                break;
            }
            $offset += $length;
        }

        $offset = 0;
        foreach ($textNodes as $index => $textNode) {
            $text = $textNode->nodeValue ?? '';
            $length = mb_strlen($text);
            $end = $offset + $length;
            $beforeLength = max(0, min($end, $prefix) - $offset);
            $afterStart = max($offset, $changeEnd);
            $updated = $beforeLength > 0 ? mb_substr($text, 0, $beforeLength) : '';

            if ($index === $target) {
                $updated .= $replacement;
            }
            if ($end > $afterStart) {
                $updated .= mb_substr($text, $afterStart - $offset);
            }

            $textNode->nodeValue = $updated;
            if ($textNode instanceof DOMElement) {
                $textNode->setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
            }
            $offset = $end;
        }
    }

    private function repairFlattenedTableOfContents(DOMDocument $document): void
    {
        $xpath = $this->xpath($document);

        foreach ($xpath->query('//w:p[w:pPr/w:pStyle[starts-with(@w:val, "TOC")]]') ?: [] as $paragraph) {
            if (! $paragraph instanceof DOMElement) {
                continue;
            }

            $groups = $this->paragraphTextGroups($xpath, $paragraph);
            if (count($groups) < 2) {
                continue;
            }

            $textNodes = array_merge(...$groups);
            $first = $textNodes[0] ?? null;
            if (! $first instanceof DOMNode || collect(array_slice($textNodes, 1))->contains(fn (DOMNode $node): bool => trim($node->nodeValue ?? '') !== '')) {
                continue;
            }

            $flattened = $first->nodeValue ?? '';
            $parts = preg_split('/[\x{00A0}\x{2002}\x{2003}\t]+/u', $flattened);
            if (! is_array($parts) || count($parts) !== count($groups)) {
                continue;
            }

            foreach ($groups as $index => $nodes) {
                $this->setTextNodesPreservingRuns($nodes, $parts[$index]);
            }
        }
    }

    private function xpath(DOMDocument $document): DOMXPath
    {
        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('w', self::WORD_NAMESPACE);

        return $xpath;
    }

    private function nodeText(DOMXPath $xpath, DOMNode $node): string
    {
        $parts = [];
        foreach ($xpath->query('.//w:t', $node) ?: [] as $textNode) {
            if ($textNode instanceof DOMNode) {
                $parts[] = $textNode->textContent;
            }
        }

        return trim(implode('', $parts));
    }

    private function setNodeText(DOMXPath $xpath, DOMNode $node, string $value): void
    {
        $textNodes = iterator_to_array($xpath->query('.//w:t', $node) ?: []);
        $first = array_shift($textNodes);
        if (! $first instanceof DOMNode) {
            return;
        }
        if ($first instanceof DOMElement) {
            while ($first->firstChild !== null) {
                $first->removeChild($first->firstChild);
            }
            $first->appendChild($first->ownerDocument->createTextNode($value));
            $first->setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
        } else {
            $first->nodeValue = $value;
        }
        foreach ($textNodes as $textNode) {
            $textNode->nodeValue = '';
        }
    }

    private function numberWords(int $number): string
    {
        $formatter = new NumberFormatter('en', NumberFormatter::SPELLOUT);

        return Str::title(str_replace('-', ' ', (string) $formatter->format($number)));
    }

    private function currencyWords(float $amount): string
    {
        $pesos = (int) floor($amount);
        $centavos = (int) round(($amount - $pesos) * 100);
        $words = $this->numberWords($pesos).' Pesos';
        if ($centavos > 0) {
            $words .= ' And '.$this->numberWords($centavos).' Centavos';
        }

        return $words.' Only';
    }
}
