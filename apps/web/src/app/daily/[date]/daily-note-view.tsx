'use client';

import useSWR from 'swr';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { NodeList } from '@/components/nodes/node-list';
import { api } from '@/lib/api';
import { formatDate, offsetDate, todayISO } from '@/lib/utils';

interface Props {
  date: string;
}

export function DailyNoteView({ date }: Props) {
  const today = todayISO();

  const { data: note, mutate: mutateNote } = useSWR(
    ['daily-note', date],
    () => api.getDailyNote(date),
    { revalidateOnFocus: true, refreshInterval: 2000 },
  );

  const { data: tags, mutate: mutateTags } = useSWR('tags', api.getTags, {
    revalidateOnFocus: false,
  });

  function handleMutate() {
    void mutateNote();
    void mutateTags();
  }

  return (
    <AppLayout currentDate={date}>
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link
              href={`/daily/${offsetDate(date, -1)}`}
              className="w-7 h-7 flex items-center justify-center rounded-md transition-colors duration-100"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronLeft size={16} />
            </Link>
            <div>
              <h1
                className="text-xl font-semibold leading-tight"
                style={{ color: 'var(--text)' }}
              >
                {formatDate(date)}
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                {date}
              </p>
            </div>
            {date < today && (
              <Link
                href={`/daily/${offsetDate(date, 1)}`}
                className="w-7 h-7 flex items-center justify-center rounded-md transition-colors duration-100"
                style={{ color: 'var(--text-muted)' }}
              >
                <ChevronRight size={16} />
              </Link>
            )}
          </div>

          {date !== today && (
            <Link
              href={`/daily/${today}`}
              className="text-xs px-3 py-1.5 rounded-md transition-colors duration-100"
              style={{
                background: 'var(--bg-raised)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              Today
            </Link>
          )}
        </div>

        {/* Node list */}
        {note ? (
          <NodeList
            nodes={note.nodes}
            tags={tags ?? []}
            dailyNoteDate={date}
            onMutate={handleMutate}
          />
        ) : (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-6 rounded-md animate-pulse"
                style={{ background: 'var(--bg-raised)', width: `${60 + i * 15}%` }}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
