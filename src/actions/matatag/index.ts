'use server';

import {
  MATATAG_VERSION,
  assessmentSections,
  matatagCompletionErrors,
  withCalculatedScores,
  type MatatagDocument,
} from '@/lib/matatag';
import {
  canManageMatatagForm,
  canSaveMatatagCampus,
  canSubmitMatatagForm,
  matatagAccessScope,
  matatagAssignedOrganization,
} from '@/lib/matatag-access';
import { defaultMatatagTemplate, matatagTemplateSchema } from '@/lib/matatag-template';
import { prisma } from '@/lib/prisma';
import { matatagDocumentSchema } from '@/lib/schemas';
import { Prisma } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

class AssessmentError extends Error {}

export type MatatagDashboardRecord = {
  id: string;
  building: string;
  evaluator: string;
  respondent: string;
  status: string;
  phase: string;
  formId: string | null;
  formTitle: string;
  campus: { id: string; name: string };
  updatedAt: string;
  overallScore: number | null;
  sections: { id: string; title: string; score: number | null }[];
};

async function actor(token: string) {
  if (typeof token !== 'string' || !token || token.length > 10000)
    throw new AssessmentError('Sign in to access shared assessments.');
  const auth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user)
    throw new AssessmentError('Your session has expired. Please sign in again.');
  const user = await prisma.user.findUnique({
    where: { auth_id: data.user.id },
    include: {
      user_type: true,
      cluster: { select: { name: true } },
      unit: { select: { name: true, cluster: { select: { name: true } } } },
    },
  });
  if (!user?.is_active) throw new AssessmentError('An active account is required.');
  if (!['ERT Member', 'Administrator', 'Super Admin'].includes(user.user_type.name))
    throw new AssessmentError('Your account cannot access MATATAG assessments.');
  return user;
}

function failure(error: unknown) {
  if (error instanceof AssessmentError) return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? 'Check the assessment fields.' };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error('MATATAG operation failed', error.code, error.meta);
    if (error.code === 'P2021' || error.code === 'P2022')
      return {
        error:
          'The MATATAG database schema is not installed. Apply the MATATAG migrations, then reload this page.',
      };
  } else {
    console.error(
      'MATATAG operation failed',
      error instanceof Error ? error.name : 'Unknown error'
    );
  }
  return {
    error:
      'The assessment service is unavailable. Your device draft is kept. Please try again or contact your administrator.',
  };
}

async function publishedTemplate(id?: string) {
  if (id === MATATAG_VERSION)
    return { id: MATATAG_VERSION, revision: 0, formId: null, definition: defaultMatatagTemplate };
  const row = id
    ? await prisma.matatagTemplate.findUnique({ where: { id } })
    : await prisma.matatagTemplate.findFirst({
        where: { form_id: null },
        orderBy: { revision: 'desc' },
      });
  if (!row) {
    if (id) throw new AssessmentError('This assessment checklist version is unavailable.');
    return { id: MATATAG_VERSION, revision: 0, formId: null, definition: defaultMatatagTemplate };
  }
  return {
    id: row.id,
    revision: row.revision,
    formId: row.form_id ?? null,
    definition: matatagTemplateSchema.parse(row.definition),
  };
}

async function canonicalDocument(input: MatatagDocument, formId: string | null = null) {
  const published = await publishedTemplate(input.version);
  if (published.formId !== formId)
    throw new AssessmentError('The checklist does not belong to this assessment.');
  return matatagDocumentSchema.parse({ ...input, template: published.definition });
}

export async function getMatatagTemplate() {
  try {
    return { data: await publishedTemplate() };
  } catch (error) {
    return failure(error);
  }
}

export async function publishMatatagTemplate(token: string, input: unknown) {
  try {
    const user = await actor(token);
    if (user.user_type.name !== 'Super Admin')
      throw new AssessmentError('Only Super Admin users can edit the MATATAG checklist.');
    const values = z
      .object({ revision: z.number().int().min(0), definition: matatagTemplateSchema })
      .parse(input);
    const current = await publishedTemplate();
    if (current.revision !== values.revision)
      throw new AssessmentError(
        'Another Super Admin published changes. Reload the editor before publishing.'
      );
    const row = await prisma.matatagTemplate.create({
      data: { revision: values.revision + 1, definition: values.definition, created_by: user.id },
    });
    revalidatePath('/matatag');
    revalidatePath('/assessments/matatag/template');
    return { data: { id: row.id, revision: row.revision, definition: values.definition } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return {
        error: 'Another Super Admin published changes. Reload the editor before publishing.',
      };
    return failure(error);
  }
}

async function campusForm(user: Awaited<ReturnType<typeof actor>>, id: string, manage = false) {
  const form = await prisma.matatagForm.findFirst({
    where: {
      id: z.string().uuid().parse(id),
      campus: { is_active: true },
      ...(user.user_type.name === 'Super Admin' ? {} : { campus_id: user.campus_id ?? '' }),
    },
    include: {
      campus: { select: { id: true, name: true } },
      assignments: {
        select: {
          user_id: true,
          user: { select: { id: true, first_name: true, last_name: true, username: true } },
        },
      },
    },
  });
  if (!form || (manage && !canManageMatatagForm(user, form.campus_id)))
    throw new AssessmentError('Assessment not found or access is unavailable for your campus.');
  return form;
}

async function validateAssignedUsers(campusId: string, userIds: string[]) {
  if (new Set(userIds).size !== userIds.length)
    throw new AssessmentError('Assigned users must be unique.');
  if (!userIds.length) return;
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      campus_id: campusId,
      is_active: true,
      user_type: { name: { in: ['ERT Member', 'Administrator', 'Super Admin'] } },
    },
    select: { id: true },
  });
  if (users.length !== userIds.length)
    throw new AssessmentError('Select active MATATAG users from the assigned campus.');
}

export async function getMatatagForms(token: string, page = 1, query = '') {
  try {
    const user = await actor(token);
    if (!['Super Admin', 'Administrator'].includes(user.user_type.name))
      throw new AssessmentError('An administrator account is required.');
    const validPage = z.number().int().min(1).max(100000).parse(page);
    const search = z.string().max(200).parse(query).trim();
    const where = {
      ...(user.user_type.name === 'Super Admin' ? {} : { campus_id: user.campus_id ?? '' }),
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
    };
    const [forms, total] = await Promise.all([
      prisma.matatagForm.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        take: 20,
        skip: (validPage - 1) * 20,
        include: { campus: { select: { name: true } }, _count: { select: { responses: true } } },
      }),
      prisma.matatagForm.count({ where }),
    ]);
    return {
      data: {
        forms: forms.map((f) => ({
          ...f,
          created_at: f.created_at.toISOString(),
          updated_at: f.updated_at.toISOString(),
        })),
        total,
      },
    };
  } catch (error) {
    return failure(error);
  }
}

export async function getMatatagAssignableUsers(token: string, campusId: string) {
  try {
    const user = await actor(token);
    const targetCampus = z.string().uuid().parse(campusId);
    if (user.user_type.name !== 'Super Admin' && user.campus_id !== targetCampus)
      throw new AssessmentError('Users can only be selected from your campus.');
    return {
      data: await prisma.user.findMany({
        where: {
          campus_id: targetCampus,
          is_active: true,
          user_type: { name: { in: ['ERT Member', 'Administrator', 'Super Admin'] } },
        },
        select: { id: true, first_name: true, last_name: true, username: true },
        orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }, { username: 'asc' }],
      }),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function createMatatagForm(token: string, input: unknown) {
  try {
    const user = await actor(token);
    if (user.user_type.name !== 'Super Admin')
      throw new AssessmentError('Only Super Admin users can create a campus assessment.');
    const values = z
      .object({
        title: z.string().trim().min(1).max(200),
        campusId: z.string().uuid(),
        phase: z.enum(['PRE', 'POST']).default('PRE'),
        accessMode: z.enum(['CAMPUS', 'ASSIGNED']).default('CAMPUS'),
        userIds: z.array(z.string().uuid()).max(500).default([]),
      })
      .parse(input);
    if (values.accessMode === 'ASSIGNED' && values.userIds.length === 0)
      throw new AssessmentError('Select at least one assigned user.');
    await validateAssignedUsers(values.campusId, values.userIds);
    const campus = await prisma.campus.findFirst({
      where: { id: values.campusId, is_active: true },
      select: { id: true },
    });
    if (!campus) throw new AssessmentError('Select an active campus.');
    const template = await publishedTemplate();
    const form = await prisma.$transaction(async (tx) => {
      const created = await tx.matatagForm.create({
        data: {
          title: values.title,
          campus_id: campus.id,
          phase: values.phase,
          access_mode: values.accessMode,
          created_by: user.id,
        },
      });
      await tx.matatagTemplate.create({
        data: {
          form_id: created.id,
          revision: 1,
          definition: template.definition,
          created_by: user.id,
        },
      });
      if (values.userIds.length)
        await tx.matatagFormAssignment.createMany({
          data: values.userIds.map((userId) => ({
            form_id: created.id,
            user_id: userId,
            created_by: user.id,
          })),
        });
      return created;
    });
    revalidatePath('/assessments');
    return { data: { id: form.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function getMatatagForm(token: string, id: string) {
  try {
    const user = await actor(token);
    const form = await campusForm(user, id);
    const canManage = canManageMatatagForm(user, form.campus_id);
    if (!canManage && !canSubmitMatatagForm(user, form))
      throw new AssessmentError('This assessment is not available to your account.');
    const template = await prisma.matatagTemplate.findFirst({
      where: { form_id: form.id },
      orderBy: { revision: 'desc' },
    });
    if (!template) throw new AssessmentError('The assessment checklist is unavailable.');
    return {
      data: {
        id: form.id,
        title: form.title,
        campus: form.campus,
        isOpen: form.is_open,
        phase: form.phase,
        accessMode: form.access_mode,
        version: form.version,
        canManage,
        canSubmit: canSubmitMatatagForm(user, form),
        assignments: form.assignments.map((assignment) => ({
          id: assignment.user.id,
          name:
            [assignment.user.first_name, assignment.user.last_name].filter(Boolean).join(' ') ||
            assignment.user.username,
        })),
        template: {
          id: template.id,
          revision: template.revision,
          definition: matatagTemplateSchema.parse(template.definition),
        },
      },
    };
  } catch (error) {
    return failure(error);
  }
}

export async function publishCampusMatatagTemplate(token: string, id: string, input: unknown) {
  try {
    const user = await actor(token);
    const form = await campusForm(user, id, true);
    const values = z
      .object({ revision: z.number().int().min(1), definition: matatagTemplateSchema })
      .parse(input);
    const current = await prisma.matatagTemplate.findFirst({
      where: { form_id: form.id },
      orderBy: { revision: 'desc' },
    });
    if (!current || current.revision !== values.revision)
      throw new AssessmentError(
        'Another administrator published changes. Reload before publishing.'
      );
    const row = await prisma.$transaction(async (tx) => {
      const saved = await tx.matatagTemplate.create({
        data: {
          form_id: form.id,
          revision: values.revision + 1,
          definition: values.definition,
          created_by: user.id,
        },
      });
      await tx.matatagForm.update({ where: { id: form.id }, data: { version: { increment: 1 } } });
      return saved;
    });
    revalidatePath(`/assessments/matatag/${form.id}`);
    return { data: { id: row.id, revision: row.revision, definition: values.definition } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return { error: 'Another administrator published changes. Reload before publishing.' };
    return failure(error);
  }
}

export async function updateMatatagForm(token: string, id: string, input: unknown) {
  try {
    const user = await actor(token);
    const form = await campusForm(user, id, true);
    const values = z
      .object({
        version: z.number().int().min(1),
        title: z.string().trim().min(1).max(200),
        isOpen: z.boolean(),
        phase: z.enum(['PRE', 'POST']).optional(),
        accessMode: z.enum(['CAMPUS', 'ASSIGNED']).optional(),
        userIds: z.array(z.string().uuid()).max(500).optional(),
      })
      .parse(input);
    const phase = values.phase ?? form.phase;
    const accessMode = values.accessMode ?? form.access_mode;
    const userIds = values.userIds ?? form.assignments.map((assignment) => assignment.user_id);
    if (accessMode === 'ASSIGNED' && userIds.length === 0)
      throw new AssessmentError('Select at least one assigned user.');
    await validateAssignedUsers(form.campus_id, userIds);
    await prisma.$transaction(async (tx) => {
      const changed = await tx.matatagForm.updateMany({
        where: { id: form.id, version: values.version },
        data: {
          title: values.title,
          is_open: values.isOpen,
          phase,
          access_mode: accessMode,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new AssessmentError('This assessment changed. Reload before saving.');
      await tx.matatagFormAssignment.deleteMany({ where: { form_id: form.id } });
      if (userIds.length)
        await tx.matatagFormAssignment.createMany({
          data: userIds.map((userId) => ({
            form_id: form.id,
            user_id: userId,
            created_by: user.id,
          })),
        });
    });
    revalidatePath('/assessments');
    revalidatePath(`/assessments/matatag/${form.id}`);
    return { data: { id: form.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function getMatatagCampuses(token: string) {
  try {
    const user = await actor(token);
    const where = user.user_type.name === 'Super Admin' ? {} : { id: user.campus_id ?? '' };
    if (user.user_type.name !== 'Super Admin' && !user.campus_id) return { data: [] };
    return {
      data: await prisma.campus.findMany({
        where: { ...where, is_active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function getMatatagAssessments(
  token: string,
  page = 1,
  query = '',
  formId?: string,
  generalOnly = false
) {
  try {
    const user = await actor(token);
    if (formId) await campusForm(user, formId);
    const validPage = z.number().int().min(1).max(100000).parse(page);
    const search = z.string().max(200).parse(query).trim();
    const where = {
      ...matatagAccessScope(user),
      ...(generalOnly ? { form_id: null } : formId ? { form_id: formId } : {}),
      ...(search
        ? {
            OR: [
              { building: { contains: search, mode: 'insensitive' as const } },
              { evaluator: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [records, total] = await Promise.all([
      prisma.matatagAssessment.findMany({
        where,
        select: {
          id: true,
          building: true,
          evaluator: true,
          status: true,
          phase: true,
          updated_at: true,
          version: true,
          form_id: true,
          user: { select: { id: true, first_name: true, last_name: true, username: true } },
          campus: { select: { name: true } },
        },
        orderBy: { updated_at: 'desc' },
        take: 20,
        skip: (validPage - 1) * 20,
      }),
      prisma.matatagAssessment.count({ where }),
    ]);
    return {
      data: {
        records: records.map((r) => ({ ...r, updated_at: r.updated_at.toISOString() })),
        total,
      },
    };
  } catch (error) {
    return failure(error);
  }
}

function percentageValue(value: string | undefined) {
  const score = Number.parseFloat(value ?? '');
  return Number.isFinite(score) ? score : null;
}

export async function getMatatagDashboard(token: string) {
  try {
    const user = await actor(token);
    if (!['Super Admin', 'Administrator'].includes(user.user_type.name))
      throw new AssessmentError(
        'An administrator account is required to view the MATATAG dashboard.'
      );
    const records = await prisma.matatagAssessment.findMany({
      where: matatagAccessScope(user),
      select: {
        id: true,
        building: true,
        evaluator: true,
        status: true,
        phase: true,
        form_id: true,
        updated_at: true,
        document: true,
        campus: { select: { id: true, name: true } },
        form: { select: { id: true, title: true } },
        user: { select: { first_name: true, last_name: true, username: true } },
      },
      orderBy: { updated_at: 'desc' },
      take: 5000,
    });
    const dashboardRecords: MatatagDashboardRecord[] = records.flatMap((record) => {
      try {
        const document = matatagDocumentSchema.parse(record.document);
        return [
          {
            id: record.id,
            building:
              record.building.trim() || document.details.buildings.trim() || 'Unnamed building',
            evaluator: record.evaluator,
            respondent:
              [record.user.first_name, record.user.last_name].filter(Boolean).join(' ') ||
              record.user.username,
            status: record.status,
            phase: record.phase,
            formId: record.form_id,
            formTitle: record.form?.title ?? 'General MATATAG form',
            campus: record.campus,
            updatedAt: record.updated_at.toISOString(),
            overallScore: percentageValue(document.details.overallScore),
            sections: assessmentSections(document).map((section) => ({
              id: section.id,
              title: section.title,
              score: percentageValue(document.sections[section.id]?.score),
            })),
          },
        ];
      } catch {
        return [];
      }
    });
    return {
      data: {
        records: dashboardRecords,
        truncated: records.length === 5000,
      },
    };
  } catch (error) {
    return failure(error);
  }
}

export async function getMatatagAssessment(token: string, id: string, formId?: string) {
  try {
    const user = await actor(token);
    const record = await prisma.matatagAssessment.findFirst({
      where: {
        id: z.string().uuid().parse(id),
        ...matatagAccessScope(user),
        ...(formId ? { form_id: z.string().uuid().parse(formId) } : {}),
      },
    });
    if (!record) throw new AssessmentError('Assessment not found or access is unavailable.');
    return {
      data: {
        id: record.id,
        version: record.version,
        status: record.status,
        formId: record.form_id,
        isOwner: record.user_id === user.id,
        document: await canonicalDocument(
          matatagDocumentSchema.parse(record.document),
          record.form_id
        ),
      },
    };
  } catch (error) {
    return failure(error);
  }
}

export async function saveMatatagAssessment(token: string, input: unknown) {
  try {
    const user = await actor(token);
    const values = z
      .object({
        id: z.string().uuid(),
        version: z.number().int().min(0),
        complete: z.boolean(),
        formId: z.string().uuid().optional(),
        document: matatagDocumentSchema,
      })
      .parse(input);
    const form = values.formId ? await campusForm(user, values.formId) : null;
    if (form && !canSubmitMatatagForm(user, form))
      throw new AssessmentError(
        !form.is_open
          ? 'This assessment is closed for responses.'
          : form.access_mode === 'ASSIGNED'
            ? 'This assessment is restricted to its assigned users.'
            : 'Only users assigned to this campus can submit responses.'
      );
    const document = withCalculatedScores(
      await canonicalDocument(values.document, values.formId ?? null)
    );
    if (user.campus_id) document.details.campusId = user.campus_id;
    const assignedOrganization = matatagAssignedOrganization(user);
    if (assignedOrganization) document.details.unit = assignedOrganization;
    const evaluator = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
    if (evaluator) document.details.evaluator = evaluator;
    if (form && document.details.phase !== form.phase)
      throw new AssessmentError('The response phase must match the assessment.');
    if (form && document.details.campusId !== form.campus_id)
      throw new AssessmentError('The response campus must match the assessment campus.');
    if (!document.details.campusId)
      throw new AssessmentError('Select a campus before saving to the shared system.');
    if (!canSaveMatatagCampus(user, document.details.campusId))
      throw new AssessmentError('Select the campus assigned to your account.');
    const campus = await prisma.campus.findFirst({
      where: { id: document.details.campusId, is_active: true },
    });
    if (!campus) throw new AssessmentError('Select an active campus.');
    document.details.campus = campus.name;
    if (values.complete) {
      if (!document.details.timeEnd?.trim()) {
        const now = new Date();
        document.details.timeEnd = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      }
      const errors = matatagCompletionErrors(document);
      if (errors.length) throw new AssessmentError(errors.join(' '));
    }
    const data = {
      form_id: values.formId ?? null,
      phase: document.details.phase,
      campus_id: campus.id,
      building: document.details.buildings.trim() || 'Untitled assessment',
      evaluator: document.details.evaluator.trim(),
      document,
      status: values.complete ? 'COMPLETED' : 'DRAFT',
    };
    const result = await prisma.$transaction(async (tx) => {
      if (values.version === 0) {
        const existing = await tx.matatagAssessment.findUnique({
          where: { id: values.id },
          select: { id: true },
        });
        if (existing)
          throw new AssessmentError(
            'This assessment was already saved. Reopen it from shared records before saving again.'
          );
        return tx.matatagAssessment.create({
          data: { ...data, id: values.id, user_id: user.id },
          select: { id: true, version: true, status: true },
        });
      }
      const existing = await tx.matatagAssessment.findFirst({
        where: { id: values.id, ...matatagAccessScope(user) },
        select: { document: true, form_id: true, user_id: true, status: true },
      });
      if (!existing || matatagDocumentSchema.parse(existing.document).version !== document.version)
        throw new AssessmentError(
          'The checklist version of an existing assessment cannot be changed.'
        );
      if (existing.form_id !== (values.formId ?? null))
        throw new AssessmentError('A response cannot be moved to another assessment.');
      if (existing.form_id && (existing.user_id !== user.id || existing.status === 'COMPLETED'))
        throw new AssessmentError(
          existing.user_id !== user.id
            ? 'Only the respondent can edit these answers.'
            : 'This response is submitted. Ask a campus administrator to reopen it.'
        );
      const updated = await tx.matatagAssessment.updateMany({
        where: { id: values.id, version: values.version, ...matatagAccessScope(user) },
        data: { ...data, version: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new AssessmentError(
          'This assessment changed or access is unavailable. Download your draft, then reopen the shared record before saving.'
        );
      return { id: values.id, version: values.version + 1, status: data.status };
    });
    revalidatePath('/matatag');
    revalidatePath('/matatag/assessments');
    revalidatePath('/assessments');
    if (form) revalidatePath(`/assessments/matatag/${form.id}`);
    return { data: { ...result, document } };
  } catch (error) {
    return failure(error);
  }
}

export async function reopenMatatagResponse(
  token: string,
  formId: string,
  id: string,
  version: number
) {
  try {
    const user = await actor(token);
    const form = await campusForm(user, formId, true);
    const changed = await prisma.matatagAssessment.updateMany({
      where: {
        id: z.string().uuid().parse(id),
        form_id: form.id,
        campus_id: form.campus_id,
        version: z.number().int().min(1).parse(version),
        status: 'COMPLETED',
      },
      data: { status: 'DRAFT', version: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new AssessmentError('This response changed or is already open. Refresh the responses.');
    revalidatePath(`/assessments/matatag/${form.id}`);
    return { data: { id } };
  } catch (error) {
    return failure(error);
  }
}
