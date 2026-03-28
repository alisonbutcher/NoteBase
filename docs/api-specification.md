# API Specification

This document describes the HTTP API surface of the NoteBase API service. The API follows CQRS principles — write operations are commands that return 202 Accepted, read operations are queries that return 200 with data.

All endpoints except `/health` require a valid Cognito JWT in the `Authorization: Bearer` header.

Base URL: `https://api.notebase.app/v1` (production) | `http://localhost:3000/v1` (local)

---

## Conventions

### Write path (commands)

- Method: `POST`, `PATCH`, or `DELETE`
- Success response: `202 Accepted` with the generated `eventId`
- The response does not contain updated state — the client applies optimistic updates locally
- The `nodeId` in command bodies is a client-generated UUID — the client is responsible for generating IDs before sending the command

```json
// Standard 202 response
{
  "eventId": "uuid"
}
```

### Read path (queries)

- Method: `GET`
- Success response: `200 OK` with the requested data
- Data is served from pre-computed projections — the event store is not touched

### Error responses

```json
// 400 Bad Request — validation failure
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["content must not be empty"]
}

// 401 Unauthorized — missing or invalid JWT
{
  "statusCode": 401,
  "error": "Unauthorized"
}

// 404 Not Found
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Node not found"
}
```

---

## Commands

### Create node

Creates a new node in a daily note.

```
POST /v1/nodes
```

**Request body:**

```json
{
  "nodeId": "uuid",
  "content": "Meeting: Q1 review",
  "parentId": "uuid | null",
  "dailyNoteDate": "2025-03-25",
  "position": 0
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `nodeId` | UUID | Yes | Client-generated unique ID for this node |
| `content` | string | Yes | Text content of the node |
| `parentId` | UUID or null | Yes | Parent node ID, or null for a root-level node |
| `dailyNoteDate` | string (YYYY-MM-DD) | Yes | The daily note this node belongs to |
| `position` | integer | Yes | Display order among siblings (0-indexed) |

**Response:** `202 Accepted`

```json
{ "eventId": "uuid" }
```

---

### Edit node

Updates the text content of an existing node.

```
PATCH /v1/nodes/:nodeId
```

**Request body:**

```json
{
  "content": "Meeting: Q1 review — budget focus"
}
```

**Response:** `202 Accepted`

```json
{ "eventId": "uuid" }
```

---

### Move node

Changes a node's position or parent within a daily note.

```
POST /v1/nodes/:nodeId/move
```

**Request body:**

```json
{
  "newParentId": "uuid | null",
  "newPosition": 2
}
```

**Response:** `202 Accepted`

```json
{ "eventId": "uuid" }
```

---

### Delete node

Soft-deletes a node and its children.

```
DELETE /v1/nodes/:nodeId
```

**Request body:** None

**Response:** `202 Accepted`

```json
{ "eventId": "uuid" }
```

---

### Tag node

Applies a tag to a node. Creates the tag if it does not exist.

```
POST /v1/nodes/:nodeId/tags
```

**Request body:**

```json
{
  "tagName": "meeting"
}
```

**Response:** `202 Accepted`

```json
{
  "eventId": "uuid",
  "tagId": "uuid"
}
```

The `tagId` is returned so the client can update its local tag state without a separate fetch.

---

### Untag node

Removes a tag from a node.

```
DELETE /v1/nodes/:nodeId/tags/:tagId
```

**Request body:** None

**Response:** `202 Accepted`

```json
{ "eventId": "uuid" }
```

---

### Create tag

Creates a new tag explicitly (outside of the tag-node flow).

```
POST /v1/tags
```

**Request body:**

```json
{
  "tagId": "uuid",
  "tagName": "decision",
  "color": "#e74c3c"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tagId` | UUID | Yes | Client-generated unique ID |
| `tagName` | string | Yes | Tag name, case-insensitive, normalised to lowercase |
| `color` | string or null | No | Hex colour for UI display |

**Response:** `202 Accepted`

```json
{ "eventId": "uuid" }
```

---

## Queries

### Get daily note

Returns all nodes for a given date in display order.

```
GET /v1/daily-notes/:date
```

**Path parameter:** `date` in `YYYY-MM-DD` format

**Response:** `200 OK`

```json
{
  "date": "2025-03-25",
  "nodes": [
    {
      "nodeId": "uuid",
      "content": "Meeting: Q1 review",
      "parentId": null,
      "position": 0,
      "depth": 0,
      "tags": ["meeting", "q1"],
      "updatedAt": "2025-03-25T09:00:00.000Z"
    },
    {
      "nodeId": "uuid",
      "content": "Discussed budget",
      "parentId": "uuid",
      "position": 0,
      "depth": 1,
      "tags": [],
      "updatedAt": "2025-03-25T09:01:00.000Z"
    }
  ]
}
```

The response is a flat list. The client reconstructs the tree from `parentId` and `position` fields.

---

### Get tag lens

Returns all nodes with a given tag, ordered by date descending.

```
GET /v1/lens/:tagId
```

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `from` | YYYY-MM-DD | No | Filter nodes from this date (inclusive) |
| `to` | YYYY-MM-DD | No | Filter nodes to this date (inclusive) |
| `limit` | integer | No | Maximum nodes to return (default: 100, max: 500) |
| `cursor` | string | No | Pagination cursor from previous response |

**Response:** `200 OK`

```json
{
  "tagId": "uuid",
  "tagName": "meeting",
  "nodes": [
    {
      "nodeId": "uuid",
      "content": "Meeting: Q1 review",
      "dailyNoteDate": "2025-03-25",
      "parentId": null,
      "position": 0,
      "childCount": 2,
      "updatedAt": "2025-03-25T09:00:00.000Z"
    }
  ],
  "nextCursor": "string | null"
}
```

**Notes:**
- Child nodes of a tagged node are not included in this response. The client fetches children on demand using the daily note query or a future `GET /v1/nodes/:nodeId/children` endpoint.
- `nextCursor` is null when there are no more results.

---

### Get tags

Returns all tags for the authenticated user.

```
GET /v1/tags
```

**Response:** `200 OK`

```json
{
  "tags": [
    {
      "tagId": "uuid",
      "tagName": "meeting",
      "color": "#3498db",
      "createdAt": "2025-01-15T08:00:00.000Z"
    }
  ]
}
```

---

## Health Check

```
GET /health
```

No authentication required.

**Response:** `200 OK`

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "queue": "ok"
  }
}
```

If any check fails, the status is `degraded` and the specific check shows `"error"`. ECS uses this endpoint for container health checks.

---

## Write Path Sequence

For reference, the write path for any command:

```
Client → POST /v1/nodes (with JWT)
       → Middleware validates JWT, extracts userId
       → Command handler validates request body
       → Event factory constructs typed domain event
       → Event store appends event to Postgres
       → Message publisher publishes event (no-op in Phase 1)
       → 202 Accepted returned to client
       → (async) Projection handler updates read store
```

The client does not wait for the projection to update. Optimistic updates are applied locally.
