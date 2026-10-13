import path from 'node:path';

/** The signed-in admin session that auth.setup.ts saves and the admin tests start from. */
export const ADMIN_STATE = path.join(__dirname, '..', '.auth', 'admin.json');

// Read when called: playwright.config.ts imports this file before it loads .env.
export function adminLogin() {
  return {
    email: process.env.E2E_ADMIN_EMAIL ?? '',
    password: process.env.E2E_ADMIN_PASSWORD ?? '',
  };
}

export function hasAdminLogin() {
  const { email, password } = adminLogin();
  return !!(email && password);
}

export const NO_ADMIN_LOGIN =
  'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in .env to run the signed-in admin tests.';
