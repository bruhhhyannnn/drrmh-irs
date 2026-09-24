import { redirect } from 'next/navigation';

export default function ViewCampusAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => redirect(`/assessments/matatag/${id}`));
}
