# C4 Level 1 — System Context

Shows how NoteBase fits into the world and the external systems it depends on.

```mermaid
graph LR
    User(["User\nWrites daily notes\nand views tag lens pages"])
    NoteBase["NoteBase\nDaily note-taking system\nwith tag lens views"]
    Cognito["Amazon Cognito\nUser auth · JWT issuance"]
    SES["Amazon SES\nTransactional email"]
    S3["Amazon S3\nFile and attachment storage"]
    Vercel["Vercel\nFrontend hosting · CDN"]

    User -->|HTTPS| NoteBase
    NoteBase -->|HTTPS| Cognito
    NoteBase -->|HTTPS| SES
    NoteBase -->|AWS SDK| S3
    NoteBase -->|HTTPS| Vercel

    style User fill:#08427B,color:#fff,stroke:#052E56
    style NoteBase fill:#1168BD,color:#fff,stroke:#0B4884
    style Cognito fill:#6C6C6C,color:#fff,stroke:#3C3C3C
    style SES fill:#6C6C6C,color:#fff,stroke:#3C3C3C
    style S3 fill:#6C6C6C,color:#fff,stroke:#3C3C3C
    style Vercel fill:#6C6C6C,color:#fff,stroke:#3C3C3C
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
