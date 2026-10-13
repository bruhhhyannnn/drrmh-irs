import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/signin');
});

async function enterEmail(page: Page, email: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

test('checks the email before asking for the password', async ({ page }) => {
  await enterEmail(page, 'not-an-email');
  await expect(page.getByText('Invalid email address')).toBeVisible();

  await enterEmail(page, 'admin@up.edu.ph');
  await expect(page.getByRole('heading', { name: 'Enter your password' })).toBeVisible();

  await page.getByRole('button', { name: /admin@up\.edu\.ph/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('shows why a sign-in failed', async ({ page }) => {
  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      status: 400,
      json: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' },
    })
  );

  await enterEmail(page, 'admin@up.edu.ph');
  await page.getByLabel('Password', { exact: true }).fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'Invalid login credentials' })
  ).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === '/signin');
});

test('explains a Google account from outside UP', async ({ page }) => {
  await page.goto('/signin?error=domain');

  await expect(
    page.getByRole('alert').filter({ hasText: 'Only UP (up.edu.ph) accounts are allowed.' })
  ).toBeVisible();
});

test('sends a reset link to the email typed at sign-in', async ({ page, writes }) => {
  // Answered here, so no reset email goes out.
  await page.route('**/auth/v1/recover**', (route) => route.fulfill({ status: 200, json: {} }));

  await enterEmail(page, 'admin@up.edu.ph');
  await page.getByRole('link', { name: 'Forgot password?' }).click();

  await expect(page.getByLabel('Email')).toHaveValue('admin@up.edu.ph');
  await page.getByRole('button', { name: 'Send reset link' }).click();

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  expect(writes.blocked).toEqual([]);
});
