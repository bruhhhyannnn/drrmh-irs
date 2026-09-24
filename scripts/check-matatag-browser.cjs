/* Optional UI verification. Set PLAYWRIGHT_MODULE and BROWSER_PATH if using a bundled runtime. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
  });
  try {
    fs.mkdirSync('tmp', { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      ...(process.env.MATATAG_STORAGE_STATE ? { storageState: process.env.MATATAG_STORAGE_STATE } : {}),
    });
    const page = await context.newPage();
    // Reproduce browsers that expose getRandomValues but not randomUUID.
    await page.addInitScript(() => {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: undefined,
        configurable: true,
      });
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto(`${process.env.MATATAG_BASE_URL || 'http://localhost:3000'}/matatag`);
    if (!process.env.MATATAG_STORAGE_STATE) {
      await page.getByRole('heading', { name: 'Welcome', exact: true }).waitFor();
      await page.goto(
        `${process.env.MATATAG_BASE_URL || 'http://localhost:3000'}/matatag/assessments`
      );
      await page.getByRole('heading', { name: 'Welcome', exact: true }).waitFor();
      assert.deepEqual(errors, []);
      console.log('PASS: unauthenticated MATATAG and records routes redirect to sign-in.');
      return;
    }
    await page.getByRole('heading', { name: 'Assessment details', exact: true }).waitFor();
    await page.getByLabel('Name of building(s)').fill('Browser verification building');
    await page.getByLabel('Number of floors').fill('3');
    await page.screenshot({ path: 'tmp/matatag-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Start checklist', exact: true }).click();
    await page.locator('input[name="I-1"][value="YES"]').check();
    await page.locator('input[name="I-2"][value="NO"]').check();
    await page
      .getByRole('textbox', { name: 'Remarks' })
      .first()
      .fill('Checked during the building walkthrough.');
    await page.reload();
    await page.getByRole('heading', { name: 'Assessment details', exact: true }).waitFor();
    assert.equal(
      await page.getByLabel('Name of building(s)').inputValue(),
      'Browser verification building'
    );
    await page.getByRole('button', { name: 'Start checklist', exact: true }).click();
    assert.equal(await page.locator('input[name="I-1"][value="YES"]').isChecked(), true);
    assert.equal(await page.locator('input[name="I-2"][value="NO"]').isChecked(), true);
    await page.getByRole('checkbox', { name: 'This section is not applicable' }).check();
    await page.getByRole('heading', { name: 'Section marked N/A' }).waitFor();
    await page.getByRole('checkbox', { name: 'This section is not applicable' }).uncheck();
    assert.equal(await page.locator('input[name="I-2"][value="NO"]').isChecked(), true);
    await page.screenshot({ path: 'tmp/matatag-questions.png', fullPage: false });
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const download = await downloaded;
    const draft = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    assert.match(draft.id, uuidV4);
    assert.equal(draft.document.answers['I-2'], 'NO');
    assert.equal(draft.document.remarks['I-1'], 'Checked during the building walkthrough.');
    await page.getByRole('button', { name: 'Review & finish', exact: true }).click();
    assert.equal(
      await page.getByRole('button', { name: 'Complete & save assessment' }).isDisabled(),
      true
    );
    assert.equal(await page.locator('main tbody tr').count(), 17);
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `No horizontal overflow at ${width}px`
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const sectionTrigger = page.getByRole('button', { name: 'Assessment sections', exact: true });
    await sectionTrigger.click();
    await page.getByRole('dialog', { name: 'Assessment sections', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await sectionTrigger.getAttribute('aria-expanded'), 'false');
    await sectionTrigger.click();
    const sectionDialog = page.getByRole('dialog', { name: 'Assessment sections', exact: true });
    await sectionDialog.getByRole('button', { name: 'Assessment details', exact: true }).click();
    assert.equal(await sectionTrigger.getAttribute('aria-expanded'), 'false');
    await page.screenshot({ path: 'tmp/matatag-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Start a new assessment', exact: true }).click();
    const newId = await page.evaluate(
      () => {
        const key = Object.keys(localStorage).find((candidate) => candidate.startsWith('matatag-v1:') && candidate.endsWith(':default:new'));
        return key ? JSON.parse(localStorage.getItem(key)).id : null;
      }
    );
    assert.match(newId, uuidV4);
    assert.notEqual(newId, draft.id);
    assert.equal(await page.getByLabel('Name of building(s)').inputValue(), '');
    await page.getByLabel('Import a MATATAG draft', { exact: true }).setInputFiles({
      name: 'draft.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(draft)),
    });
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('input')).some(
        (input) => input.value === 'Browser verification building'
      )
    );
    assert.equal(
      await page.getByLabel('Name of building(s)').inputValue(),
      'Browser verification building'
    );
    await page.getByLabel('Import a MATATAG draft', { exact: true }).setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"document":{}}'),
    });
    await page.getByText('This file is not a valid MATATAG draft').waitFor();
    assert.equal(
      await page.getByLabel('Name of building(s)').inputValue(),
      'Browser verification building'
    );
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('article h2').count(), 18);
    assert.equal(await page.locator('article').isVisible(), true);
    assert.equal(await page.locator('main').isVisible(), false);
    await page.setViewportSize({ width: 900, height: 1100 });
    await page.screenshot({ path: 'tmp/matatag-print.png' });
    await page.emulateMedia({ media: 'screen' });
    await page.goto(
      `${process.env.MATATAG_BASE_URL || 'http://localhost:3000'}/matatag/assessments`
    );
    await page.getByRole('heading', { name: 'Shared MATATAG records', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      'PASS: authenticated navigation, answer persistence, remarks, N/A restoration, JSON import/export, invalid import, 17-section review, print coverage, mobile/tablet overflow, and shared records.'
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
