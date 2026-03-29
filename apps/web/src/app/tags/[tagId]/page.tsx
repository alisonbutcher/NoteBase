import { TagLensView } from './tag-lens-view';

interface Props {
  params: Promise<{ tagId: string }>;
}

export default async function TagLensPage({ params }: Props) {
  const { tagId } = await params;
  return <TagLensView tagId={tagId} />;
}
