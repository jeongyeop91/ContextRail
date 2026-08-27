# ADR-0001: GitHub template and repository-local CLI

- Status: accepted
- Date: 2026-08-27

## Context

ContextRail must work for new and existing repositories, remain reviewable in Git, and operate offline without requiring a service or global package.

## Decision

Ship a GitHub Template Repository plus a dependency-free Node.js 22.13+ CLI stored in the repository. Keep domain rules pure, effects in adapters, and Throughline optional behind an integration boundary.

## Consequences

The template is immediately inspectable and forkable. Existing projects can adopt files safely. Node is the only runtime prerequisite. Features that need durable centralized coordination remain outside the MVP.
