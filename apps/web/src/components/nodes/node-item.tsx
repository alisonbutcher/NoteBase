'use client';

import { useState, useRef } from 'react';
import { Trash2, Tag } from 'lucide-react';
import { NodeEditor } from './node-editor';
import { TagChip } from './tag-chip';
import { type DailyNoteNode, type TagRecord, api } from '@/lib/api';

interface NodeItemProps {
  node: DailyNoteNode;
  tags: TagRecord[];
  autoFocus?: boolean;
  onSave: (nodeId: string, content: string) => void;
  onDelete: (nodeId: string) => void;
  onEnter: (nodeId: string, position: number) => void;
  onTagAdded: () => void;
}

export function NodeItem({
  node,
  tags,
  autoFocus = false,
  onSave,
  onDelete,
  onEnter,
  onTagAdded,
}: NodeItemProps) {
  const [hovered, setHovered] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const nodeTagRecords = node.tags.map(
    (name) => tags.find((t) => t.tagName === name),
  );

  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    const name = tagInput.trim().toLowerCase();
    if (!name) return;
    try {
      await api.tagNode(node.nodeId, name);
      setTagInput('');
      setShowTagInput(false);
      onTagAdded();
    } catch {
      // ignore
    }
  }

  async function handleRemoveTag(tagId: string) {
    try {
      await api.untagNode(node.nodeId, tagId);
      onTagAdded();
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="group flex items-start gap-2 px-1 py-0.5 rounded-md transition-colors duration-100"
      style={{
        paddingLeft: `${(node.depth * 20) + 4}px`,
        background: hovered ? 'var(--bg-hover)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Bullet */}
      <span
        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-100"
        style={{ background: hovered ? 'var(--accent)' : 'var(--text-subtle)' }}
      />

      <div className="flex-1 min-w-0">
        {/* Editor row */}
        <div className="flex items-start gap-2">
          <NodeEditor
            content={node.content}
            autoFocus={autoFocus}
            onSave={(content) => onSave(node.nodeId, content)}
            onEnter={() => onEnter(node.nodeId, node.position)}
            onDelete={() => onDelete(node.nodeId)}
          />

          {/* Actions (visible on hover) */}
          <div
            className="flex items-center gap-1 shrink-0 mt-0.5 transition-opacity duration-100"
            style={{ opacity: hovered ? 1 : 0 }}
          >
            <button
              onClick={() => {
                setShowTagInput(true);
                setTimeout(() => tagInputRef.current?.focus(), 50);
              }}
              className="w-6 h-6 flex items-center justify-center rounded transition-colors duration-100"
              style={{ color: 'var(--text-subtle)' }}
              title="Add tag"
            >
              <Tag size={13} />
            </button>
            <button
              onClick={() => onDelete(node.nodeId)}
              className="w-6 h-6 flex items-center justify-center rounded transition-colors duration-100"
              style={{ color: 'var(--text-subtle)' }}
              title="Delete node"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Tags + tag input */}
        {(node.tags.length > 0 || showTagInput) && (
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {node.tags.map((name, i) => {
              const record = nodeTagRecords[i];
              return (
                <TagChip
                  key={name}
                  tagName={name}
                  tagRecord={record}
                  onRemove={record ? () => handleRemoveTag(record.tagId) : undefined}
                />
              );
            })}

            {showTagInput && (
              <form onSubmit={handleAddTag}>
                <input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onBlur={() => {
                    if (!tagInput) setShowTagInput(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowTagInput(false);
                      setTagInput('');
                    }
                  }}
                  placeholder="tag name…"
                  className="text-xs rounded px-2 py-0.5 outline-none"
                  style={{
                    background: 'var(--bg-active)',
                    color: 'var(--text)',
                    border: '1px solid var(--border-focus)',
                    width: '90px',
                  }}
                />
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
