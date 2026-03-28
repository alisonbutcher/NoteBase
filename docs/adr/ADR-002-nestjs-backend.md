# ADR-002 — NestJS as the backend framework

**Status:** Accepted
**Date:** 2025-03
**Author:** Solution Architecture

---

## Context

The backend API requires a framework that supports the CQRS pattern explicitly — separating command handlers, query handlers, and event handlers as distinct, testable units. The framework must run in a container on ECS Fargate, support a RabbitMQ transport for the microservice projection handler, and share a TypeScript monorepo with the Next.js frontend.

Several frameworks were considered. The primary constraint is that the system is being built as a reference implementation demonstrating solution architecture capability — the framework choice should be defensible, recognisable to enterprise teams, and support the architectural patterns being demonstrated rather than obscuring them.

---

## Decision

We will use **NestJS** for the backend API and the projection handler microservice.

NestJS was selected for the following specific reasons:

**First-class CQRS support** — the `@nestjs/cqrs` module provides `CommandBus`, `QueryBus`, and `EventBus` as injectable services with typed handlers. Command handlers, query handlers, and event handlers are discrete classes registered with the module. This maps directly onto the architecture described in ADR-001 without requiring custom infrastructure.

**First-class microservices support** — the `@nestjs/microservices` module includes a RabbitMQ transport, allowing the projection handler to be a NestJS application consuming from the queue with minimal boilerplate. The same framework runs both the API and the projection handler, reducing cognitive overhead and allowing shared packages.

**Monorepo type sharing** — in a TypeScript monorepo, the API and frontend can share event type definitions, command types, and validation schemas from a shared package. NestJS's module system is compatible with standard monorepo tooling (Turborepo, Nx).

**Structured, testable architecture** — NestJS's dependency injection system and module boundaries make unit testing of command handlers and projection handlers straightforward. Each handler is a class with injected dependencies that can be replaced with test doubles.

**Recognisable enterprise pattern** — NestJS's decorator-based structure is recognisable to teams familiar with Angular or ASP.NET Core, making the codebase approachable for enterprise collaborators.

---

## Consequences

### Positive

- CQRS pattern is implemented with framework support rather than custom infrastructure
- RabbitMQ transport is available without additional libraries
- Shared TypeScript types across frontend and backend in a monorepo
- Strong conventions reduce architectural decision fatigue during implementation
- Decorator-based dependency injection is testable and explicit

### Negative

- NestJS has a larger initialisation footprint than lightweight frameworks — this makes it a poor fit for Lambda (cold starts are significant). This is acceptable because the API runs on ECS Fargate as a persistent process
- The decorator-heavy style is unfamiliar to developers from non-Angular backgrounds and has a learning curve
- NestJS abstractions can obscure what is happening at the HTTP layer for developers not familiar with the framework

---

## Alternatives Considered

**Hono**
Hono is a lightweight TypeScript framework that runs natively on Lambda, Cloudflare Workers, and Node. It was considered seriously because its minimal initialisation footprint makes it suitable for a fully serverless API. Rejected because it does not provide first-class CQRS support and the projection handler microservice pattern would require more custom infrastructure. Remains a viable option if the deployment model shifts toward Lambda in a future phase.

**Fastify**
A mature, fast Node.js framework with good TypeScript support. Rejected because it does not provide CQRS or microservices patterns natively — these would need to be built on top of the framework, reducing the architectural clarity of the codebase as a reference implementation.

**ASP.NET Core (C#)**
Considered specifically for enterprise portfolio value. ASP.NET Core with MediatR and MassTransit is a mature, widely-deployed CQRS stack in enterprise environments. Rejected because both NestJS and C# represent a similar learning investment for the primary author, and NestJS allows a TypeScript monorepo that shares types with the Next.js frontend. The architectural patterns demonstrated are equivalent regardless of language. C# remains a consideration for future team members or a rewrite if enterprise C# deployment becomes a requirement.

**Express**
Rejected. Too minimal to demonstrate structured architectural patterns without significant custom framework code. The resulting codebase would demonstrate Express, not solution architecture.
