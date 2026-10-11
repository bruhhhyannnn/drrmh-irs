import { Figtree, Spline_Sans_Mono } from 'next/font/google';

/** Body face for the redesigned pages. Consumed through the `font-landing` utility (globals.css). */
export const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree' });

/** Data/number face for the redesigned pages. Consumed through `font-landing-mono`. */
export const splineSansMono = Spline_Sans_Mono({
  subsets: ['latin'],
  variable: '--font-spline-sans-mono',
});
