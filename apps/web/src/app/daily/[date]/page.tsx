import { DailyNoteView } from './daily-note-view';

interface Props {
  params: Promise<{ date: string }>;
}

export default async function DailyNotePage({ params }: Props) {
  const { date } = await params;
  return <DailyNoteView date={date} />;
}
