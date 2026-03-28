# Local Development

This document describes the local development setup for NoteBase using Docker Compose.

In Phase 1 (local), the full AWS infrastructure is replaced by local equivalents:

| AWS Service | Local Equivalent |
|---|---|
| RDS PostgreSQL | Postgres in Docker |
| Amazon MQ (RabbitMQ) | RabbitMQ in Docker |
| DynamoDB | DynamoDB Local in Docker |
| S3 | LocalStack in Docker |
| Cognito | Local JWT mock (see below) |

---

## docker-compose.yml

```yaml
version: '3.9'

services:

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: notebase
      POSTGRES_USER: notebase
      POSTGRES_PASSWORD: notebase
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/sql/init.sql:/docker-entrypoint-initdb.d/init.sql

  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: notebase
      RABBITMQ_DEFAULT_PASS: notebase
    ports:
      - '5672:5672'    # AMQP
      - '15672:15672'  # management UI

  dynamodb-local:
    image: amazon/dynamodb-local:latest
    command: '-jar DynamoDBLocal.jar -sharedDb -dbPath /data'
    ports:
      - '8000:8000'
    volumes:
      - dynamodb_data:/data

  localstack:
    image: localstack/localstack:latest
    environment:
      SERVICES: s3
      AWS_DEFAULT_REGION: ap-southeast-2
    ports:
      - '4566:4566'
    volumes:
      - localstack_data:/var/lib/localstack

volumes:
  postgres_data:
  dynamodb_data:
  localstack_data:
```

---

## Environment Variables

### API (`apps/api/.env.local`)

```env
# Database
DATABASE_URL=postgresql://notebase:notebase@localhost:5432/notebase

# Message transport (null = projection handler polls event store directly; rabbitmq = Phase 2)
QUEUE_TRANSPORT=null
RABBITMQ_URL=amqp://notebase:notebase@localhost:5672

# Projection store
PROJECTION_STORE=postgres

# DynamoDB (used when PROJECTION_STORE=dynamodb)
DYNAMODB_ENDPOINT=http://localhost:8000
DYNAMODB_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local

# S3
S3_ENDPOINT=http://localhost:4566
S3_BUCKET=notebase-attachments
S3_REGION=ap-southeast-2

# Auth (local mock — bypasses Cognito)
AUTH_MODE=local
LOCAL_AUTH_USER_ID=00000000-0000-0000-0000-000000000001

# App
PORT=3000
NODE_ENV=development
```

### Frontend (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Starting Local Development

```bash
# start all infrastructure services
docker compose up -d

# install dependencies (from monorepo root)
pnpm install

# run database migrations
pnpm --filter api migrate

# seed reference data (tags, test user)
pnpm --filter api seed

# start the API (with hot reload)
pnpm --filter api dev

# start the frontend (in a separate terminal)
pnpm --filter web dev
```

### Service URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:3001 |
| API | http://localhost:3000 |
| API health check | http://localhost:3000/health |
| RabbitMQ management | http://localhost:15672 |
| DynamoDB Local | http://localhost:8000 |
| LocalStack (S3) | http://localhost:4566 |

---

## Switching to Phase 2 Infrastructure Locally

To test the Phase 2 infrastructure (RabbitMQ transport, DynamoDB projection store) against local Docker services, update `apps/api/.env.local`:

```env
QUEUE_TRANSPORT=rabbitmq
PROJECTION_STORE=dynamodb
```

No code changes required. The `IMessagePublisher` and `IProjectionStore` implementations are swapped via dependency injection based on these environment variables (see ADR-006).

---

## Running Tests

```bash
# unit tests (no infrastructure required)
pnpm test

# integration tests (requires Docker Compose services running)
pnpm test:integration

# integration tests against Phase 2 implementations
QUEUE_TRANSPORT=rabbitmq PROJECTION_STORE=dynamodb pnpm test:integration
```

Integration tests run against both Phase 1 and Phase 2 implementations in CI to ensure the interface contracts are satisfied by all implementations.
