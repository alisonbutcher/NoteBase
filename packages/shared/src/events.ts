export interface DomainEvent {
  eventId: string;   // UUID, unique per event
  userId: string;    // UUID, all events are user-scoped
  occurredAt: string; // ISO 8601 timestamp
}

export interface NodeCreated extends DomainEvent {
  type: 'NodeCreated';
  nodeId: string;
  content: string;
  parentId: string | null;
  dailyNoteDate: string; // YYYY-MM-DD
  position: number;
}

export interface NodeEdited extends DomainEvent {
  type: 'NodeEdited';
  nodeId: string;
  content: string;
}

export interface NodeMoved extends DomainEvent {
  type: 'NodeMoved';
  nodeId: string;
  newParentId: string | null;
  newPosition: number;
}

export interface NodeDeleted extends DomainEvent {
  type: 'NodeDeleted';
  nodeId: string;
  softDelete: boolean;
}

export interface NodeTagged extends DomainEvent {
  type: 'NodeTagged';
  nodeId: string;
  tagId: string;
  tagName: string; // denormalised for projection convenience
}

export interface NodeUntagged extends DomainEvent {
  type: 'NodeUntagged';
  nodeId: string;
  tagId: string;
}

export interface TagCreated extends DomainEvent {
  type: 'TagCreated';
  tagId: string;
  tagName: string;
  color: string | null;
}

export type NoteBaseEvent =
  | NodeCreated
  | NodeEdited
  | NodeMoved
  | NodeDeleted
  | NodeTagged
  | NodeUntagged
  | TagCreated;
