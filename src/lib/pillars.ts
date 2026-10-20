import {
  Ambulance,
  ClipboardCheck,
  HeartHandshake,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

// The four DRRM pillars (Republic Act No. 10121). Each will become its own app, separate from
// the IRS; until then the admin sidebar opens a placeholder page per pillar in a new tab. When
// the apps exist, point `pillarHref` at them.

export interface Pillar {
  slug: string;
  /** Full name, the page title. */
  name: string;
  /** Sidebar label. */
  label: string;
  /** Rail label (tablet). */
  short: string;
  icon: LucideIcon;
  summary: string;
  /** Example activities from the national framework; the apps' features are still open. */
  examples: string[];
}

export const PILLARS: Pillar[] = [
  {
    slug: 'prevention-mitigation',
    name: 'Disaster Prevention and Mitigation',
    label: 'Prevention',
    short: 'Prevent',
    icon: ShieldCheck,
    summary: 'Avoiding hazards and reducing vulnerabilities and exposure before a disaster occurs.',
    examples: [
      'Hazard and risk mapping',
      'Student-led school watching',
      'Disaster-resilient building designs',
    ],
  },
  {
    slug: 'preparedness',
    name: 'Disaster Preparedness',
    label: 'Preparedness',
    short: 'Prepare',
    icon: ClipboardCheck,
    summary: 'Building the capacity to anticipate, cope with and respond to emergencies.',
    examples: [
      'Contingency planning',
      'Quarterly multi-hazard drills',
      'Early warning systems',
      'Training DRRM teams',
    ],
  },
  {
    slug: 'response',
    name: 'Disaster Response',
    label: 'Response',
    short: 'Respond',
    icon: Ambulance,
    summary:
      'Immediate action during or right after a disaster to save lives and meet basic needs.',
    examples: [
      'Activating emergency response units',
      'Rapid damage reports, such as RADaR within 72 hours',
      'Managing evacuation centers and temporary learning spaces',
    ],
  },
  {
    slug: 'rehabilitation-recovery',
    name: 'Disaster Rehabilitation and Recovery',
    label: 'Recovery',
    short: 'Recover',
    icon: HeartHandshake,
    summary:
      'Restoring and improving facilities, livelihoods and living conditions under the "build back better" principle.',
    examples: [
      'Psychological first aid (PFA)',
      'Repairing or rebuilding damaged classrooms and facilities',
      'Education continuity plans',
    ],
  },
];

export function pillarHref(slug: string) {
  return `/pillars/${slug}`;
}
