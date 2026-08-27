# Measurement

## Purpose

Measurements evaluate context selection and continuity without storing conversation bodies. ContextRail does not claim a reduction percentage without a defined baseline, comparable tasks, and reported provenance.

## Storage

Records live only in `.context-rail/runtime/measurements.jsonl`, which is Git-ignored. A record includes schema version, timestamp, task ID, a one-way session identifier hash, provenance source, and numeric metrics.

Allowed provenance is `host_reported`, `tool_reported`, `manual`, or `estimated`. Reports group estimated values separately from reported values.

## Initial metrics

- Input and output token counts when exposed by a host or entered manually.
- Routed instruction and document bytes.
- Context utilization ratio when numerator and capacity are known.
- Sessions or handoffs needed to complete a task.
- Validation command count and duration when recorded explicitly.

Raw prompts, responses, transcripts, secrets, source bodies, and personal paths are rejected. Local records are operational observations, not committed project authority.
