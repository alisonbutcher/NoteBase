# C4 Level 1 — System Context

Shows how NoteBase fits into the world and the external systems it depends on.

```mermaid
C4Context
    title System Context Diagram for NoteBase

    Person(user, "User", "Writes daily notes, views tag lens pages")

    System(notebase, "NoteBase", "Daily note-taking system with tag lens views. Allows notes written in a daily journal to be viewed as dedicated tag-filtered pages.")

    System_Ext(cognito, "Amazon Cognito", "User authentication and identity management")
    System_Ext(ses, "Amazon SES", "Transactional email — account verification, notifications")
    System_Ext(s3, "Amazon S3", "File and attachment storage")
    System_Ext(vercel, "Vercel", "Frontend hosting and CDN")

    Rel(user, notebase, "Writes notes, views lenses", "HTTPS")
    Rel(notebase, cognito, "Authenticates users via", "HTTPS")
    Rel(notebase, ses, "Sends email via", "HTTPS")
    Rel(notebase, s3, "Stores attachments via", "AWS SDK")
    Rel(notebase, vercel, "Frontend served from", "HTTPS")
```

## Elements

| Element | Type | Description |
|---|---|---|
| User | Person | Primary actor — writes and reads notes |
| NoteBase | System | The system being documented |
| Amazon Cognito | External system | Managed auth — handles signup, login, JWT issuance |
| Amazon SES | External system | Transactional email delivery |
| Amazon S3 | External system | Object storage for file attachments |
| Vercel | External system | Next.js frontend hosting |

## Notes

- The context diagram deliberately omits internal infrastructure (RabbitMQ, DynamoDB, RDS) — those are container-level concerns
- A future mobile client would appear here as an additional actor once implemented
- Cognito handles all auth concerns — the API trusts Cognito-issued JWTs and does not manage credentials directly
