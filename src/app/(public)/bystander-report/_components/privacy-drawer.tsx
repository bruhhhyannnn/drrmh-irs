'use client';

import {
  PRIVACY_NOTICE_SECTIONS,
  PRIVACY_NOTICE_SUBTITLE,
  PRIVACY_NOTICE_TITLE,
} from '@/components/common';
import { ShieldCheck } from 'lucide-react';
import { Drawer } from './drawer';
import { Button } from './fields';

/** The full privacy notice, over the current step so nothing typed is lost. */
export function PrivacyDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={PRIVACY_NOTICE_TITLE}
      subtitle={PRIVACY_NOTICE_SUBTITLE}
      footer={
        <Button fullWidth onClick={onClose}>
          Back to the report
        </Button>
      }
    >
      <div className="flex items-start gap-2.5 rounded-2xl bg-gray-100 px-4 py-3.5 text-[14px] leading-[1.6] text-gray-700">
        <ShieldCheck size={18} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          Bystander reports are anonymous. A contact number is optional and only shared if you add
          one.
        </span>
      </div>
      {PRIVACY_NOTICE_SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-1">
          <h3 className="text-[15px] font-bold text-gray-900">{section.title}</h3>
          <p className="text-[14px] leading-[1.6] text-pretty text-gray-600">{section.body}</p>
        </section>
      ))}
    </Drawer>
  );
}
