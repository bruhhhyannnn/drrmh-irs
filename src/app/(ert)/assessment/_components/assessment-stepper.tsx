'use client';

import { Button, Drawer } from '@/components/ds';
import {
  useAssessmentSetup,
  useSubmitAssessment,
  useTemplateVersion,
} from '@/components/hooks/use-assessments';
import { Loader } from '@/components/ui/loader';
import { cn } from '@/lib';
import {
  draftSteps,
  sectionScoredItems,
  stepQuestion,
  type AssessmentDraft,
  type DraftStep,
} from '@/lib/assessment-draft';
import type { AnswerValue, AssessmentSetup, AssessmentTemplate } from '@/lib/assessment-template';
import { getAssessmentDraft, saveAssessmentDraft } from '@/lib/offline-queue';
import { useQueryClient } from '@tanstack/react-query';
import { CloudOff, FileQuestion, ListChecks } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { GUTTER, Hero, NoticeCard } from '../../_components/chrome';
import type { ErtProfile } from '../../_lib/use-ert-access';
import { goToAssessment } from '../_lib/nav';
import { BuildingStep } from './building-step';
import { DetailsStep } from './details-step';
import { ReviewStep } from './review-step';
import { SectionIndex } from './section-index';
import { SectionStep } from './section-step';

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
    <Button variant="outline" onClick={() => goToAssessment('')}>
      Back to assessments
    </Button>
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
  /** Set while submitting and after: the draft is about to be (or has been) removed. */
  const closed = useRef(false);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const flush = useCallback(() => {
    if (!dirty.current || closed.current) return;
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
  const isDesktop = useIsDesktop();
  const steps = draftSteps(template, draft);
  // A section screened out by the building's profile isn't a step any more.
  const current: DraftStep = steps.includes(draft.step) ? draft.step : 'building';
  useEffect(() => {
    if (current !== draft.step) update((d) => ({ ...d, step: current, item_id: undefined }));
  }, [current, draft.step, update]);

  const index = steps.indexOf(current);
  const prevStep = steps[index - 1];
  const nextStep = steps[index + 1];
  const prevTarget = isDesktop
    ? prevStep
      ? { step: prevStep, item_id: undefined }
      : null
    : stepQuestion(template, draft, 'prev');
  const nextTarget = isDesktop
    ? nextStep
      ? { step: nextStep, item_id: undefined }
      : null
    : stepQuestion(template, draft, 'next');

  const clearGrown = (step: DraftStep) => {
    if (!step.startsWith('section:')) return;
    const sectionId = step.slice('section:'.length);
    setGrown((g) => {
      if (!g.has(sectionId)) return g;
      const rest = new Set(g);
      rest.delete(sectionId);
      return rest;
    });
  };

  const go = (step: DraftStep, itemId?: string) => {
    update((d) => {
      let resolvedItemId = itemId;
      if (!resolvedItemId && step.startsWith('section:')) {
        const items = sectionScoredItems(template, d, step.slice('section:'.length));
        resolvedItemId = items.find((i) => !d.answers[i.id]?.answer)?.id ?? items[0]?.id;
      }
      return { ...d, step, item_id: resolvedItemId };
    });
    clearGrown(step);
    setIndexOpen(false);
    window.scrollTo({ top: 0 });
  };

  const answerAndAdvance = (itemId: string, answer: AnswerValue) => {
    let nextStepAfter: DraftStep | undefined;
    update((d) => {
      const withAnswer: AssessmentDraft = {
        ...d,
        answers: { ...d.answers, [itemId]: { ...d.answers[itemId], answer } },
      };
      const target = stepQuestion(template, withAnswer, 'next');
      if (!target) return withAnswer;
      nextStepAfter = target.step;
      return { ...withAnswer, step: target.step, item_id: target.item_id };
    });
    if (nextStepAfter) clearGrown(nextStepAfter);
    window.scrollTo({ top: 0 });
  };

  /* ─── Jump from the review to an unanswered question ─── */
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const jump = (sectionId: string, itemId: string) => {
    go(`section:${sectionId}`, itemId);
    setFocusItem(itemId);
  };
  useEffect(() => {
    if (!focusItem) return;
    const el = document.getElementById(`item-${focusItem}`);
    if (el && el.offsetParent !== null) {
      el.scrollIntoView({ block: 'start' });
      el.focus({ preventScroll: true });
    }
    setFocusItem(null);
  }, [focusItem, current]);

  /* ─── Submit ─── */
  const submitMutation = useSubmitAssessment();
  const [submitError, setSubmitError] = useState('');
  const submit = async () => {
    setSubmitError('');
    // The draft is removed once it's sent or queued; a late autosave must not write it back.
    closed.current = true;
    dirty.current = false;
    try {
      const result = await submitMutation.mutateAsync({ template, draft: latest.current });
      if (result.status === 'sent') {
        toast.success('Assessment submitted');
        goToAssessment(`?view=${result.id}`, 'replace');
      } else {
        toast.success("Saved on this phone — sends when you're back online");
        goToAssessment('', 'replace');
      }
    } catch (err) {
      closed.current = false;
      dirty.current = true;
      flush();
      setSubmitError(err instanceof Error ? err.message : "Couldn't submit the assessment.");
    }
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
      <ReviewStep
        {...stepProps}
        onJump={jump}
        onOpenStep={go}
        onSubmit={submit}
        submitting={submitMutation.isPending}
        error={submitError}
      />
    );
  } else {
    const section = template.sections.find((s) => `section:${s.id}` === current);
    if (section) {
      content = (
        <SectionStep
          key={section.id}
          {...stepProps}
          section={section}
          onOpenIndex={() => setIndexOpen(true)}
          onAnswerAndAdvance={answerAndAdvance}
        />
      );
    }
  }

  const index_ = (
    <SectionIndex
      template={template}
      draft={draft}
      steps={steps}
      current={current}
      grown={grown}
      onOpen={(step, itemId) => {
        go(step, itemId);
        // On desktop the section is a full list, so bring the chosen question into view.
        if (itemId) setFocusItem(itemId);
      }}
    />
  );
  const title = draft.building_name || draft.new_building_name.trim() || 'New assessment';
  const isSectionStep = current.startsWith('section:');

  return (
    <>
      <div className={cn(isSectionStep && 'hidden lg:block')}>
        <Hero eyebrow={`Step ${index + 1} of ${steps.length}`} title={title} />
      </div>

      <div
        className={cn(
          GUTTER,
          isSectionStep ? 'flex flex-1 flex-col py-4 lg:py-8' : 'flex flex-1 flex-col py-6 md:py-8'
        )}
      >
        <main className="flex min-w-0 flex-1 flex-col gap-5">{content}</main>
      </div>

      <div
        data-bottom-bar
        className="sticky bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <div className={cn(GUTTER, 'flex items-center justify-between gap-2 py-3')}>
          <Button
            variant="outline"
            disabled={!prevTarget}
            onClick={() => prevTarget && go(prevTarget.step, prevTarget.item_id)}
          >
            Back
          </Button>
          <Button variant="ghost" onClick={() => setIndexOpen(true)} aria-label="Questions">
            <ListChecks size={18} aria-hidden />
            <span className="hidden min-[360px]:inline">Questions</span>
          </Button>
          {nextTarget ? (
            <Button
              onClick={() => go(nextTarget.step, nextTarget.item_id)}
              disabled={current === 'details' && !detailsValid}
            >
              Next
            </Button>
          ) : (
            <span aria-hidden className="w-20" />
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

/** True from the `lg` (1024px) breakpoint up, where sections render as a full list. */
function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}
