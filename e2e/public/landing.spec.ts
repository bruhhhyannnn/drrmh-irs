import { expect, test } from '../support/test';

test('the landing page leads to the bystander report', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Incident reporting for UP Manila' })
  ).toBeVisible();

  await page.getByRole('link', { name: 'Report an emergency' }).first().click();

  await expect(page).toHaveURL((url) => url.pathname === '/bystander-report');
  await expect(page.getByRole('heading', { level: 1, name: 'Report an emergency' })).toBeVisible();
});

test('the landing page leads to sign-in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();

  await expect(page).toHaveURL((url) => url.pathname === '/signin');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('an unknown address shows the not found page', async ({ page }) => {
  const response = await page.goto('/no-such-page');

  expect(response?.status()).toBe(404);
  await expect(page.getByText('Page not found')).toBeVisible();
});
