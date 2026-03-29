'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Hash, ChevronLeft, ChevronRight } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { formatDate, offsetDate, todayISO } from '@/lib/utils';
import useSWR from 'swr';
import { api, type TagRecord } from '@/lib/api';

interface SidebarProps {
  currentDate?: string;
}

function DateItem({ date, current }: { date: string; current: boolean }) {
  const label = formatDate(date);
  return (
    <Link
      href={`/daily/${date}`}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors duration-100 group"
      style={{
        background: current ? 'var(--bg-active)' : 'transparent',
        color: current ? 'var(--text)' : 'var(--text-muted)',
      }}
    >
      <CalendarDays size={14} style={{ opacity: 0.6 }} />
      <span>{label}</span>
    </Link>
  );
}

function TagItem({ tag, active }: { tag: TagRecord; active: boolean }) {
  const dotColor = tag.color ?? 'var(--accent)';
  return (
    <Link
      href={`/tags/${tag.tagId}`}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors duration-100"
      style={{
        background: active ? 'var(--bg-active)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-muted)',
      }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: dotColor }}
      />
      <span className="truncate">{tag.tagName}</span>
    </Link>
  );
}

export function Sidebar({ currentDate }: SidebarProps) {
  const pathname = usePathname();
  const today = todayISO();

  const { data: tags } = useSWR('tags', api.getTags, {
    revalidateOnFocus: false,
  });

  const dates = [
    today,
    offsetDate(today, -1),
    offsetDate(today, -2),
    offsetDate(today, -3),
    offsetDate(today, -4),
    offsetDate(today, -5),
    offsetDate(today, -6),
  ];

  return (
    <aside
      className="flex flex-col h-full shrink-0 overflow-hidden"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--bg-raised)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--text)' }}>
          NoteBase
        </span>
        <ThemeToggle />
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {/* Date navigation */}
        <section>
          <div className="flex items-center justify-between px-3 mb-1">
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--text-subtle)' }}
            >
              Journal
            </span>
            <div className="flex items-center gap-0.5">
              {currentDate && currentDate > dates[6] && (
                <Link
                  href={`/daily/${offsetDate(currentDate, -1)}`}
                  className="w-5 h-5 flex items-center justify-center rounded"
                  style={{ color: 'var(--text-subtle)' }}
                >
                  <ChevronLeft size={12} />
                </Link>
              )}
              {currentDate && currentDate < today && (
                <Link
                  href={`/daily/${offsetDate(currentDate, 1)}`}
                  className="w-5 h-5 flex items-center justify-center rounded"
                  style={{ color: 'var(--text-subtle)' }}
                >
                  <ChevronRight size={12} />
                </Link>
              )}
            </div>
          </div>
          <div className="space-y-0.5">
            {dates.map((d) => (
              <DateItem key={d} date={d} current={pathname === `/daily/${d}`} />
            ))}
          </div>
        </section>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <section>
            <div className="px-3 mb-1">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-subtle)' }}
              >
                Tags
              </span>
            </div>
            <div className="space-y-0.5">
              {tags.map((tag) => (
                <TagItem
                  key={tag.tagId}
                  tag={tag}
                  active={pathname === `/tags/${tag.tagId}`}
                />
              ))}
            </div>
          </section>
        )}
      </nav>

      {/* Footer */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <Hash size={12} style={{ color: 'var(--text-subtle)' }} />
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          Phase 1
        </span>
      </div>
    </aside>
  );
}
