'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { type TagRecord } from '@/lib/api';

interface TagChipProps {
  tagName: string;
  tagRecord?: TagRecord;
  onRemove?: () => void;
}

export function TagChip({ tagName, tagRecord, onRemove }: TagChipProps) {
  const color = tagRecord?.color;
  const href = tagRecord ? `/tags/${tagRecord.tagId}` : undefined;

  const chip = (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors duration-100 cursor-pointer"
      style={{
        background: color ? `${color}20` : 'var(--tag-bg)',
        color: color ?? 'var(--tag-text)',
      }}
    >
      #{tagName}
      {onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
          aria-label={`Remove tag ${tagName}`}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );

  if (href) {
    return <Link href={href}>{chip}</Link>;
  }
  return chip;
}
