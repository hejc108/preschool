import { redirect } from 'next/navigation';

export default function ParentAnnouncementDetailPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/parent/announcements?id=${params.id}`);
}
