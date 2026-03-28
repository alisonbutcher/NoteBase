# Functional Requirements

This document defines what NoteBase must do — the user-facing capabilities, scope boundaries per phase, and the core user journeys. Architecture decisions in the ADRs are traceable back to requirements stated here.

---

## Problem Statement

Existing outliner and note-taking tools (Tana, Logseq, Obsidian, Capacities) support tagging nodes within daily notes, but cannot render all nodes sharing a tag as a coherent, editable page. The user must open each result individually. This breaks the workflow of anyone who writes meeting notes, project updates, or any recurring note type in a daily journal and wants to review or continue that work as a unified surface.

NoteBase solves this with the **tag lens** — a virtual page that aggregates all nodes with a given tag, rendered as first-class editable entries, with writes going back to the source record. No data is duplicated. The lens is a view, not a copy.

---

## Actors

| Actor | Description |
|---|---|
| **User** | The primary actor. Writes daily notes, tags nodes, navigates tag lens pages, edits notes from any view. Phase 1: single user (the owner). Phase 2+: any authenticated SaaS user. |
| **System** | NoteBase itself — processes commands, maintains projections, serves read models. |

---

## Functional Scope by Phase

### Phase 1 — Personal use

**In scope:**

- Daily note — create and edit a note for any date
- Nodes — write hierarchical bullet-point content within a daily note
- Tagging — apply one or more tags to a node using `#tag-name` syntax
- Tag lens — view all nodes with a given tag as a virtual page, ordered by date
- Inline editing — edit any node from the daily note view or the tag lens view; changes are reflected in both views
- Tag management — create, rename, and assign a colour to tags
- Node operations — indent, outdent, move, and soft-delete nodes

**Out of scope in Phase 1:**

- User accounts and authentication (single-user, local only)
- File attachments
- Full-text search
- Real-time collaboration
- Mobile client
- Undo / redo (event log supports it but UI is not implemented)
- Public sharing of notes or lens pages

### Phase 2 — Early SaaS

Adds to Phase 1:

- User registration and authentication via Amazon Cognito
- Full data isolation between users
- File attachments (images, PDFs) uploaded to S3 and embedded in nodes
- Full-text search across node content
- Account management (email change, password reset, account deletion with GDPR erasure)

**Out of scope in Phase 2:**

- Real-time collaboration (multiple users editing simultaneously)
- Mobile native app
- Public/shared lens pages
- API access for third-party integrations

### Phase 3 — Growth

Adds to Phase 2:

- Undo / redo (surfacing the event log to the user)
- Version history — view what a node looked like at any past date
- Mobile client (React Native or PWA)
- Shared lens pages (read-only public links)

---

## Use Cases

### UC-01 — Write a daily note

**Actor:** User
**Description:** The user opens today's date and writes one or more nodes.

**Basic flow:**
1. User navigates to the daily note for today (default landing page)
2. System displays existing nodes for today, or an empty note if none exist
3. User types content into a node
4. User presses Enter to create the next sibling node, or Tab to indent (create a child)
5. System persists a `NodeCreated` event for each new node
6. System updates the daily note projection

**Notes:**
- The daily note date is determined by the user's local timezone, not UTC
- Nodes are displayed in position order within their parent

---

### UC-02 — Tag a node

**Actor:** User
**Description:** The user applies a tag to a node, making it visible through the corresponding tag lens.

**Basic flow:**
1. User types `#tag-name` anywhere in a node's content, or uses a tag picker UI
2. System resolves the tag — creating a new `TagCreated` event if the tag does not yet exist
3. System persists a `NodeTagged` event
4. System updates the tag lens projection for `tag-name`
5. The node is now visible on the `#tag-name` lens page

**Alternate flow — removing a tag:**
1. User removes `#tag-name` from the node content, or uses the tag picker to deselect
2. System persists a `NodeUntagged` event
3. System removes the node from the tag lens projection for `tag-name`

**Notes:**
- A node can have multiple tags simultaneously
- Tags are case-insensitive and normalised on creation (`#Meeting` and `#meeting` are the same tag)

---

### UC-03 — View a tag lens page

**Actor:** User
**Description:** The user navigates to a tag lens page to view all nodes with a given tag as a unified, editable surface.

**Basic flow:**
1. User clicks a tag name or navigates to `/#tag-name`
2. System queries the tag lens projection for all nodes with that tag, ordered by `dailyNoteDate` descending
3. System renders each node as a first-class entry showing:
   - Node content (editable)
   - Date of the originating daily note (as a back-link)
   - Child nodes (if any), indented beneath their parent
4. User reads and edits nodes directly on this page

**Notes:**
- The tag lens page is a **view**, not a copy. The nodes shown are the same records that exist in the daily notes.
- Edits made on the tag lens page are written back to the source record via a `NodeEdited` event. The daily note projection is updated accordingly.
- If the tag has no nodes, the page shows an empty state.

---

### UC-04 — Edit a node

**Actor:** User
**Description:** The user edits the content of an existing node, from either the daily note view or the tag lens view.

**Basic flow:**
1. User clicks into a node and modifies its content
2. On blur (or after a debounce interval), system persists a `NodeEdited` event
3. System updates all projections that include this node (daily note projection, and any tag lens projections for tags on this node)
4. Both views reflect the updated content

**Notes:**
- Edits are debounced on the client — a `NodeEdited` event is not written on every keystroke, but after a pause in typing (default: 1 second)
- The client optimistically updates the UI immediately. The event is persisted asynchronously.

---

### UC-05 — Move a node

**Actor:** User
**Description:** The user reorders or re-parents a node using drag-and-drop or keyboard shortcuts.

**Basic flow:**
1. User drags a node to a new position, or uses keyboard shortcut to move it
2. System persists a `NodeMoved` event with `newParentId` and `newPosition`
3. System updates the daily note projection to reflect the new position

**Notes:**
- Nodes can only be moved within the same daily note. Cross-date moves are out of scope for Phase 1.
- Moving a node does not affect which tag lens pages it appears on.

---

### UC-06 — Delete a node

**Actor:** User
**Description:** The user deletes a node and its children.

**Basic flow:**
1. User invokes delete on a node
2. System persists a `NodeDeleted` event with `softDelete: true`
3. System removes the node (and its children) from all projections
4. The node no longer appears in the daily note or any tag lens

**Notes:**
- Soft delete is the default. The event remains in the event store — the node can be recovered by replaying events and ignoring the `NodeDeleted` event (undo, Phase 3).
- Hard delete (`softDelete: false`) purges the node from all projections permanently and cannot be undone. This is used for the GDPR erasure flow — not exposed as a regular user action.

---

### UC-07 — Manage tags

**Actor:** User
**Description:** The user creates, renames, or assigns a colour to a tag.

**Basic flow:**
1. User navigates to tag management
2. User creates a new tag with a name and optional colour
3. System persists a `TagCreated` event
4. Tag is now available for use in nodes and visible in the sidebar

**Alternate flows:**
- User renames a tag → `TagRenamed` event, all projections referencing the tag name are updated
- User assigns or changes a colour → `TagColourChanged` event, UI updates tag chip colour

---

### UC-08 — Projection rebuild (operator)

**Actor:** System operator
**Description:** An operator triggers a rebuild of a stale or corrupted projection.

**Basic flow:**
1. Operator triggers rebuild via an admin endpoint or CLI command
2. System loads the latest snapshot for the affected projection
3. System replays all events with `id > snapshot.last_event_id` from the event store
4. System writes the rebuilt projection to the read store, overwriting stale data
5. Operator receives a completion notification

**Notes:**
- The API continues serving the existing (potentially stale) projection during rebuild
- Rebuild time is bounded by the snapshot interval (default: 1,000 events)

---

## Key Business Rules

| Rule | Description |
|---|---|
| BR-01 | A node belongs to exactly one daily note. The `dailyNoteDate` is set on creation and never changes. |
| BR-02 | A node can have zero or more tags. There is no limit on tags per node. |
| BR-03 | Tags are unique per user by name (case-insensitive). Creating a tag with a duplicate name is idempotent. |
| BR-04 | Deleting a tag does not delete the nodes that were tagged with it. Nodes retain their tag associations in the event log. Projections are updated to remove the deleted tag. |
| BR-05 | Node content is stored as plain text in Phase 1. Rich text (bold, italic, inline code) is a Phase 2 concern. |
| BR-06 | All user data is strictly isolated. A user cannot view, edit, or reference another user's notes or tags. |
| BR-07 | Events are immutable once written. No event is updated or deleted during normal operation. |

---

## Requirements Traceability

This table maps significant functional requirements to the architecture decisions they drove.

| Requirement | Architecture decision | ADR |
|---|---|---|
| Multiple simultaneous views of the same node (daily note + tag lens) without duplication | Event sourcing — single source of truth, multiple projections derived from it | ADR-001 |
| Tag lens must be pre-computed, not derived at query time | CQRS — read path hits a pre-computed projection, never the event store | ADR-001 |
| Adding a new lens type (e.g. person lens) must not require data migration | Projection handlers consume the existing event stream — new handler, no migration | ADR-001 |
| Undo history and version history (Phase 3) | Event log is the complete history — undo is replay without a specific event | ADR-001 |
| Read latency must be low regardless of event log size | DynamoDB for read store — single-digit ms on fixed access patterns | ADR-004 |
| Write path must not block on projection update | CQRS 202 Accepted — API returns before projection is updated | ADR-001 |
| Phase 1 must run locally with no cloud infrastructure | Interface abstractions — NullPublisher + PostgresProjectionStore satisfy the same contracts | ADR-006 |
| Phase 2 projection handler must be independently scalable | Decoupled via RabbitMQ — projection handler scales independently of the API | ADR-005 |
| System must be portable off AWS | RabbitMQ on AMQP (open protocol) rather than SQS (proprietary) | ADR-005 |
| User data deletion (GDPR) | Soft-delete projections + event pseudonymisation strategy (immutable log constraint) | NFR doc |
