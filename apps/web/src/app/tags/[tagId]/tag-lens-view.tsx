'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { TagChip } from '@/components/nodes/tag-chip';
import { api, type TagLensNode, type TagRecord } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Props {
  tagId: string;
}

function groupByDate(nodes: TagLensNode[]): Map<string, TagLensNode[]> {
  const map = new Map<string, TagLensNode[]>();
  for (const node of nodes) {
    const group = map.get(node.dailyNoteDate) ?? [];
    group.push(node);
    map.set(node.dailyNoteDate, group);
  }
  return map;
}

function LensNode({ node, tagRecord }: { node: TagLensNode; tagRecord?: TagRecord }) {
  return (
    <div
      className="group flex items-start gap-2 px-2 py-1.5 rounded-md transition-colors duration-100"
      style={{ paddingLeft: `${(0 * 20) + 8}px` }}
    >
      <span
        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: tagRecord?.color ?? 'var(--accent)' }}
      />
      <div className="flex-1 min-w-0">
        <Link
          href={`/daily/${node.dailyNoteDate}`}
          className="text-sm hover:underline"
          style={{ color: 'var(--text)' }}
        >
          {node.content || <span style={{ color: 'var(--text-subtle)' }}>(empty)</span>}
        </Link>
      </div>
    </div>
  );
}

export function TagLensView({ tagId }: Props) {
  const { data: lens } = useSWR(
    ['tag-lens', tagId],
    () => api.getTagLens(tagId),
    { revalidateOnFocus: true, refreshInterval: 3000 },
  );

  const { data: tags } = useSWR('tags', api.getTags, { revalidateOnFocus: false });
  const tagRecord = tags?.find((t) => t.tagId === tagId);

  const grouped = lens ? groupByDate(lens.nodes) : null;
  const dateGroups = grouped ? [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])) : [];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold"
            style={{
              background: tagRecord?.color ? `${tagRecord.color}20` : 'var(--tag-bg)',
              color: tagRecord?.color ?? 'var(--accent)',
            }}
          >
            #
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
              {lens?.tagName ?? tagRecord?.tagName ?? '…'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              {lens ? `${lens.nodes.length} note${lens.nodes.length !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
        </div>

        {/* Tag chip preview */}
        {tagRecord && (
          <div className="mb-6">
            <TagChip tagName={tagRecord.tagName} tagRecord={tagRecord} />
          </div>
        )}

        {/* Grouped nodes */}
        {!lens ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-6 rounded-md animate-pulse"
                style={{ background: 'var(--bg-raised)', width: `${50 + i * 12}%` }}
              />
            ))}
          </div>
        ) : dateGroups.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
            No notes tagged with this tag yet.
          </p>
        ) : (
          <div className="space-y-6">
            {dateGroups.map(([date, nodes]) => (
              <section key={date}>
                <Link
                  href={`/daily/${date}`}
                  className="block mb-2 text-xs font-medium uppercase tracking-wider transition-colors duration-100"
                  style={{ color: 'var(--text-subtle)' }}
                >
                  {formatDate(date)} · {date}
                </Link>
                <div className="space-y-0.5">
                  {nodes.map((node) => (
                    <LensNode key={node.nodeId} node={node} tagRecord={tagRecord} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
