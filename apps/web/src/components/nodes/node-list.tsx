'use client';

import { useState, useCallback, useRef } from 'react';
import { Plus } from 'lucide-react';
import { NodeItem } from './node-item';
import { type DailyNoteNode, type TagRecord, api } from '@/lib/api';
import { randomUUID } from '@/lib/utils';

interface NodeListProps {
  nodes: DailyNoteNode[];
  tags: TagRecord[];
  dailyNoteDate: string;
  onMutate: () => void;
}

export function NodeList({ nodes, tags, dailyNoteDate, onMutate }: NodeListProps) {
  const [newNodeId, setNewNodeId] = useState<string | null>(null);
  const pendingDelete = useRef<Set<string>>(new Set());

  const handleSave = useCallback(
    async (nodeId: string, content: string) => {
      const existing = nodes.find((n) => n.nodeId === nodeId);
      if (!existing) return;
      if (existing.content === content) return;
      try {
        await api.editNode(nodeId, content);
        onMutate();
      } catch {
        // ignore
      }
    },
    [nodes, onMutate],
  );

  const handleDelete = useCallback(
    async (nodeId: string) => {
      if (pendingDelete.current.has(nodeId)) return;
      pendingDelete.current.add(nodeId);
      try {
        await api.deleteNode(nodeId);
        setNewNodeId(null);
        onMutate();
      } finally {
        pendingDelete.current.delete(nodeId);
      }
    },
    [onMutate],
  );

  const handleEnter = useCallback(
    async (afterNodeId: string, afterPosition: number) => {
      const id = randomUUID();
      setNewNodeId(id);
      try {
        await api.createNode({
          nodeId: id,
          content: '',
          parentId: null,
          dailyNoteDate,
          position: afterPosition + 1,
        });
        onMutate();
      } catch {
        setNewNodeId(null);
      }
    },
    [dailyNoteDate, onMutate],
  );

  const handleNewNode = useCallback(async () => {
    const id = randomUUID();
    setNewNodeId(id);
    try {
      await api.createNode({
        nodeId: id,
        content: '',
        parentId: null,
        dailyNoteDate,
        position: nodes.length,
      });
      onMutate();
    } catch {
      setNewNodeId(null);
    }
  }, [dailyNoteDate, nodes.length, onMutate]);

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <NodeItem
          key={node.nodeId}
          node={node}
          tags={tags}
          autoFocus={node.nodeId === newNodeId}
          onSave={handleSave}
          onDelete={handleDelete}
          onEnter={handleEnter}
          onTagAdded={onMutate}
        />
      ))}

      {/* New node button */}
      <button
        onClick={handleNewNode}
        className="flex items-center gap-2 w-full px-1 py-1.5 rounded-md text-sm transition-colors duration-100 group"
        style={{ color: 'var(--text-subtle)' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = 'var(--text-subtle)';
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        <Plus size={14} className="ml-3" />
        <span>New note</span>
      </button>
    </div>
  );
}
