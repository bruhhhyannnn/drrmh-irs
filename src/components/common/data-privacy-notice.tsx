'use client';

import { Modal } from '@/components/ui';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';

interface DataPrivacyNoticeProps {
  /** Short inline summary shown next to the "Read full notice" trigger. */
  summary: string;
}

export function DataPrivacyNotice({ summary }: DataPrivacyNoticeProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-1 border-t border-gray-100 pt-3 dark:border-white/5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Data Privacy Notice:
        </p>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex shrink-0 items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
        >
          <ShieldCheck size={13} />
          Read full notice
        </button>
      </div>
      <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-500">{summary}</p>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} className="sm:max-w-lg">
        <DataPrivacyContent />
      </Modal>
    </div>
  );
}

export const PRIVACY_NOTICE_TITLE = 'Data Privacy Notice & Consent';
export const PRIVACY_NOTICE_SUBTITLE = 'UP Manila DRRM-H — Incident Reporting System';

/** The notice text, shared by this modal and the bystander form's drawer. */
export const PRIVACY_NOTICE_SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Purpose of Collection',
    body: "Information submitted through this form is collected solely to document, verify, and coordinate the University's emergency response and disaster risk reduction and management activities — including headcounts, casualty and missing-person tracking, structural damage assessment, and post-drill evaluation.",
  },
  {
    title: 'What We Collect',
    body: "Depending on the form, this may include incident details, location, cluster/unit affiliation, headcount and casualty information, and — for reports submitted by identified users — the submitter's name and role. Bystander reports are accepted anonymously and do not require or store the submitter's identity. Bystanders may add photos of the damage and a contact number for follow-up; both are optional.",
  },
  {
    title: 'Legal Basis',
    body: 'Collection and processing are carried out in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations, on the basis of consent (for information you voluntarily provide) and legitimate interest in protecting life, health, and property during emergencies and drills.',
  },
  {
    title: 'Data Retention',
    body: "Data is retained only for as long as necessary to fulfill documentation, evaluation, and reporting purposes, and in line with the University's records retention practices. After this period, records are securely archived, anonymized, or disposed of.",
  },
  {
    title: 'Sharing & Access',
    body: 'Access is limited to authorized DRRM-H Center personnel and Emergency Response Team members who need the information to carry out response, evaluation, or reporting duties. Data is not sold, and is not shared outside the University except where required by law or to protect life and safety in an emergency.',
  },
  {
    title: 'Your Rights',
    body: "Under the Data Privacy Act, you have the right to be informed, to access, to correct, to object to processing, and to request the deletion of your personal data, subject to the University's legitimate need to retain records for safety and compliance purposes.",
  },
  {
    title: 'Questions or Concerns',
    body: (
      <>
        For questions about this notice or to exercise your data privacy rights, contact the UP
        Manila DRRM-H Center at{' '}
        <a
          href="mailto:drrmh.upm@up.edu.ph"
          className="text-brand-600 dark:text-brand-400 font-semibold"
        >
          drrmh.upm@up.edu.ph
        </a>
        .
      </>
    ),
  },
];

export function DataPrivacyContent() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {PRIVACY_NOTICE_TITLE}
          </h4>
          <p className="text-xs text-gray-400 dark:text-gray-500">{PRIVACY_NOTICE_SUBTITLE}</p>
        </div>
      </div>

      {PRIVACY_NOTICE_SECTIONS.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.body}
        </Section>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</p>
      <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{children}</p>
    </div>
  );
}
