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

function DataPrivacyContent() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Data Privacy Notice & Consent
          </h4>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            UP Manila DRRM-H — Incident Reporting System
          </p>
        </div>
      </div>

      <Section title="Purpose of Collection">
        Information submitted through this form is collected solely to document, verify, and
        coordinate the University&apos;s emergency response and disaster risk reduction and
        management activities — including headcounts, casualty and missing-person tracking,
        structural damage assessment, and post-drill evaluation.
      </Section>

      <Section title="What We Collect">
        Depending on the form, this may include incident details, location, cluster/unit
        affiliation, headcount and casualty information, and — for reports submitted by identified
        users — the submitter&apos;s name and role. Bystander reports are accepted anonymously and
        do not require or store the submitter&apos;s identity.
      </Section>

      <Section title="Legal Basis">
        Collection and processing are carried out in accordance with the Data Privacy Act of 2012
        (Republic Act No. 10173) and its Implementing Rules and Regulations, on the basis of consent
        (for information you voluntarily provide) and legitimate interest in protecting life,
        health, and property during emergencies and drills.
      </Section>

      <Section title="Data Retention">
        Data is retained only for as long as necessary to fulfill documentation, evaluation, and
        reporting purposes, and in line with the University&apos;s records retention practices.
        After this period, records are securely archived, anonymized, or disposed of.
      </Section>

      <Section title="Sharing & Access">
        Access is limited to authorized DRRM-H Center personnel and Emergency Response Team members
        who need the information to carry out response, evaluation, or reporting duties. Data is not
        sold, and is not shared outside the University except where required by law or to protect
        life and safety in an emergency.
      </Section>

      <Section title="Your Rights">
        Under the Data Privacy Act, you have the right to be informed, to access, to correct, to
        object to processing, and to request the deletion of your personal data, subject to the
        University&apos;s legitimate need to retain records for safety and compliance purposes.
      </Section>

      <Section title="Questions or Concerns">
        For questions about this notice or to exercise your data privacy rights, contact the UP
        Manila DRRM-H Center at{' '}
        <a href="mailto:drrmh.upm@up.edu.ph" className="text-brand-600 dark:text-brand-400">
          drrmh.upm@up.edu.ph
        </a>
        .
      </Section>
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
