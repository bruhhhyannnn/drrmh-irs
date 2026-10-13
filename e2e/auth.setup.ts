import { ADMIN_STATE, adminLogin, hasAdminLogin, NO_ADMIN_LOGIN } from './support/admin';
import { expect, test as setup } from './support/test';

// Signs in once per run and saves the session for the admin tests.
setup('sign in as the test admin', async ({ page }) => {
  setup.skip(!hasAdminLogin(), NO_ADMIN_LOGIN);
  const { email, password } = adminLogin();

  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL((url) => url.pathname === '/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});
