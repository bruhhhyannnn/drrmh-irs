import { Figtree, Spline_Sans_Mono } from 'next/font/google';

/** Body face for the landing page. Consumed through the `font-landing` utility (globals.css). */
export const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree' });

/** Data/number face for the landing page. Consumed through `font-landing-mono`. */
export const splineSansMono = Spline_Sans_Mono({
  subsets: ['latin'],
  variable: '--font-spline-sans-mono',
});
