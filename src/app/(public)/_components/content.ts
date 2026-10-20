import { Activity, User, Users, type LucideIcon } from 'lucide-react';

/** Static copy for the public landing page. Sample data is labelled as such on the page. */

export const ROUTES = {
  report: '/bystander-report',
  signIn: '/signin',
} as const;

export const CONTACT = {
  email: 'drrmh.upm@up.edu.ph',
  facebook: 'https://www.facebook.com/UPSimulationCenter',
  address: 'Padre Faura St., Ermita, Manila',
} as const;

export const NAV_LINKS = [
  { href: '#who-its-for', label: "Who it's for" },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#hotlines', label: 'Hotlines' },
] as const;

export const HERO_IMAGES = [
  '/upm-drrmh-background-1.jpg',
  '/upm-drrmh-background-2.jpg',
  '/upm-drrmh-background-3.jpg',
  '/upm-drrmh-background-4.jpg',
] as const;

export const PARTNERS = [
  { logo: '/up-logo.png', alt: 'UP Manila logo', name: 'UP Manila' },
  { logo: '/upm-drrmh-logo.png', alt: 'DRRM-H logo', name: 'DRRM-H Center' },
  { logo: '/irs-logo.png', alt: 'IRS logo', name: 'Incident Reporting System' },
] as const;

export const AUDIENCES: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  points: string[];
  cta: { label: string; href: string };
}[] = [
  {
    icon: User,
    eyebrow: 'Anyone on campus',
    title: 'Report what you see',
    points: ['Pin the incident on the map', 'Add up to 3 photos', 'Stay anonymous'],
    cta: { label: 'Report an emergency', href: ROUTES.report },
  },
  {
    icon: Users,
    eyebrow: 'ERT members',
    title: 'Account for your area',
    points: [
      'Count people with a live total',
      'Log missing persons and casualties',
      'Report without signal',
    ],
    cta: { label: 'Sign in', href: ROUTES.signIn },
  },
  {
    icon: Activity,
    eyebrow: 'DRRM-H office',
    title: 'Follow every event live',
    points: [
      'Watch reports arrive live',
      'See who has not reported',
      'Compare with the last drill',
    ],
    cta: { label: 'Sign in', href: ROUTES.signIn },
  },
];

export const SAMPLE_SUMMARY = {
  event: 'Q4 2026 NSED — UP Manila',
  started: 'Started Oct 8, 9:00 AM',
  peopleCounted: 711,
  reports: 9,
  clustersReported: 6,
  clustersTotal: 7,
  waitingOn: 'Pharmacy',
  latest: [
    { unit: 'CCIS / IT Department', count: 27, time: '9:14 AM' },
    { unit: 'College of Nursing', count: 64, time: '9:11 AM' },
    { unit: 'College of Medicine', count: 112, time: '9:09 AM' },
  ],
};

export const STEPS = [
  { title: 'The office starts an event', desc: 'ERT forms open for the chosen campuses.' },
  { title: 'Teams report', desc: 'Headcount, missing persons, casualties and damage.' },
  { title: 'The office follows live', desc: 'Totals update and missing clusters stand out.' },
  {
    title: 'Complete and compare',
    desc: 'Reports lock and the drill is compared with the last one.',
  },
];

export const PRIVACY_POINTS = [
  'Bystander reports can be anonymous.',
  'Photos are sent without location data.',
  'Only admins see contact numbers.',
];

export const QUOTE = {
  text: 'The Philippines is one of the most disaster-prone countries in the world. Through UPM DRRM-H, we seek to conduct training and seminars that will prepare our responders, even ordinary employees, in disaster preparedness through our state-of-the-art facilities.',
  author: 'Dr. Carlos Primero D. Gundran',
  role: 'Head, UPM DRRM-H, at its launch on June 8, 2022',
  photo: '/carlos-gundran-profile-image.png',
};

export const VISION =
  "The academe's center for world-class capacity building, research, and public services in DRRM-H-related issues in the Philippines by 2030.";

export const MISSION =
  "Develop individuals' competence in DRRM-H to minimize disaster-related injuries, disabilities, diseases, and deaths through capacity-building, research, and public service.";

export const NATIONAL_HOTLINE = {
  name: 'National Hotline',
  desc: 'Police, fire and medical',
  number: '911',
  tel: '911',
};

export const HOTLINES: { name: string; number: string; tel: string; highlight?: boolean }[] = [
  { name: 'DRRM-H Center', number: '811-41-279', tel: '81141279', highlight: true },
  { name: 'UPM Police', number: '(02) 8554-8400', tel: '0285548400' },
  { name: 'UP PGH', number: '(02) 8554-8400', tel: '0285548400' },
  { name: 'Manila DRRMO', number: '(02) 8463-3295', tel: '0284633295' },
  { name: 'Bureau of Fire Protection', number: '(02) 426-0219', tel: '024260219' },
  { name: 'Red Cross', number: '143', tel: '143' },
  { name: 'NDRRMC', number: '(02) 8911-5061', tel: '0289115061' },
  { name: 'PAGASA', number: '(02) 8027-1541', tel: '0280271541' },
  { name: 'Philippine Coast Guard', number: '(02) 8527-3877', tel: '0285273877' },
];
