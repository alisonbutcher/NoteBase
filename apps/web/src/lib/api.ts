const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DailyNoteNode {
  nodeId: string;
  content: string;
  parentId: string | null;
  position: number;
  depth: number;
  tags: string[];
  updatedAt: string;
}

export interface DailyNote {
  date: string;
  nodes: DailyNoteNode[];
}

export interface TagRecord {
  tagId: string;
  tagName: string;
  color: string | null;
  createdAt: string;
}

export interface TagLensNode {
  nodeId: string;
  content: string;
  dailyNoteDate: string;
  parentId: string | null;
  position: number;
  childCount: number;
  updatedAt: string;
}

export interface TagLens {
  tagId: string;
  tagName: string;
  nodes: TagLensNode[];
  nextCursor: string | null;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const api = {
  getDailyNote: (date: string) =>
    request<DailyNote>(`/v1/daily-notes/${date}`),

  getTags: () =>
    request<TagRecord[]>('/v1/tags'),

  getTagLens: (tagId: string, params?: { from?: string; to?: string; limit?: number; cursor?: string }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    const query = qs.toString();
    return request<TagLens>(`/v1/tags/${tagId}/lens${query ? `?${query}` : ''}`);
  },

  createNode: (body: {
    nodeId: string;
    content: string;
    parentId: string | null;
    dailyNoteDate: string;
    position: number;
  }) => request<{ eventId: string }>('/v1/nodes', { method: 'POST', body: JSON.stringify(body) }),

  editNode: (nodeId: string, content: string) =>
    request<{ eventId: string }>(`/v1/nodes/${nodeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  deleteNode: (nodeId: string) =>
    request<{ eventId: string }>(`/v1/nodes/${nodeId}`, { method: 'DELETE' }),

  createTag: (body: { tagId: string; tagName: string; color?: string }) =>
    request<{ eventId: string; tagId: string }>('/v1/tags', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  tagNode: (nodeId: string, tagName: string) =>
    request<{ eventId: string; tagId: string }>(`/v1/nodes/${nodeId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagName }),
    }),

  untagNode: (nodeId: string, tagId: string) =>
    request<{ eventId: string }>(`/v1/nodes/${nodeId}/tags/${tagId}`, { method: 'DELETE' }),
};
