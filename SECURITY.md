# Security policy

## Supported versions

The latest `0.1.x` release and the latest commit on the default branch are evaluated for security fixes.

## Reporting

Use GitHub private vulnerability reporting after the public repository is created. Until then, contact the repository owner through an agreed private channel. Do not open a public issue containing an exploit, secret, personal path, private repository content, or raw agent transcript.

Include a minimal reproduction, affected command and version, impact, and whether the issue requires a write-capable command. Use synthetic fixtures and a temporary HOME whenever possible.

## Security boundaries

- Offline `check`, `route`, and `continue` must not mutate the repository or HOME.
- Scaffold and integration writes require a reviewed plan or explicit apply.
- Executable boundaries accept argv arrays and do not use a shell.
- Paths are normalized and confined to the selected project or managed root.
- ContextRail does not store raw prompts, responses, transcripts, or secrets as measurements.
- Throughline verification uses its public CLI and never reads its database directly.
