import { redirect } from 'next/navigation';

export default function TeacherAnnouncementDetailPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/teacher/announcements?id=${params.id}`);
}
