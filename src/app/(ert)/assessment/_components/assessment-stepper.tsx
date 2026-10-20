'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { Button, ButtonLink, Drawer } from '@/components/ds';
import { useAssessmentSetup, useTemplateVersion } from '@/components/hooks/use-assessments';
import { Loader } from '@/components/ui/loader';
import { cn } from '@/lib';
import { draftSteps, type AssessmentDraft, type DraftStep } from '@/lib/assessment-draft';
import type { AssessmentSetup, AssessmentTemplate } from '@/lib/assessment-template';
import { getAssessmentDraft, saveAssessmentDraft } from '@/lib/offline-queue';
import { useQueryClient } from '@tanstack/react-query';
import { CloudOff, FileQuestion, ListChecks } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Card, GUTTER, Hero, Mono, NoticeCard } from '../../_components/chrome';
import type { ErtProfile } from '../../_lib/use-ert-access';
import { BuildingStep } from './building-step';
import { DetailsStep } from './details-step';
import { SectionIndex } from './section-index';

/** How long after the last change the draft is written to the phone. */
const AUTOSAVE_MS = 500;

/** The step-by-step form for one draft on this phone. */
export function AssessmentStepper({
  clientRef,
  profile,
}: {
  clientRef: string;
  profile: ErtProfile;
}) {
  // undefined while reading the phone, null when there's no such draft for this account.
  const [draft, setDraft] = useState<AssessmentDraft | null>();

  useEffect(() => {
    let active = true;
    getAssessmentDraft(clientRef)
      .then((d) => {
        if (active) setDraft(d && d.evaluator_id === profile.id ? d : null);
      })
      .catch(() => {
        if (active) setDraft(null);
      });
    return () => {
      active = false;
    };
  }, [clientRef, profile.id]);

  if (draft === undefined) return <Loader label="Opening the draft…" className="flex-1 py-20" />;
  if (draft === null) {
    return (
      <NoticeCard
        icon={<FileQuestion size={28} aria-hidden />}
        iconTone="neutral"
        title="This draft isn't on this phone"
        description="It may have been sent or discarded already, or it was started on another phone."
      >
        <BackToHub />
      </NoticeCard>
    );
  }
  return <DraftLoader initial={draft} profile={profile} />;
}

function BackToHub() {
  return (
    <ButtonLink href="/assessment" variant="outline">
      Back to assessments
    </ButtonLink>
  );
}

/** The checklist version the draft was started on, and the campus's form setup. */
function DraftLoader({ initial, profile }: { initial: AssessmentDraft; profile: ErtProfile }) {
  const template = useTemplateVersion(initial.template_version_id);
  const setup = useAssessmentSetup(initial.campus_id);

  if (template.data && setup.data) {
    return (
      <DraftForm initial={initial} template={template.data} setup={setup.data} profile={profile} />
    );
  }
  if (template.data === null) {
    return (
      <NoticeCard
        icon={<FileQuestion size={28} aria-hidden />}
        iconTone="neutral"
        title="This checklist version is no longer available"
        description="Discard this draft from the assessments page and start a new one."
      >
        <BackToHub />
      </NoticeCard>
    );
  }
  if (template.isError || setup.isError) {
    return (
      <NoticeCard
        icon={<CloudOff size={28} aria-hidden />}
        iconTone="warning"
        title="Not on this phone yet"
        description="The checklist needs a connection the first time it opens. It loads here as soon as you're back online."
      >
        <BackToHub />
      </NoticeCard>
    );
  }
  return <Loader label="Loading the checklist…" className="flex-1 py-20" />;
}

function DraftForm({
  initial,
  template,
  setup,
  profile,
}: {
  initial: AssessmentDraft;
  template: AssessmentTemplate;
  setup: AssessmentSetup;
  profile: ErtProfile;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initial);
  const [detailsValid, setDetailsValid] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  // Sections that gained questions since this form opened; cleared when one is opened.
  const [grown, setGrown] = useState<Set<string>>(() => new Set());

  const update = useCallback(
    (fn: (d: AssessmentDraft) => AssessmentDraft) =>
      setDraft((d) => ({ ...fn(d), updated_at: Date.now() })),
    []
  );

  /* ─── Autosave ─── */
  const latest = useRef(draft);
  const dirty = useRef(false);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    saveAssessmentDraft(latest.current)
      .then(() => queryClient.invalidateQueries({ queryKey: ['assessment-drafts'] }))
      .catch(() => toast.error("Couldn't save the draft on this phone."));
  }, [queryClient]);

  useEffect(() => {
    if (draft === initial) return;
    dirty.current = true;
    const timer = setTimeout(flush, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, initial, flush]);

  // A pending save still lands when the phone locks, the tab closes or the page changes.
  useEffect(() => {
    const onPageHide = () => flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [flush]);

  /* ─── Steps ─── */
  const steps = draftSteps(template, draft);
  // A section screened out by the building's profile isn't a step any more.
  const current: DraftStep = steps.includes(draft.step) ? draft.step : 'building';
  useEffect(() => {
    if (current !== draft.step) update((d) => ({ ...d, step: current }));
  }, [current, draft.step, update]);

  const index = steps.indexOf(current);
  const prev = steps[index - 1];
  const next = steps[index + 1];

  const go = (step: DraftStep) => {
    update((d) => ({ ...d, step }));
    if (step.startsWith('section:')) {
      const sectionId = step.slice('section:'.length);
      setGrown((g) => {
        if (!g.has(sectionId)) return g;
        const rest = new Set(g);
        rest.delete(sectionId);
        return rest;
      });
    }
    setIndexOpen(false);
    window.scrollTo({ top: 0 });
  };

  const stepProps = { template, draft, update };
  let content: React.ReactNode;
  if (current === 'details') {
    content = (
      <DetailsStep {...stepProps} setup={setup} profile={profile} onValidChange={setDetailsValid} />
    );
  } else if (current === 'building') {
    content = (
      <BuildingStep {...stepProps} onGrown={(ids) => setGrown((g) => new Set([...g, ...ids]))} />
    );
  } else if (current === 'review') {
    content = (
      <Card className="p-5 md:p-6">
        <h2 className="text-[19px] font-bold">Review</h2>
        <p className="mt-2 text-[15px] text-gray-600">The review and submit step comes next.</p>
      </Card>
    );
  } else {
    const section = template.sections.find((s) => `section:${s.id}` === current);
    content = (
      <Card className="flex flex-col gap-2 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <Mono className="font-semibold text-gray-500">{section?.code}</Mono>
          {section && (
            <Bilingual
              as="h2"
              en={section.title_en}
              fil={section.title_fil}
              className="text-[19px] font-bold"
            />
          )}
        </div>
        <p className="text-[15px] text-gray-600">The questions for this section come next.</p>
      </Card>
    );
  }

  const index_ = (
    <SectionIndex
      template={template}
      draft={draft}
      steps={steps}
      current={current}
      grown={grown}
      onOpen={go}
    />
  );
  const title = draft.building_name || draft.new_building_name.trim() || 'New assessment';

  return (
    <>
      <Hero eyebrow={`Step ${index + 1} of ${steps.length}`} title={title} />

      <div
        className={cn(
          GUTTER,
          'flex-1 py-6 md:py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8'
        )}
      >
        <main className="flex min-w-0 flex-col gap-5">{content}</main>
        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <Card className="flex max-h-[calc(100dvh-48px)] flex-col overflow-y-auto p-2">
            <h2 className="px-3 pt-2 pb-1 text-[12px] font-bold tracking-[.08em] text-gray-500 uppercase">
              Questions
            </h2>
            {index_}
          </Card>
        </aside>
      </div>

      <div
        data-bottom-bar
        className="sticky bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <div className={cn(GUTTER, 'flex items-center gap-2 py-3')}>
          <Button variant="outline" disabled={!prev} onClick={() => prev && go(prev)}>
            Back
          </Button>
          <Button variant="ghost" onClick={() => setIndexOpen(true)} aria-label="Questions">
            <ListChecks size={18} aria-hidden />
            <span className="hidden sm:inline">Questions</span>
          </Button>
          <div className="flex-1" />
          {next && (
            <Button onClick={() => go(next)} disabled={current === 'details' && !detailsValid}>
              Next
            </Button>
          )}
        </div>
      </div>

      <Drawer
        open={indexOpen}
        onClose={() => setIndexOpen(false)}
        title="Questions"
        subtitle="Open any step. Your answers are saved on this phone as you go."
        footer={
          <Button variant="outline" fullWidth onClick={() => setIndexOpen(false)}>
            Close
          </Button>
        }
      >
        {index_}
      </Drawer>
    </>
  );
}
