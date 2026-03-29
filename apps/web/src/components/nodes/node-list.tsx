'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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
  const [optimisticNodes, setOptimisticNodes] = useState<DailyNoteNode[]>([]);
  const [deletedNodeIds, setDeletedNodeIds] = useState<Set<string>>(new Set());
  const [editOverrides, setEditOverrides] = useState<Map<string, string>>(new Map());
  const pendingDelete = useRef<Set<string>>(new Set());

  // Remove optimistic nodes once they appear in SWR data
  useEffect(() => {
    const serverIds = new Set(nodes.map((n) => n.nodeId));
    setOptimisticNodes((prev) => prev.filter((n) => !serverIds.has(n.nodeId)));
  }, [nodes]);

  // Display = server nodes (minus deleted) + optimistic nodes not yet in server data
  const displayNodes = [
    ...nodes
      .filter((n) => !deletedNodeIds.has(n.nodeId))
      .map((n) => editOverrides.has(n.nodeId) ? { ...n, content: editOverrides.get(n.nodeId)! } : n),
    ...optimisticNodes.filter((o) => !nodes.find((n) => n.nodeId === o.nodeId)),
  ];

  const handleSave = useCallback(
    async (nodeId: string, content: string) => {
      // Optimistically update content immediately
      setEditOverrides((prev) => new Map(prev).set(nodeId, content));
      try {
        await api.editNode(nodeId, content);
        setEditOverrides((prev) => {
          const next = new Map(prev);
          next.delete(nodeId);
          return next;
        });
        onMutate();
      } catch {
        // revert override on failure
        setEditOverrides((prev) => {
          const next = new Map(prev);
          next.delete(nodeId);
          return next;
        });
      }
    },
    [onMutate],
  );

  const handleDelete = useCallback(
    async (nodeId: string) => {
      if (pendingDelete.current.has(nodeId)) return;
      pendingDelete.current.add(nodeId);
      // Optimistically hide immediately
      setDeletedNodeIds((prev) => new Set([...prev, nodeId]));
      setOptimisticNodes((prev) => prev.filter((n) => n.nodeId !== nodeId));
      if (newNodeId === nodeId) setNewNodeId(null);
      try {
        await api.deleteNode(nodeId);
        onMutate();
      } catch {
        // revert
        setDeletedNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
      } finally {
        pendingDelete.current.delete(nodeId);
      }
    },
    [newNodeId, onMutate],
  );

  const addOptimisticNode = useCallback((id: string, position: number) => {
    const newNode: DailyNoteNode = {
      nodeId: id,
      content: '',
      parentId: null,
      position,
      depth: 0,
      tags: [],
      updatedAt: new Date().toISOString(),
    };
    setOptimisticNodes((prev) => [...prev, newNode]);
    setNewNodeId(id);
  }, []);

  const handleEnter = useCallback(
    async (afterNodeId: string, afterPosition: number) => {
      const id = randomUUID();
      addOptimisticNode(id, afterPosition + 1);
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
        setOptimisticNodes((prev) => prev.filter((n) => n.nodeId !== id));
        setNewNodeId(null);
      }
    },
    [dailyNoteDate, onMutate, addOptimisticNode],
  );

  const handleNewNode = useCallback(async () => {
    const id = randomUUID();
    addOptimisticNode(id, displayNodes.length);
    try {
      await api.createNode({
        nodeId: id,
        content: '',
        parentId: null,
        dailyNoteDate,
        position: displayNodes.length,
      });
      onMutate();
    } catch {
      setOptimisticNodes((prev) => prev.filter((n) => n.nodeId !== id));
      setNewNodeId(null);
    }
  }, [dailyNoteDate, displayNodes.length, onMutate, addOptimisticNode]);

  return (
    <div className="space-y-0.5">
      {displayNodes.map((node) => (
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
