import { hasAdminLogin, NO_ADMIN_LOGIN } from '../support/admin';
import { expect, test } from '../support/test';

test.skip(!hasAdminLogin(), NO_ADMIN_LOGIN);

test('the sidebar opens every admin page', async ({ page, writes }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

  const sidebar = page.getByRole('navigation', { name: 'Main' });
  for (const name of ['Events', 'Reports', 'Bystander reports', 'Users', 'Settings', 'Dashboard']) {
    await sidebar.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  }
  expect(writes.blocked).toEqual([]);
});

test('a signed-in admin skips the sign-in page', async ({ page }) => {
  await page.goto('/signin');

  await expect(page).toHaveURL((url) => url.pathname === '/dashboard');
});

test('the DRRM pillars open in a new tab', async ({ page, context }) => {
  await page.goto('/dashboard');

  const [pillar] = await Promise.all([
    context.waitForEvent('page'),
    page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Prevention' })
      .click(),
  ]);

  await expect(pillar).toHaveURL((url) => url.pathname === '/pillars/prevention-mitigation');
  await expect(
    pillar.getByRole('heading', { level: 1, name: 'Disaster Prevention and Mitigation' })
  ).toBeVisible();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the bottom tabs switch pages', async ({ page }) => {
    await page.goto('/dashboard');

    const tabs = page.getByRole('navigation', { name: 'Main' });
    await tabs.getByRole('link', { name: 'Events' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Events' })).toBeVisible();

    await tabs.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  });
});
