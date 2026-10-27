// The app evaluation in Google Forms. The popup after a report sends links to it, and so does
// Rate the app in the ERT account menu, for anyone who skipped the popup.

export const RATE_APP_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfCgc2sGeTQdSCO_CNNaqXA9Ug0KFzJo2qp3j11XcaQieEe2A/viewform';

/** Set once the form has been opened from this device, so the popup stops asking. */
export const RATED_APP_KEY = 'drrmh-rated-app';

export function hasRatedApp() {
  try {
    return localStorage.getItem(RATED_APP_KEY) === '1';
  } catch {
    return false;
  }
}
