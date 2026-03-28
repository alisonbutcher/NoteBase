// Command DTOs — match the API request body shapes defined in api-specification.md.
// These are plain data objects (not classes) — validation happens in the API layer.

export interface CreateNodeCommand {
  nodeId: string;          // client-generated UUID
  content: string;
  parentId: string | null;
  dailyNoteDate: string;   // YYYY-MM-DD
  position: number;
}

export interface EditNodeCommand {
  nodeId: string;
  content: string;
}

export interface MoveNodeCommand {
  nodeId: string;
  newParentId: string | null;
  newPosition: number;
}

export interface DeleteNodeCommand {
  nodeId: string;
}

export interface TagNodeCommand {
  nodeId: string;
  tagName: string; // normalised to lowercase in command handler
}

export interface UntagNodeCommand {
  nodeId: string;
  tagId: string;
}

export interface CreateTagCommand {
  tagId: string;   // client-generated UUID
  tagName: string; // normalised to lowercase in command handler
  color: string | null;
}
