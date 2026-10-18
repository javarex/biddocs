<?php

declare(strict_types=1);

if ($argc < 3 || $argc > 4) {
    fwrite(STDERR, "Usage: php generate_functional_requirements_docx.php INPUT.md OUTPUT.xml [SUBTITLE]\n");
    exit(1);
}

$source = file_get_contents($argv[1]);
if (! is_string($source)) {
    fwrite(STDERR, "Unable to read {$argv[1]}\n");
    exit(1);
}

function xml(string $value): string
{
    return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function plain(string $value): string
{
    return trim(str_replace(['`', '**'], '', $value));
}

function paragraph(string $text, string $style = 'Normal', bool $bold = false): string
{
    $runProperties = $bold ? '<w:rPr><w:b/></w:rPr>' : '';

    return '<w:p><w:pPr><w:pStyle w:val="'.$style.'"/></w:pPr><w:r>'.$runProperties
        .'<w:t xml:space="preserve">'.xml($text).'</w:t></w:r></w:p>';
}

/** @param list<array{0: string, 1: string}> $rows */
function table(array $rows, string $leftHeader = 'ID', string $rightHeader = 'Requirement', int $leftWidth = 1500): string
{
    $rightWidth = 9360 - $leftWidth;
    $cell = function (string $text, int $width, bool $header, bool $bold = false): string {
        $fill = $header ? '2E75B6' : 'EBF3FB';
        $style = $header ? 'TableHeader' : 'TableCell';
        $runProperties = $bold ? '<w:rPr><w:b/></w:rPr>' : '';

        return '<w:tc><w:tcPr><w:tcW w:w="'.$width.'" w:type="dxa"/>'
            .'<w:shd w:val="clear" w:color="auto" w:fill="'.$fill.'"/>'
            .'<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>'
            .'<w:bottom w:w="80" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar></w:tcPr>'
            .'<w:p><w:pPr><w:pStyle w:val="'.$style.'"/><w:spacing w:after="0"/>'
            .($header ? '' : '<w:jc w:val="both"/>').'</w:pPr><w:r>'.$runProperties
            .'<w:t xml:space="preserve">'.xml($text).'</w:t></w:r></w:p></w:tc>';
    };

    $table = '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblInd w:w="10" w:type="dxa"/>'
        .'<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
        .'<w:left w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
        .'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
        .'<w:right w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
        .'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
        .'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/></w:tblBorders>'
        .'<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>'
        .'</w:tblPr><w:tblGrid><w:gridCol w:w="'.$leftWidth.'"/><w:gridCol w:w="'.$rightWidth.'"/></w:tblGrid>'
        .'<w:tr><w:trPr><w:tblHeader/></w:trPr>'.$cell($leftHeader, $leftWidth, true).$cell($rightHeader, $rightWidth, true).'</w:tr>';

    foreach ($rows as [$left, $right]) {
        $table .= '<w:tr><w:trPr><w:cantSplit/></w:trPr>'.$cell($left, $leftWidth, false, true).$cell($right, $rightWidth, false).'</w:tr>';
    }

    return $table.'</w:tbl>';
}

$sections = [];
$current = null;
foreach (preg_split('/\R/', $source) ?: [] as $line) {
    if (preg_match('/^##\s+(\d+)\.\s+(.+)$/', $line, $matches) === 1) {
        $current = (int) $matches[1];
        $sections[$current] = ['title' => plain($matches[2]), 'lines' => []];
    } elseif ($current !== null) {
        $sections[$current]['lines'][] = $line;
    }
}

$subtitle = $argv[3] ?? 'BidDocs';
$body = paragraph('Functional Requirements', 'Heading1')
    .paragraph($subtitle, 'Meta')
    .paragraph('Date: '.date('Y-m-d'), 'Meta')
    .'<w:p/>';

foreach ($sections as $number => $section) {
    $body .= paragraph($number.'. '.$section['title'], 'Heading2');
    $requirements = [];
    foreach ($section['lines'] as $line) {
        if (preg_match('/^- \*\*(FR-[^*]+):\*\*\s+(.+)$/', $line, $matches) === 1) {
            $requirements[] = [plain($matches[1]), plain($matches[2])];
        }
    }

    if ($requirements !== []) {
        $body .= table($requirements);

        continue;
    }

    if ($number === 2) {
        $actors = [];
        foreach ($section['lines'] as $line) {
            if (preg_match('/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/', $line, $matches) !== 1) {
                continue;
            }
            if (in_array(trim($matches[1]), ['Actor', '---'], true) || str_starts_with(trim($matches[1]), '---')) {
                continue;
            }
            $actors[] = [plain($matches[1]), plain($matches[2])];
        }
        $body .= table($actors, 'Actor', 'Description', 1800);

        continue;
    }

    $paragraphs = [];
    foreach ($section['lines'] as $line) {
        $line = plain($line);
        if ($line !== '') {
            $paragraphs[] = $line;
        }
    }
    foreach ($paragraphs as $text) {
        $body .= paragraph($text);
    }
}

$document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    .'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    .'<w:body>'.$body
    .'<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/><w:cols w:space="720"/></w:sectPr>'
    .'</w:body></w:document>';

if (file_put_contents($argv[2], $document) === false) {
    fwrite(STDERR, "Unable to write {$argv[2]}\n");
    exit(1);
}
