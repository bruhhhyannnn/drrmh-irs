import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

// The anonymous bystander form, against the real lookup lists (incident types, campuses,
// clusters). Sending is never let through: a report either goes to the offline queue in
// IndexedDB, or its createBystanderReport call is stopped by the write guard.

const UP_MANILA = { latitude: 14.5779, longitude: 120.9846 };

/** Step 1 with the first incident type, campus and cluster; the location comes from the device. */
async function fillWhatAndWhere(page: Page) {
  const firstType = page
    .getByRole('radiogroup', { name: 'Incident type' })
    .locator('label')
    .first();
  await expect(firstType, 'incident types load from the database; is it reachable?').toBeVisible();
  await firstType.click();

  const campus = page.getByLabel('Campus');
  await expect(campus.locator('option').nth(1)).toBeAttached();
  await campus.selectOption({ index: 1 });

  await expect(page.getByText('Pinned', { exact: true })).toBeVisible();

  const cluster = page.getByLabel('Cluster');
  await expect(cluster.locator('option').nth(1)).toBeAttached();
  await cluster.selectOption({ index: 1 });

  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Step 2 is optional; skip straight to the review. */
async function skipToReview(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'Who is affected and what is damaged' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('heading', { name: 'Review and send' })).toBeVisible();
}

/** How many bystander reports wait in this browser's offline queue. */
function queuedReports(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('irs-offline-queue');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const count = open.result
            .transaction('bystander-reports')
            .objectStore('bystander-reports')
            .count();
          count.onerror = () => reject(count.error);
          count.onsuccess = () => resolve(count.result);
        };
      })
  );
}

test.describe('without the device location', () => {
  test('step 1 says what is still needed', async ({ page }) => {
    await page.goto('/bystander-report');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Choose the type of incident')).toBeVisible();
    await expect(page.getByText('Pin the location on the map, or use your location')).toBeVisible();
    await expect(page.getByText('Choose a cluster')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What happened and where' })).toBeVisible();
  });
});

test.describe('with the device location', () => {
  test.use({ geolocation: UP_MANILA, permissions: ['geolocation'] });

  test.beforeEach(async ({ page }) => {
    await page.goto('/bystander-report');
    await fillWhatAndWhere(page);
    await skipToReview(page);
  });

  test('a report made offline is saved on the device', async ({ page, context, writes }) => {
    await context.setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: "You're offline." })).toBeVisible();

    await page.getByRole('button', { name: 'Save report to send later' }).click();

    await expect(page.getByRole('heading', { name: 'Report saved offline' })).toBeVisible();
    expect(await queuedReports(page)).toBe(1);
    expect(writes.blocked).toEqual([]);
  });

  test('a report whose connection drops while sending is kept', async ({ page, writes }) => {
    await page.getByRole('button', { name: 'Submit emergency report' }).click();

    await expect(page.getByRole('heading', { name: 'Report saved offline' })).toBeVisible();
    expect(writes.blocked).toContain('createBystanderReport');
    expect(await queuedReports(page)).toBe(1);
  });

  test('checks the contact number before sending', async ({ page, writes }) => {
    await page.getByLabel(/Contact number/).fill('555 0100');
    await page.getByRole('button', { name: 'Submit emergency report' }).click();

    await expect(page.getByText('Enter a Philippine number, e.g. 917 123 4567')).toBeVisible();
    expect(writes.blocked).toEqual([]);
  });
});
