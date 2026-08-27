# Project

## Purpose

ContextRail is a reusable, repository-local operating foundation for coding agents. It helps an agent locate only relevant context, follow project rules and state, validate targeted changes, and continue work in a new session.

## Primary users

- Maintainers creating a new agent-friendly repository from a GitHub template.
- Teams adopting consistent context and memory contracts in an existing repository.
- Coding agents that need deterministic routing and continuation without loading an entire project.

## Product contract

ContextRail provides hierarchical instructions, a bounded document router, validated Active Authority, file-based project memory, safe scaffolding, targeted validation hints, local measurements, and an optional Throughline bridge.

## Non-goals

- Acting as an autonomous coding agent or model host.
- Replacing Git, issue trackers, CI, or project-specific documentation.
- Persisting raw conversations or secrets.
- Requiring Throughline for core operation.
- Claiming token savings without comparable measured evidence.

## MVP success

The repository can validate itself, bootstrap a product-neutral project, route context for a target path, produce deterministic continuation data, record privacy-preserving local metrics, and report optional Throughline readiness without mutating the user's environment during ordinary checks.
