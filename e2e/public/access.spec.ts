import { expect, test } from '../support/test';

// Signed out, the admin pages send you to sign-in and bring you back afterwards.
for (const path of ['/dashboard', '/events', '/settings/units']) {
  test(`${path} asks a signed-out visitor to sign in`, async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL(
      (url) => url.pathname === '/signin' && url.searchParams.get('from') === path
    );
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
}

test('the ERT report page asks a signed-out member to sign in', async ({ page }) => {
  await page.goto('/report');

  await expect(page).toHaveURL((url) => url.pathname === '/signin');
});
