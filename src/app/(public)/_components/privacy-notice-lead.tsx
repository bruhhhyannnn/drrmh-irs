'use client';

import { DataPrivacyContent } from '@/components/common';
import { Modal } from '@/components/ui';
import { useState } from 'react';
import { TEXT_BUTTON } from './primitives';

/** The privacy lead line, whose "Read the full notice" opens the same notice the forms use. */
export function PrivacyNoticeLead() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <p className="text-[17px] leading-[1.6] text-pretty text-gray-600">
        Used only for documentation, evaluation and reporting.{' '}
        <button type="button" onClick={() => setIsOpen(true)} className={TEXT_BUTTON}>
          Read the full notice
        </button>
      </p>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} className="sm:max-w-lg">
        <DataPrivacyContent />
      </Modal>
    </>
  );
}
