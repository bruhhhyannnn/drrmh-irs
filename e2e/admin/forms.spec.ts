import { hasAdminLogin, NO_ADMIN_LOGIN } from '../support/admin';
import { expect, test } from '../support/test';

test.skip(!hasAdminLogin(), NO_ADMIN_LOGIN);

test('Add event checks its fields and Cancel closes it', async ({ page, writes }) => {
  await page.goto('/events');
  await page.getByRole('button', { name: 'Add event' }).click();

  const drawer = page.getByRole('dialog', { name: 'Add event' });
  await drawer.getByRole('button', { name: 'Create event' }).click();
  await expect(drawer.getByText('Enter an event name.')).toBeVisible();

  await drawer.getByRole('button', { name: 'Cancel' }).click();
  await expect(drawer).toBeHidden();
  expect(writes.blocked).toEqual([]);
});

test('Settings switches between its lists', async ({ page }) => {
  await page.goto('/settings');

  const tabs = page.getByRole('navigation', { name: 'Settings' });
  for (const [name, path, add] of [
    ['Units', '/settings/units', 'Add unit'],
    ['Positions', '/settings/positions', 'Add position'],
    ['Clusters', '/settings/clusters', 'Add cluster'],
  ]) {
    await tabs.getByRole('link', { name }).click();
    await expect(page).toHaveURL((url) => url.pathname === path);
    await expect(tabs.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: add })).toBeVisible();
  }
});

test('the theme set in My profile stays after a reload', async ({ page, writes }) => {
  await page.goto('/dashboard');
  const html = page.locator('html');

  await page.getByRole('button', { name: /^My profile:/ }).click();
  const profile = page.getByRole('dialog', { name: 'My profile' });
  await profile.locator('label', { hasText: 'Dark' }).click();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.getByRole('button', { name: /^My profile:/ }).click();
  await profile.locator('label', { hasText: 'Light' }).click();
  await expect(html).not.toHaveClass(/\bdark\b/);
  expect(writes.blocked).toEqual([]);
});
