'use client';

import { useCampusClusters } from '@/components/hooks/use-campus';
import {
  useMatatagCampuses,
  useMatatagForm,
  useMatatagRecord,
  useMatatagTemplate,
  useSaveMatatag,
} from '@/components/hooks/use-matatag';
import {
  assessmentSections,
  emptyMatatag,
  matatagAnswerLabel,
  matatagCompletionErrors,
  matatagQuestionUnits,
  matatagResponseTotals,
  matatagScore,
  matatagTotals,
  matatagUnansweredQuestions,
  type MatatagDocument,
} from '@/lib/matatag';
import { type QuestionLanguage, type QuestionText } from '@/lib/matatag-question-content';
import { type MatatagQuestion } from '@/lib/matatag-template';
import { matatagDocumentSchema } from '@/lib/schemas';
import { createUuid } from '@/lib/uuid';
import { useAuthStore } from '@/store';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCheck,
  ChevronUp,
  ClipboardCheck,
  Download,
  FileText,
  FolderOpen,
  Home,
  Info,
  Save,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Popover } from 'radix-ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './matatag.module.css';
import { swipedStep } from './section-swipe';

const OTHER_VALUE = '__other__';
type Draft = { id: string; version: number; document: MatatagDocument; dirty: boolean };
const fields: {
  key: keyof MatatagDocument['details'];
  label: string;
  type?: string;
  placeholder?: string;
}[] = [
  {
    key: 'buildings',
    label: 'Name of building(s)',
    placeholder: 'Enter the buildings being assessed…',
  },
  { key: 'buildingCount', label: 'Number of buildings', type: 'number' },
  { key: 'floorCount', label: 'Number of floors', type: 'number' },
  { key: 'commander', label: 'Incident commander', placeholder: 'Full name…' },
  { key: 'evaluator', label: 'Evaluator', placeholder: 'Full name…' },
  { key: 'date', label: 'Assessment date', type: 'date' },
  { key: 'timeStart', label: 'Time started', type: 'time' },
];

function downloadDraft(draft: Draft) {
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = `matatag-${draft.document.details.date || 'draft'}-${draft.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadRawDraft(raw: string) {
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = 'matatag-recovery-draft.json';
  link.click();
  URL.revokeObjectURL(url);
}

export function MatatagForm({ suppliedFormId }: { suppliedFormId?: string } = {}) {
  const params = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const formId = suppliedFormId ?? params.get('formId');
  return (
    <AssessmentEditor
      key={`${user?.id}:${params.get('id') ?? 'new'}:${formId ?? 'default'}`}
      recordId={params.get('id')}
      formId={formId}
    />
  );
}

function AssessmentEditor({
  recordId,
  formId,
}: {
  recordId: string | null;
  formId: string | null;
}) {
  const { user, userProfile } = useAuthStore();
  const params = useSearchParams();
  const selectedLanguage = params.get('language');
  const [languageOverride, setLanguageOverride] = useState<QuestionLanguage | null>(null);
  const language: QuestionLanguage =
    languageOverride ??
    (selectedLanguage === 'en' || selectedLanguage === 'fil' ? selectedLanguage : 'both');

  function handleLanguageChange(nextLang: string) {
    const valid: QuestionLanguage = nextLang === 'en' || nextLang === 'fil' ? nextLang : 'both';
    setLanguageOverride(valid);
    const url = new URL(window.location.href);
    url.searchParams.set('language', valid);
    window.history.replaceState(null, '', url);
  }
  const campuses = useMatatagCampuses();
  const record = useMatatagRecord(recordId, formId ?? undefined);
  const save = useSaveMatatag();
  const published = useMatatagTemplate();
  const campusForm = useMatatagForm(formId);
  const [document, setDocument] = useState<MatatagDocument>(() => emptyMatatag());
  const matatagSections = assessmentSections(document);
  const reviewStep = matatagSections.length + 1;
  const [id, setId] = useState('');
  const [version, setVersion] = useState(0);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('DRAFT');
  const [message, setMessage] = useState('');
  const [storageError, setStorageError] = useState('');
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [rawRecovery, setRawRecovery] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [recoverable, setRecoverable] = useState<Draft | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorsRef = useRef<HTMLDivElement>(null);
  const sectionNavRef = useRef<HTMLElement>(null);
  const isMobileMedia = '(max-width: 720px)';
  const [isMobile, setIsMobile] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const navigatingFromPopover = useRef(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const suppressSwipeClick = useRef(false);
  const initialized = useRef(false);
  const storageKey = `matatag-v1:${user?.id}:${formId ?? 'default'}:${recordId ?? 'new'}`;
  const totals = matatagResponseTotals(document);
  const progress = Math.round(((totals.total - totals.unanswered) / totals.total) * 100);
  const section = matatagSections[step - 1];
  const sectionTotals = section ? matatagResponseTotals(document, section.id) : null;
  const unansweredQuestions = matatagUnansweredQuestions(document);
  const responseLocked = Boolean(
    formId && record.data?.status === 'COMPLETED' && !campusForm.data?.canManage
  );
  const campusClusters = useCampusClusters(document.details.campusId);

  const profileName =
    [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') ||
    userProfile?.username ||
    (user?.user_metadata?.full_name as string | undefined) ||
    '';
  const profileCampusId = userProfile?.campus_id ?? '';
  const profileCampusName = userProfile?.campus?.name ?? '';
  const profileCluster = userProfile?.cluster?.name || userProfile?.unit?.cluster?.name || '';
  const profileUnit = userProfile?.unit?.name || '';
  const profileOrganization = profileCluster || profileUnit;
  const isEvaluatorLocked = Boolean(user);
  const isCampusLocked = Boolean(user && profileCampusId);
  const isUnitLocked = Boolean(user && profileOrganization);

  const [isOtherUnit, setIsOtherUnit] = useState(false);
  const isOtherUnitActive =
    isOtherUnit ||
    Boolean(
      document.details.unit &&
      campusClusters.data &&
      campusClusters.data.length > 0 &&
      !campusClusters.data.some((c) => c.name === document.details.unit)
    );

  const sortedCampuses = useMemo(() => {
    const list = [...(campuses.data ?? [])];
    if (document.details.campusId && !list.some((c) => c.id === document.details.campusId)) {
      list.push({
        id: document.details.campusId,
        name: document.details.campus || 'Assigned campus',
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [campuses.data, document.details.campusId, document.details.campus]);

  const sortedClusters = useMemo(() => {
    const list = (campusClusters.data ?? []).filter(
      (cluster) => cluster.is_active || cluster.name === document.details.unit
    );
    if (
      document.details.unit &&
      !isOtherUnitActive &&
      !list.some((c) => c.name === document.details.unit)
    ) {
      list.push({
        id: '__current_unit__',
        name: document.details.unit,
        is_active: true,
      } as (typeof list)[number]);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [campusClusters.data, document.details.unit, isOtherUnitActive]);

  useEffect(() => {
    if (errors.length) errorsRef.current?.focus();
  }, [errors]);

  useEffect(() => {
    const media = window.matchMedia(isMobileMedia);
    const updateLayout = () => {
      setIsMobile(media.matches);
      if (!media.matches) setSectionsOpen(false);
    };
    updateLayout();
    media.addEventListener('change', updateLayout);
    return () => media.removeEventListener('change', updateLayout);
  }, []);

  useEffect(() => {
    if (initialized.current || (recordId && !record.data) || (formId && !campusForm.data)) return;
    let draft: Draft | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const candidate = JSON.parse(raw);
        const parsed = matatagDocumentSchema.safeParse(candidate.document);
        if (
          parsed.success &&
          typeof candidate.id === 'string' &&
          Number.isInteger(candidate.version) &&
          candidate.version >= 0
        )
          draft = { ...candidate, document: parsed.data };
        else {
          setStorageError('The saved device draft could not be read. It has not been restored.');
          setStorageBlocked(true);
          setRawRecovery(raw);
        }
      }
    } catch {
      setStorageError('Device storage is unavailable. Download a copy before leaving.');
      setStorageBlocked(true);
    }
    if (record.data) {
      setDocument(record.data.document);
      setId(record.data.id);
      setVersion(record.data.version);
      setStatus(record.data.status);
      if (draft?.dirty) setRecoverable(draft);
    } else if (draft) {
      setDocument(draft.document);
      setId(draft.id);
      setVersion(draft.version);
      setDirty(draft.dirty);
      setMessage('Your device draft has been restored.');
    } else {
      const template = campusForm.data?.template ?? published.data;
      if (!template) return;
      setId(createUuid());
      const initial = emptyMatatag(template, campusForm.data?.phase === 'POST' ? 'POST' : 'PRE');
      if (campusForm.data) {
        initial.details.campusId = campusForm.data.campus.id;
        initial.details.campus = campusForm.data.campus.name;
      }
      const now = new Date();
      initial.details.date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      initial.details.evaluator = profileName;
      if (profileCampusId) {
        initial.details.campusId = profileCampusId;
        initial.details.campus = profileCampusName;
      }
      if (profileOrganization) initial.details.unit = profileOrganization;
      setDocument(initial);
    }
    initialized.current = true;
    setReady(true);
  }, [
    recordId,
    record.data,
    published.data,
    formId,
    campusForm.data,
    storageKey,
    profileName,
    profileCampusId,
    profileCampusName,
    profileOrganization,
  ]);

  useEffect(() => {
    if (!user || recordId) return;
    setDocument((prev) => {
      let changed = false;
      const nextDetails = { ...prev.details };

      if (profileName && nextDetails.evaluator !== profileName) {
        nextDetails.evaluator = profileName;
        changed = true;
      }
      if (profileCampusId && nextDetails.campusId !== profileCampusId) {
        nextDetails.campusId = profileCampusId;
        nextDetails.campus = profileCampusName || nextDetails.campus;
        changed = true;
      }
      if (profileOrganization && nextDetails.unit !== profileOrganization) {
        nextDetails.unit = profileOrganization;
        changed = true;
      }

      return changed ? { ...prev, details: nextDetails } : prev;
    });
  }, [user, recordId, profileName, profileCampusId, profileCampusName, profileOrganization]);

  useEffect(() => {
    if (!ready || recoverable || storageBlocked) return;
    const saveDeviceDraft = () => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ id, version, document, dirty } satisfies Draft)
        );
      } catch {
        setStorageError('Device storage is unavailable. Download a copy before leaving.');
      }
    };
    const timeout = window.setTimeout(saveDeviceDraft, 350);
    window.addEventListener('pagehide', saveDeviceDraft);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('pagehide', saveDeviceDraft);
    };
  }, [document, dirty, id, version, ready, recoverable, storageBlocked, storageKey]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update(next: MatatagDocument) {
    setDocument(next);
    setDirty(true);
    setMessage('');
    setErrors([]);
  }
  function go(next: number, focusQuestionId?: string) {
    if (isMobile && sectionsOpen) {
      navigatingFromPopover.current = true;
      setSectionsOpen(false);
    }
    setStep(next);
    setErrors([]);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    requestAnimationFrame(() => {
      if (focusQuestionId) {
        const input = window.document.getElementsByName(focusQuestionId)[0] as
          HTMLInputElement | undefined;
        input?.focus({ preventScroll: true });
      } else {
        headingRef.current?.focus();
      }
    });
  }
  function updateSection(patch: Partial<MatatagDocument['sections'][string]>) {
    if (!section) return;
    update({
      ...document,
      sections: {
        ...document.sections,
        [section.id]: {
          ...(document.sections[section.id] ?? { notApplicable: false, score: '', comments: '' }),
          ...patch,
        },
      },
    });
  }
  async function importDraft(file?: File) {
    if (!file) return;
    try {
      const raw = await file.text();
      const source = JSON.parse(raw) as { document?: unknown } | unknown;
      const checked = matatagDocumentSchema.safeParse(
        typeof source === 'object' && source !== null && 'document' in source
          ? (source as { document: unknown }).document
          : source
      );
      if (!checked.success) throw new Error('This file is not a valid MATATAG draft.');
      if (formId && campusForm.data && checked.data.version !== campusForm.data.template.id)
        throw new Error('This draft belongs to a different campus assessment.');
      const imported = {
        ...checked.data,
        details: {
          ...checked.data.details,
          phase: campusForm.data
            ? campusForm.data.phase === 'POST'
              ? 'POST'
              : 'PRE'
            : checked.data.details.phase,
        },
      };
      localStorage.removeItem(storageKey);
      update(imported);
      setStorageBlocked(false);
      setRawRecovery(null);
      setStorageError('');
      setMessage('Draft imported. Its current record identity and version were kept.');
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : 'This file is not a valid MATATAG draft.',
      ]);
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }
  async function saveShared(complete: boolean) {
    let docToSave = document;
    if (complete) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      docToSave = {
        ...document,
        details: {
          ...document.details,
          timeEnd: currentTime,
        },
      };
      setDocument(docToSave);
    }
    const checked = matatagDocumentSchema.safeParse(docToSave);
    const validation = checked.success
      ? complete
        ? matatagCompletionErrors(checked.data)
        : []
      : checked.error.issues.map((issue) => issue.message);
    if (validation.length) {
      setErrors(validation);
      return;
    }
    setErrors([]);
    try {
      const result = await save.mutateAsync({
        id,
        version,
        complete,
        document: docToSave,
        ...(formId ? { formId } : {}),
      });
      setDocument(result.document);
      setVersion(result.version);
      setDirty(false);
      setStatus(result.status);
      setMessage(
        complete
          ? 'Assessment completed and saved to shared records.'
          : 'Draft saved to shared records.'
      );
      // Keep the same editor and storage key until navigation; the version makes repeat saves safe.
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Unable to save. Please try again.']);
    }
  }

  async function startNewAssessment() {
    if (
      dirty &&
      !window.confirm(
        'Start a new assessment? Download or save this draft first if you need to keep the changes.'
      )
    )
      return;
    const latest = formId ? null : await published.refetch();
    const template = campusForm.data?.template ?? latest?.data;
    if (!template) {
      setErrors([
        'Unable to load the latest checklist. Reconnect and try again. Your current draft is kept.',
      ]);
      return;
    }
    const fresh = emptyMatatag(template, campusForm.data?.phase === 'POST' ? 'POST' : 'PRE');
    const now = new Date();
    fresh.details.date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    fresh.details.evaluator = profileName;
    if (profileCampusId) {
      fresh.details.campusId = profileCampusId || document.details.campusId;
      fresh.details.campus = profileCampusName || document.details.campus;
    }
    if (profileOrganization) fresh.details.unit = profileOrganization;
    setStorageBlocked(false);
    setRawRecovery(null);
    setIsOtherUnit(false);
    setDocument(fresh);
    setId(createUuid());
    setVersion(0);
    setStatus('DRAFT');
    setDirty(false);
    setMessage('New assessment started.');
    go(0);
  }
  const renderQuestionHeader = (item: MatatagQuestion) => (
    <div className={styles.questionText}>
      <span className={styles.questionNumber}>
        {item.number}
        {item.starred ? '*' : ''}
      </span>
      <div id={`question-${item.id}`} className={styles.questionCopy}>
        <QuestionCopy text={item.text} language={language} />
        <span className={styles.requiredIndicator}>(Required)</span>
        {item.group && (
          <p className={styles.groupResult} role="status">
            Question result: {matatagAnswerLabel(document, section.id, item, language)}
          </p>
        )}
      </div>
    </div>
  );
  const renderQuestionAnswers = (item: MatatagQuestion) =>
    !item.group ? (
      <fieldset
        className={styles.answerGroup}
        aria-labelledby={`question-${item.id}`}
        aria-required="true"
        aria-describedby={
          item.number.includes('.')
            ? `question-${section.id}-${item.number.split('.')[0]}`
            : undefined
        }
      >
        <legend className={styles.srOnly}>
          Response to {section.id}.{item.number}
        </legend>
        {item.options.map(({ value: answer, en, fil, kind }) => (
          <label
            key={answer}
            data-selected={document.answers[item.id] === answer}
            data-answer={kind}
          >
            <input
              type="radio"
              name={item.id}
              value={answer}
              required
              checked={document.answers[item.id] === answer}
              onChange={() =>
                update({
                  ...document,
                  answers: { ...document.answers, [item.id]: answer },
                })
              }
            />
            <span lang={language === 'fil' ? 'fil' : 'en'}>
              {language === 'fil' ? fil || en : en}
            </span>
          </label>
        ))}
      </fieldset>
    ) : null;
  const renderQuestionDetails = (item: MatatagQuestion) => (
    <>
      {item.text.reference && (
        <details className={styles.reference}>
          <summary>Checklist reference</summary>
          <p>{item.text.reference}</p>
        </details>
      )}
      <details className={styles.remarkDetails}>
        <summary>
          {document.remarks[item.id] ? 'Edit remarks' : 'Add remarks'} <span>(optional)</span>
        </summary>
        <label className={styles.remarks}>
          Remarks <span>(optional)</span>
          <textarea
            name={`remarks-${item.id}`}
            autoComplete="off"
            rows={2}
            maxLength={4000}
            value={document.remarks[item.id] ?? ''}
            onChange={(e) =>
              update({
                ...document,
                remarks: { ...document.remarks, [item.id]: e.target.value },
              })
            }
            placeholder="Add an observation, location, or follow-up action..."
          />
        </label>
      </details>
    </>
  );
  const renderQuestion = (item: MatatagQuestion) => (
    <>
      {renderQuestionHeader(item)}
      {renderQuestionAnswers(item)}
      {renderQuestionDetails(item)}
    </>
  );
  const toolbar = (
    <div className={styles.toolbar}>
      <div className={styles.saveState} role="status" aria-live="polite">
        <span aria-hidden="true" data-dirty={dirty} />
        {responseLocked
          ? 'Submitted response'
          : dirty
            ? 'Changes saved on this device'
            : version > 0
              ? 'Shared draft is up to date'
              : 'New assessment'}
      </div>
      <label className={styles.languageControl}>
        Question language
        <select
          name="question-language"
          value={language}
          onChange={(event) => handleLanguageChange(event.target.value)}
        >
          <option value="both">English + Tagalog</option>
          <option value="en">English</option>
          <option value="fil">Tagalog</option>
        </select>
      </label>
      <div className={styles.actions}>
        <button type="button" onClick={() => importInputRef.current?.click()}>
          <Upload aria-hidden="true" size={17} /> Import
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Import a MATATAG draft"
          hidden
          onChange={(event) => void importDraft(event.target.files?.[0])}
        />
        <button onClick={() => downloadDraft({ id, version, document, dirty })}>
          <Download aria-hidden="true" size={17} /> Download
        </button>
        <button onClick={() => window.print()}>
          <FileText aria-hidden="true" size={17} /> Print
        </button>
      </div>
    </div>
  );
  const navigation = (
    <aside className={styles.sidebar}>
      <div className={styles.progressHeader}>
        <span>Assessment progress</span>
        <strong>{progress}%</strong>
      </div>
      <progress value={progress} max={100} aria-label="Checklist completion" />
      <p className={styles.muted}>
        {totals.total - totals.unanswered} of {totals.total} checklist items answered
      </p>
      <nav ref={sectionNavRef} aria-label="Assessment sections" className={styles.sectionNav}>
        <button onClick={() => go(0)} aria-current={step === 0 ? 'step' : undefined}>
          <FileText aria-hidden="true" size={17} />
          <span>Assessment details</span>
        </button>
        <div className={styles.navLabel}>Building checklist</div>
        {matatagSections.map((s, index) => {
          const count = matatagResponseTotals(document, s.id);
          return (
            <button
              key={s.id}
              onClick={() => go(index + 1)}
              aria-current={step === index + 1 ? 'step' : undefined}
            >
              <span className={styles.sectionNumber}>{s.id.length > 10 ? index + 1 : s.id}</span>
              <span lang={language === 'fil' ? 'fil' : 'en'}>
                {language === 'fil' ? s.translation || s.title : s.title}
              </span>
              {count.unanswered === 0 && (
                <Check aria-hidden="true" size={14} className={styles.completeIcon} />
              )}
            </button>
          );
        })}
        <button
          onClick={() => go(reviewStep)}
          aria-current={step === reviewStep ? 'step' : undefined}
        >
          <ClipboardCheck aria-hidden="true" size={17} />
          <span>Review & finish</span>
        </button>
      </nav>
      <div className={styles.sourceNote}>
        <ShieldCheck aria-hidden="true" size={19} />
        <p>
          Based on the UP Resilience Institute checklist.
          <br />
          <strong>Updated June 29, 2026</strong>
          <br />
          <a href="/matatag-reference.pdf" target="_blank" rel="noreferrer">
            View original checklist ↗
          </a>
        </p>
      </div>
      {!recordId && (
        <button
          className={styles.newAssessmentButton}
          disabled={
            !ready || save.isPending || published.isFetching || !!recoverable || responseLocked
          }
          onClick={startNewAssessment}
        >
          <FileText aria-hidden="true" size={16} />
          Start a new assessment
        </button>
      )}
    </aside>
  );
  return (
    <div className={styles.root}>
      <div className={styles.screen}>
        <a className={styles.skipLink} href="#assessment-content">
          Skip to assessment
        </a>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMarks}>
              <Image
                src="/up-logo.png"
                alt="University of the Philippines"
                width={42}
                height={42}
                className={styles.brandLogo}
              />
              <Image
                src="/UPRI Logo.png"
                alt="UP Resilience Institute"
                width={42}
                height={42}
                className={styles.brandLogoSecondary}
              />
            </span>
            <span>
              <strong>Digital MATATAG</strong>
              <small>UP Manila DRRM-H</small>
            </span>
          </Link>
          <div className={styles.headerLinks}>
            <Link href="/matatag/assessments">
              <FolderOpen aria-hidden="true" size={16} /> Shared records
            </Link>
            <Link href="/">
              <Home aria-hidden="true" size={16} />
              <span>Back to home</span>
            </Link>
          </div>
        </header>
        <div className={styles.banner}>
          <div className={styles.bannerInner}>
            <div className={styles.bannerTitle}>
              <span>UP Resilience Institute building safety instrument</span>
              <div className={styles.titleLine}>
                <h1>MATATAG</h1>
                <strong>Digital assessment</strong>
              </div>
              <p>Monitoring and Assessment Tool for Area Threats and Accident Generators</p>
            </div>
            <div className={styles.bannerFacts} aria-label="Assessment scope">
              <div>
                <strong>{matatagSections.length}</strong>
                <span>building sections</span>
              </div>
              <div>
                <strong>{totals.total}</strong>
                <span>response items</span>
              </div>
              <Building2 aria-hidden="true" size={34} />
            </div>
          </div>
        </div>
        <div className={styles.workspace}>
          {!isMobile && navigation}
          <main id="assessment-content" className={styles.main}>
            {published.error && !recordId && (
              <div role="alert" className={styles.error}>
                Unable to load the current checklist. Your device draft is kept.
                <button onClick={() => published.refetch()}>Try again</button>
              </div>
            )}
            {record.error && (
              <div role="alert" className={styles.error}>
                {record.error.message}
                <button onClick={() => record.refetch()}>Try again</button>
              </div>
            )}
            {campusForm.error && (
              <div role="alert" className={styles.error}>
                {campusForm.error.message}
              </div>
            )}
            {storageError && (
              <div role="alert" className={styles.error}>
                {storageError}
              </div>
            )}
            {rawRecovery && (
              <div className={styles.notice}>
                <div>
                  <strong>Recovery copy available</strong>
                  <p>The unreadable device draft is preserved and will not be overwritten.</p>
                  <div className={styles.actions}>
                    <button onClick={() => downloadRawDraft(rawRecovery)}>
                      Download recovery copy
                    </button>
                    <button
                      onClick={() => {
                        localStorage.removeItem(storageKey);
                        setRawRecovery(null);
                        setStorageBlocked(false);
                        setStorageError('');
                      }}
                    >
                      Discard recovery copy
                    </button>
                  </div>
                </div>
              </div>
            )}
            {recoverable && (
              <div className={styles.notice}>
                <div>
                  <strong>A device draft has unsaved changes.</strong>
                  <p>
                    {recoverable.version === version
                      ? 'Restore it to continue your work.'
                      : 'The shared record has changed. Download the device draft to compare before editing.'}
                  </p>
                  <div className={styles.actions}>
                    {recoverable.version === version && (
                      <button
                        onClick={() => {
                          update(recoverable.document);
                          setRecoverable(null);
                        }}
                      >
                        Restore device draft
                      </button>
                    )}
                    <button onClick={() => downloadDraft(recoverable)}>
                      Download device draft
                    </button>
                    <button onClick={() => setRecoverable(null)}>Use shared record</button>
                  </div>
                </div>
              </div>
            )}
            {message && (
              <div role="status" aria-live="polite" className={styles.success}>
                <CheckCheck aria-hidden="true" size={19} />
                {message}
              </div>
            )}
            {errors.length > 0 && (
              <div ref={errorsRef} tabIndex={-1} role="alert" className={styles.error}>
                <strong>Please check your assessment</strong>
                <ul>
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                  {unansweredQuestions.length > 0 && (
                    <li>
                      Go to an unanswered question:
                      <ul className={styles.errorLinks}>
                        {unansweredQuestions.map((question) => {
                          const sectionIndex = matatagSections.findIndex(
                            (item) => item.id === question.sectionId
                          );
                          const section = matatagSections[sectionIndex];
                          return (
                            <li key={question.itemId}>
                              <button
                                type="button"
                                className={styles.errorLink}
                                onClick={() => go(sectionIndex + 1, question.itemId)}
                              >
                                Section {sectionIndex + 1}: {section?.title}, question{' '}
                                {question.number}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  )}
                </ul>
              </div>
            )}
            {!ready ? (
              <div className={styles.card}>
                <p role="status">
                  {record.error
                    ? 'The assessment could not be opened. Try again above or return to shared records.'
                    : 'Loading assessment…'}
                </p>
              </div>
            ) : (
              <>
                <div className={styles.sectionHeading}>
                  <span className={styles.stepLabel}>
                    {step === 0
                      ? 'Building assessment'
                      : step === reviewStep
                        ? 'Assessment summary'
                        : `Section ${step} of ${matatagSections.length}`}
                  </span>
                  <h2 ref={headingRef} tabIndex={-1}>
                    {step === 0
                      ? 'Assessment details'
                      : step === reviewStep
                        ? 'Review & finish'
                        : language === 'fil'
                          ? section.translation || section.title
                          : section.title}
                  </h2>
                  <p>
                    {step === 0
                      ? 'Tell us about the unit and buildings you are assessing.'
                      : step === reviewStep
                        ? 'Review your responses and comments before completing the assessment.'
                        : language === 'both'
                          ? section.translation
                          : language === 'fil'
                            ? 'Piliin ang Oo, Hindi, o N/A para sa bawat tanong.'
                            : 'Choose Yes, No, or N/A for each item.'}
                  </p>
                </div>
                <div className={styles.desktopToolbar}>{toolbar}</div>
                <form
                  className={styles.editorForm}
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (step === reviewStep) void saveShared(true);
                  }}
                >
                  <fieldset
                    className={styles.editorFields}
                    disabled={save.isPending || !!recoverable || responseLocked}
                  >
                    <legend className={styles.srOnly}>MATATAG assessment form</legend>
                    {step === 0 ? (
                      <>
                        <section className={styles.card}>
                          <div className={styles.cardTitle}>
                            <FileText aria-hidden="true" size={20} />
                            <h3>Unit & assessment information</h3>
                          </div>
                          <p className={styles.muted}>
                            Required when completing the assessment. You can save a partial draft.
                          </p>
                          <div className={styles.fieldGrid}>
                            <label className={styles.wide}>
                              Assessment phase <span>*</span>
                              {formId && campusForm.data ? (
                                <input
                                  value={
                                    campusForm.data.phase === 'POST'
                                      ? 'Post-assessment'
                                      : 'Pre-assessment'
                                  }
                                  readOnly
                                />
                              ) : (
                                <select
                                  name="phase"
                                  value={document.details.phase}
                                  onChange={(event) =>
                                    update({
                                      ...document,
                                      details: {
                                        ...document.details,
                                        phase: event.target.value as 'PRE' | 'POST',
                                      },
                                    })
                                  }
                                >
                                  <option value="PRE">Pre-assessment</option>
                                  <option value="POST">Post-assessment</option>
                                </select>
                              )}
                            </label>
                            <label className={styles.wide}>
                              UP constituent unit / campus <span>*</span>
                              <select
                                name="campusId"
                                autoComplete="organization"
                                aria-required="true"
                                disabled={
                                  isCampusLocked ||
                                  save.isPending ||
                                  !!recoverable ||
                                  responseLocked
                                }
                                value={document.details.campusId}
                                onChange={(e) => {
                                  if (isCampusLocked) return;
                                  const campus = campuses.data?.find(
                                    (c) => c.id === e.target.value
                                  );
                                  setIsOtherUnit(false);
                                  update({
                                    ...document,
                                    details: {
                                      ...document.details,
                                      campusId: e.target.value,
                                      campus: campus?.name ?? '',
                                      unit: '',
                                    },
                                  });
                                }}
                              >
                                <option value="" disabled>
                                  {campuses.isPending ? 'Loading campuses…' : 'Select your campus'}
                                </option>
                                {sortedCampuses.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {campuses.error && (
                              <p className={styles.error}>{campuses.error.message}</p>
                            )}
                            {user && campuses.data?.length === 0 && (
                              <p className={styles.notice}>
                                Ask your administrator to assign an active campus to your account.
                              </p>
                            )}
                            <label className={styles.wide}>
                              College / department / unit <span>*</span>
                              <select
                                name="unit"
                                aria-required="true"
                                disabled={
                                  !document.details.campusId ||
                                  isUnitLocked ||
                                  save.isPending ||
                                  !!recoverable
                                }
                                value={
                                  isOtherUnitActive ? OTHER_VALUE : document.details.unit || ''
                                }
                                onChange={(e) => {
                                  if (isUnitLocked) return;
                                  if (e.target.value === OTHER_VALUE) {
                                    setIsOtherUnit(true);
                                    update({
                                      ...document,
                                      details: { ...document.details, unit: '' },
                                    });
                                  } else {
                                    setIsOtherUnit(false);
                                    update({
                                      ...document,
                                      details: { ...document.details, unit: e.target.value },
                                    });
                                  }
                                }}
                              >
                                <option value="" disabled>
                                  {!document.details.campusId
                                    ? 'Select campus first'
                                    : campusClusters.isPending
                                      ? 'Loading colleges & units…'
                                      : 'Select college / department / unit'}
                                </option>
                                {sortedClusters.map((c) => (
                                  <option key={c.id} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                                <option value={OTHER_VALUE}>Other (please specify)</option>
                              </select>
                              {isOtherUnitActive && (
                                <input
                                  name="customUnit"
                                  type="text"
                                  autoComplete="off"
                                  aria-required="true"
                                  maxLength={4000}
                                  placeholder="Enter your college, department, or unit…"
                                  disabled={isUnitLocked}
                                  readOnly={isUnitLocked}
                                  value={document.details.unit}
                                  onChange={(e) => {
                                    if (isUnitLocked) return;
                                    update({
                                      ...document,
                                      details: { ...document.details, unit: e.target.value },
                                    });
                                  }}
                                />
                              )}
                            </label>
                            {fields.map((field) => {
                              const isLocked = field.key === 'evaluator' && isEvaluatorLocked;

                              return (
                                <label
                                  key={field.key}
                                  className={field.key === 'buildings' ? styles.wide : undefined}
                                >
                                  {field.label} <span>*</span>
                                  <input
                                    name={field.key}
                                    type={field.type ?? 'text'}
                                    inputMode={field.type === 'number' ? 'numeric' : undefined}
                                    autoComplete="off"
                                    aria-required="true"
                                    disabled={isLocked}
                                    readOnly={isLocked}
                                    value={document.details[field.key]}
                                    min={field.type === 'number' ? 1 : undefined}
                                    max={field.type === 'number' ? 9999 : undefined}
                                    step={field.type === 'number' ? 1 : undefined}
                                    maxLength={4000}
                                    placeholder={field.placeholder}
                                    onChange={(e) => {
                                      if (isLocked) return;
                                      update({
                                        ...document,
                                        details: {
                                          ...document.details,
                                          [field.key]: e.target.value,
                                        },
                                      });
                                    }}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </section>
                        <AssessmentInstructions />
                      </>
                    ) : step === reviewStep ? (
                      <>
                        <div className={styles.stats}>
                          {(
                            [
                              ['YES', 'Yes responses'],
                              ['NO', 'No responses'],
                              ['NA', 'Not applicable'],
                              ['unanswered', 'Unanswered'],
                            ] as const
                          ).map(([key, label]) => (
                            <div key={key}>
                              <strong>{totals[key]}</strong>
                              <span>{label}</span>
                            </div>
                          ))}
                        </div>
                        <div className={styles.notice}>
                          <Info aria-hidden="true" size={19} />
                          <p>
                            Scores are calculated automatically: positive items earn a point on Yes,
                            starred negative items earn a point on No, and every answered Yes, No,
                            or N/A response counts in the denominator.
                          </p>
                        </div>
                        <section className={styles.card}>
                          <h3>Section summary</h3>
                          <div className={styles.tableWrap}>
                            <table className={styles.summaryTable}>
                              <thead>
                                <tr>
                                  <th>Section</th>
                                  <th>Yes</th>
                                  <th>No</th>
                                  <th>N/A</th>
                                  <th>Score</th>
                                </tr>
                              </thead>
                              <tbody>
                                {matatagSections.map((s, index) => {
                                  const t = matatagTotals(document, s.id);
                                  return (
                                    <tr key={s.id}>
                                      <th>
                                        <button type="button" onClick={() => go(index + 1)}>
                                          {index + 1}.{' '}
                                          {language === 'fil' ? s.translation || s.title : s.title}
                                        </button>
                                      </th>
                                      <td>{t.YES}</td>
                                      <td>{t.NO}</td>
                                      <td>{t.NA}</td>
                                      <td>{matatagScore(document, s.id)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className={styles.calculatedScore}>
                            <span>Overall score</span>
                            <strong>{matatagScore(document)}</strong>
                            <small>Calculated from answered Yes, No, and N/A responses.</small>
                          </div>
                        </section>
                        <button
                          type="submit"
                          className={styles.primary}
                          disabled={save.isPending || responseLocked}
                        >
                          <CheckCheck aria-hidden="true" size={18} />
                          {save.isPending ? 'Saving…' : 'Complete & save assessment'}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className={styles.sectionOptions}>
                          <label>
                            <input
                              type="checkbox"
                              name={`not-applicable-${section.id}`}
                              checked={document.sections[section.id]?.notApplicable ?? false}
                              onChange={(e) => updateSection({ notApplicable: e.target.checked })}
                              disabled={responseLocked}
                            />
                            <span>This section is not applicable to this building</span>
                          </label>
                          <small>
                            {sectionTotals!.total - sectionTotals!.unanswered} /{' '}
                            {sectionTotals!.total} checklist items answered
                          </small>
                        </div>
                        {document.sections[section.id]?.notApplicable ? (
                          <div className={styles.card}>
                            <h3>Section marked N/A</h3>
                            <p>
                              All items in this section are counted as not applicable. Your previous
                              answers are kept if you enable the section again.
                            </p>
                          </div>
                        ) : (
                          <div className={styles.questions}>
                            {matatagQuestionUnits(section).map(({ item, children }) => (
                              <section
                                className={styles.question}
                                data-group={item.group}
                                key={item.id}
                              >
                                {renderQuestionHeader(item)}
                                {renderQuestionAnswers(item)}
                                {renderQuestionDetails(item)}
                                {children.length > 0 && (
                                  <div className={styles.subquestions}>
                                    {children.map((child) => (
                                      <div className={styles.subquestion} key={child.id}>
                                        {renderQuestion(child)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </section>
                            ))}
                          </div>
                        )}
                        <label className={styles.remarks}>
                          Section comments <span>(optional)</span>
                          <textarea
                            name={`section-comments-${section.id}`}
                            rows={3}
                            maxLength={4000}
                            value={document.sections[section.id]?.comments ?? ''}
                            onChange={(event) => updateSection({ comments: event.target.value })}
                            placeholder="Add section-level observations or follow-up actions..."
                          />
                        </label>
                      </>
                    )}
                  </fieldset>
                  <footer className={styles.formFooter}>
                    <div className={styles.footerNavigation}>
                      <button type="button" disabled={step === 0} onClick={() => go(step - 1)}>
                        <ArrowLeft aria-hidden="true" size={17} />
                        Previous
                      </button>
                      {step < reviewStep && (
                        <button
                          type="button"
                          className={styles.primary}
                          onClick={() => go(step + 1)}
                        >
                          {step === 0
                            ? 'Start checklist'
                            : step === matatagSections.length
                              ? 'Review'
                              : 'Next section'}
                          <ArrowRight aria-hidden="true" size={17} />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className={styles.saveDraftButton}
                      disabled={save.isPending || !!recoverable || responseLocked}
                      onClick={() => saveShared(false)}
                    >
                      <Save aria-hidden="true" size={17} />
                      {save.isPending ? 'Saving…' : 'Save draft'}
                    </button>
                  </footer>
                  <p className={styles.saveNote}>
                    {storageError
                      ? 'Download a copy to keep your work.'
                      : 'A recovery draft is saved on this device.'}{' '}
                    Use “Save draft” to make changes available in the system.
                  </p>
                </form>
              </>
            )}
          </main>
        </div>
        {isMobile && (
          <Popover.Root open={sectionsOpen} onOpenChange={setSectionsOpen}>
            <div className={styles.mobileDock}>
              <Popover.Trigger asChild>
                <button
                  className={styles.sectionTrigger}
                  aria-label="Assessment sections"
                  onPointerDown={(event) => {
                    swipeStart.current = null;
                    suppressSwipeClick.current = false;
                    if (!event.isPrimary || event.button !== 0) return;
                    swipeStart.current = { x: event.clientX, y: event.clientY };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerCancel={() => {
                    swipeStart.current = null;
                    suppressSwipeClick.current = false;
                  }}
                  onPointerUp={(event) => {
                    const start = swipeStart.current;
                    swipeStart.current = null;
                    if (!start) return;
                    const next = swipedStep(
                      event.clientX - start.x,
                      event.clientY - start.y,
                      step,
                      reviewStep
                    );
                    if (next === null) return;
                    suppressSwipeClick.current = true;
                    if (next !== step) go(next);
                  }}
                  onClick={(event) => {
                    if (suppressSwipeClick.current && event.detail !== 0) event.preventDefault();
                    suppressSwipeClick.current = false;
                  }}
                >
                  <ClipboardCheck aria-hidden="true" size={21} />
                  <span className={styles.triggerLabel}>
                    <strong>Sections</strong>
                    <small>
                      {step === 0
                        ? 'Assessment details'
                        : step === reviewStep
                          ? 'Review & finish'
                          : `${step}. ${language === 'fil' ? section.translation || section.title : section.title}`}
                    </small>
                  </span>
                  <span className={styles.triggerProgress}>{progress}%</span>
                  <ChevronUp
                    aria-hidden="true"
                    size={18}
                    className={sectionsOpen ? styles.chevronOpen : undefined}
                  />
                </button>
              </Popover.Trigger>
            </div>
            <Popover.Content
              className={styles.sectionPopover}
              side="top"
              align="center"
              sideOffset={12}
              collisionPadding={16}
              aria-label="Assessment sections"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                sectionNavRef.current
                  ?.querySelector<HTMLElement>('[aria-current="step"]')
                  ?.focus({ preventScroll: true });
              }}
              onCloseAutoFocus={(event) => {
                if (navigatingFromPopover.current) {
                  event.preventDefault();
                  navigatingFromPopover.current = false;
                  headingRef.current?.focus({ preventScroll: true });
                }
              }}
            >
              <div className={styles.popoverHeader}>
                <strong>Jump to a section</strong>
                <Popover.Close asChild>
                  <button aria-label="Close sections">
                    <X aria-hidden="true" size={18} />
                  </button>
                </Popover.Close>
              </div>
              <div className={styles.popoverToolbar}>{toolbar}</div>
              {navigation}
            </Popover.Content>
          </Popover.Root>
        )}
      </div>
      {ready && (
        <PrintAssessment
          document={document}
          language={language}
          status={dirty ? 'DRAFT — unsaved changes' : status}
        />
      )}
    </div>
  );
}

function AssessmentInstructions() {
  return (
    <section className={styles.instructions} aria-label="Instructions">
      <div className={styles.cardTitle}>
        <Info aria-hidden="true" size={20} />
        <h3>Instructions</h3>
      </div>
      <ol>
        <li>Fill in the necessary details and information about the unit being assessed.</li>
        <li>Assess the sections present in the building. Mark other sections as not applicable.</li>
        <li>
          Select the answer that best describes each item. Mark sections that do not apply as N/A.
        </li>
        <li>Review your answers and save the assessment. Scores are calculated automatically.</li>
      </ol>
    </section>
  );
}

function PrintAssessment({
  document,
  status,
  language,
}: {
  document: MatatagDocument;
  status: string;
  language: QuestionLanguage;
}) {
  return (
    <article className={styles.printOnly}>
      <header className={styles.printHeader}>
        <Image src="/up-logo.png" alt="" width={46} height={46} />
        <div>
          <h1>MATATAG assessment report</h1>
          <p>Monitoring and Assessment Tool for Area Threats and Accident Generators</p>
          <p>UP Resilience Institute - Updated June 29, 2026</p>
        </div>
        <strong>{status}</strong>
      </header>
      <h2>Assessment details</h2>
      <dl className={styles.printDetails}>
        <div>
          <dt>Assessment phase</dt>
          <dd>{document.details.phase === 'POST' ? 'Post-assessment' : 'Pre-assessment'}</dd>
        </div>
        <div>
          <dt>UP constituent unit / campus</dt>
          <dd>{document.details.campus || '—'}</dd>
        </div>
        <div>
          <dt>College / department / unit</dt>
          <dd>{document.details.unit || '—'}</dd>
        </div>
        {fields.map((f) => (
          <div key={f.key}>
            <dt>{f.label}</dt>
            <dd>{document.details[f.key] || '—'}</dd>
          </div>
        ))}
        <div>
          <dt>Time ended</dt>
          <dd>{document.details.timeEnd || '—'}</dd>
        </div>
        <div>
          <dt>Overall score (calculated)</dt>
          <dd>{matatagScore(document)}</dd>
        </div>
      </dl>
      <AssessmentInstructions />
      <p>
        Scores use the system rule: positive items earn on Yes; starred negative items earn on No;
        Yes, No, and N/A count in the denominator.
      </p>
      <section className={styles.printSummary}>
        <h2>Section summary</h2>
        <table>
          <thead>
            <tr>
              <th>Section</th>
              <th>Yes</th>
              <th>No</th>
              <th>N/A</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {assessmentSections(document).map((section, index) => {
              const total = matatagTotals(document, section.id);
              return (
                <tr key={section.id}>
                  <th>
                    {index + 1}. {section.title}
                  </th>
                  <td>{total.YES}</td>
                  <td>{total.NO}</td>
                  <td>{total.NA}</td>
                  <td>{matatagScore(document, section.id)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {assessmentSections(document).map((s, index) => {
        const t = matatagTotals(document, s.id);
        return (
          <section key={s.id} className={styles.printSection}>
            <h2>
              {index + 1}. {language === 'fil' ? s.translation || s.title : s.title}
            </h2>
            {language === 'both' && <p lang="fil">{s.translation}</p>}
            <p>
              Yes: {t.YES} · No: {t.NO} · N/A: {t.NA} · Unanswered: {t.unanswered} · Score:{' '}
              {matatagScore(document, s.id)}
            </p>
            {document.sections[s.id]?.notApplicable ? (
              <p>Entire section: Not applicable</p>
            ) : (
              s.items.map((i) => (
                <div key={i.id} className={styles.printQuestion}>
                  <p>
                    <strong>
                      {i.number}
                      {i.starred ? '*' : ''}.
                    </strong>{' '}
                  </p>
                  <QuestionCopy text={i.text} language={language} />
                  {i.text.reference && <p>{i.text.reference}</p>}
                  <p>
                    <strong>
                      {i.group ? 'Question result' : 'Response'}:{' '}
                      {matatagAnswerLabel(document, s.id, i, language)}
                    </strong>
                  </p>
                  {document.remarks[i.id] && <p>Remarks: {document.remarks[i.id]}</p>}
                </div>
              ))
            )}
            {document.sections[s.id]?.comments && (
              <p>Section comments: {document.sections[s.id].comments}</p>
            )}
          </section>
        );
      })}
      <footer>
        Checklist developed by the UP Resilience Institute — Institution Building Division (Ver.
        July 25, 2025). Last updated June 29, 2026.
      </footer>
    </article>
  );
}

function QuestionCopy({ text, language }: { text: QuestionText; language: QuestionLanguage }) {
  return (
    <>
      {language !== 'fil' && <p lang="en">{text.en}</p>}
      {language !== 'en' && (
        <p lang="fil" className={language === 'both' ? styles.translation : undefined}>
          {text.fil || (language === 'fil' ? text.en : '')}
        </p>
      )}
    </>
  );
}
