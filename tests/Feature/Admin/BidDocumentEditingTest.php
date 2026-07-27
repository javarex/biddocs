<?php

namespace Tests\Feature\Admin;

use App\Models\BidDocumentVersion;
use App\Models\Project;
use App\Models\User;
use App\Services\BidDocumentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use ZipArchive;

class BidDocumentEditingTest extends TestCase
{
    use RefreshDatabase;

    private string $template;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->template = tempnam(sys_get_temp_dir(), 'bid-doc-template-').'.docx';
        $archive = new ZipArchive;
        $archive->open($this->template, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $archive->addFromString('[Content_Types].xml', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="xml" ContentType="application/xml"/>
</Types>
XML);
        $archive->addFromString('word/document.xml', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">
    <w:body>
        <w:p w14:paraId="12345678"><w:r><w:t>Original editable text</w:t></w:r></w:p>
        <w:p w14:paraId="87654321">
            <w:pPr><w:pStyle w:val="TOC1"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9000"/></w:tabs></w:pPr>
            <w:hyperlink w:anchor="_Toc1">
                <w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:b/></w:rPr><w:t>Original table entry</w:t></w:r>
                <w:r><w:tab/></w:r>
                <w:r><w:fldChar w:fldCharType="begin"/></w:r>
                <w:r><w:instrText xml:space="preserve"> PAGEREF _Toc1 </w:instrText></w:r>
                <w:r><w:fldChar w:fldCharType="separate"/></w:r>
                <w:r><w:t>2</w:t></w:r>
                <w:r><w:fldChar w:fldCharType="end"/></w:r>
            </w:hyperlink>
        </w:p>
        <w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>INVITATION TO BID FOR THE CONSTRUCTION OF 1 UNIT, 1-STOREY, 2 CLASSROOM SCHOOL BUILDING AT BUHI ELEMENTARY SCHOOL, BRGY. AMPAWID, LAAK, DAVAO DE ORO</w:t></w:r></w:p>
        <w:p/>
        <w:p><w:r><w:t>The Provincial Government of Davao de Oro, through the GAA 2026 Basic Education Facilities Program intends to apply the sum of Seven Million One Hundred Ninety-Four Thousand Five Hundred Nineteen Pesos and Forty-Nine Centavos Only (Php 7,194,519.49) being the Approved Budget for the Contract (ABC).</w:t></w:r></w:p>
        <w:p><w:r><w:t>The Provincial Government of Davao de Oro now invites bids for the above Procurement Project. Completion of the Works is required One Hundred Sixty (160) calendar days.</w:t></w:r></w:p>
        <w:p><w:r><w:t>The Project title is Construction of 1 Unit, 1-Storey, 2-Classroom School Building at Buhi Elementary School, Brgy. Ampawid, Laak, Davao de Oro (Construction of 2-classroom with toilet attached in each room and bundled school furniture)- PEO</w:t></w:r></w:p>
        <w:p><w:r><w:t>Section VI. Specifications</w:t></w:r></w:p>
        <w:p><w:r><w:t>Name of Project: Construction of 1 Unit, 1-Storey, 2-Classroom School Building at Buhi Elementary School, Brgy. Ampawid, Prk.1, Laak, Davao de Oro</w:t></w:r></w:p>
        <w:p><w:r><w:t>The identification number of the Contract is CW25-____.</w:t></w:r></w:p>
        <w:p><w:r><w:t>2.1 The GOP through the source of funding as indicated below for GAA 2026 Basic Education Facilities Program in the amount of Php 7,194,519.49.</w:t></w:r></w:p>
        <w:p><w:r><w:t>The ABC is Php 7,194,519.49. Any bid with a financial component exceeding this amount shall not be accepted.</w:t></w:r></w:p>
        <w:p><w:r><w:t>(Construction of 2-classroom with toile attached in each room and bundled school furniture)</w:t></w:r></w:p>
        <w:p><w:r><w:t>Civil Works No. CW25-______</w:t></w:r></w:p>
        <w:sectPr/>
    </w:body>
</w:document>
XML);
        $archive->close();

        config()->set('bid-documents.template', $this->template);
    }

    protected function tearDown(): void
    {
        if (isset($this->template) && is_file($this->template)) {
            unlink($this->template);
        }

        parent::tearDown();
    }

    public function test_super_admin_can_save_text_edits_into_the_downloadable_docx(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true, 'is_active' => true]);
        $project = $this->project();

        $response = $this->actingAs($admin)->put(route('admin.projects.bid-docs.update', $project), [
            'revision' => 0,
            'edits' => ['BDS_EDIT_1' => 'Directly edited bid document text'],
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success');
        $version = BidDocumentVersion::query()->sole();
        $this->assertSame(1, $version->revision);
        $this->assertSame($admin->id, $version->edited_by);
        Storage::disk('local')->assertExists($version->stored_path);

        $archive = new ZipArchive;
        $archive->open(Storage::disk('local')->path($version->stored_path));
        $xml = $archive->getFromName('word/document.xml');
        $archive->close();

        $this->assertIsString($xml);
        $this->assertStringContainsString('Directly edited bid document text', $xml);
        $this->assertStringContainsString('BDS_EDIT_1', $xml);
    }

    public function test_stale_revision_cannot_overwrite_a_saved_document(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true, 'is_active' => true]);
        $project = $this->project();

        $this->actingAs($admin)->put(route('admin.projects.bid-docs.update', $project), [
            'revision' => 0,
            'edits' => ['BDS_EDIT_1' => 'First edit'],
        ])->assertSessionHasNoErrors();

        $this->actingAs($admin)->put(route('admin.projects.bid-docs.update', $project), [
            'revision' => 0,
            'edits' => ['BDS_EDIT_1' => 'Stale edit'],
        ])->assertSessionHasErrors('document');

        $this->assertSame(1, BidDocumentVersion::query()->sole()->revision);
    }

    public function test_table_of_contents_edits_preserve_hyperlink_tab_and_page_number_runs(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true, 'is_active' => true]);
        $project = $this->project();

        $this->actingAs($admin)->put(route('admin.projects.bid-docs.update', $project), [
            'revision' => 0,
            'edits' => ['BDS_EDIT_2' => "Edited table entry\t24"],
        ])->assertSessionHasNoErrors();

        $version = BidDocumentVersion::query()->sole();
        $archive = new ZipArchive;
        $archive->open(Storage::disk('local')->path($version->stored_path));
        $xml = $archive->getFromName('word/document.xml');
        $archive->close();
        $document = new \DOMDocument;
        $document->loadXML((string) $xml);
        $xpath = new \DOMXPath($document);
        $xpath->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');
        $marker = $xpath->query('//w:bookmarkStart[@w:name="BDS_EDIT_2"]')->item(0);
        $paragraph = $marker?->parentNode;

        $this->assertNotNull($paragraph);
        $this->assertSame('Edited table entry', $xpath->query('.//w:t', $paragraph)->item(0)?->nodeValue);
        $this->assertSame('24', $xpath->query('.//w:t', $paragraph)->item(1)?->nodeValue);
        $this->assertSame(1, $xpath->query('.//w:tab[not(ancestor::w:pPr)]', $paragraph)->length);
        $this->assertSame(1, $xpath->query('.//w:hyperlink', $paragraph)->length);
        $this->assertSame(3, $xpath->query('.//w:fldChar', $paragraph)->length);
    }

    public function test_super_admin_can_reset_the_document_to_generated_data(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true, 'is_active' => true]);
        $project = $this->project();

        $this->actingAs($admin)->put(route('admin.projects.bid-docs.update', $project), [
            'revision' => 0,
            'edits' => ['BDS_EDIT_1' => 'Temporary edit'],
        ])->assertSessionHasNoErrors();
        $storedPath = BidDocumentVersion::query()->sole()->stored_path;

        $this->actingAs($admin)
            ->delete(route('admin.projects.bid-docs.destroy', $project))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertDatabaseCount('bid_document_versions', 0);
        Storage::disk('local')->assertMissing($storedPath);
    }

    public function test_generated_document_uses_the_project_code_and_description(): void
    {
        $project = $this->project();
        $path = app(BidDocumentService::class)->generate($project);

        $archive = new ZipArchive;
        $archive->open($path);
        $xml = $archive->getFromName('word/document.xml');
        $archive->close();
        unlink($path);

        $this->assertIsString($xml);
        $this->assertStringContainsString('CW26-001', $xml);
        $this->assertStringContainsString('Editable Project, Davao de Oro', $xml);
        $this->assertStringContainsString('Name of Project: Editable Project, Davao de Oro', $xml);
        $this->assertStringNotContainsString('Name of Project: Construction of 1 Unit', $xml);
        $this->assertStringContainsString('Construction of a new testing facility', $xml);
        $this->assertStringContainsString('(Construction of a new testing facility)', $xml);
        $this->assertStringContainsString('AB CY 2026 – 20% DF', $xml);
        $this->assertStringContainsString('One Hundred Twenty (120) calendar days', $xml);
        $this->assertStringContainsString('The required completion period is One Hundred Twenty (120) calendar days.', $xml);
        $this->assertStringContainsString('The ABC is Php 0.00.', $xml);
        $this->assertStringNotContainsString('CW25-______', $xml);
        $this->assertStringNotContainsString('Construction of 2-classroom', $xml);
        $this->assertStringNotContainsString('GAA 2026 Basic Education Facilities Program', $xml);
    }

    public function test_normal_users_cannot_save_or_reset_direct_document_edits(): void
    {
        $user = User::factory()->create(['is_super_admin' => false, 'is_active' => true]);
        $project = $this->project();

        $this->actingAs($user)->put(route('admin.projects.bid-docs.update', $project), [
            'revision' => 0,
            'edits' => ['BDS_EDIT_1' => 'Unauthorized edit'],
        ])->assertForbidden();
        $this->actingAs($user)
            ->delete(route('admin.projects.bid-docs.destroy', $project))
            ->assertForbidden();
    }

    private function project(): Project
    {
        return Project::query()->create([
            'project_code' => 'CW26-001',
            'project_name' => 'Editable Project',
            'project_description' => 'Construction of a new testing facility',
            'source_of_funds' => 'AB CY 2026 – 20% DF',
            'location' => 'Davao de Oro',
            'contract_duration' => 120,
        ]);
    }
}
