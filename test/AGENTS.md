# Test instructions

- Use `node:test`, real temporary directories, and synthetic fixtures.
- A test must state the production behavior that would make it fail.
- Never mutate the user's HOME, global packages, Git configuration, or reference repositories.
- Live integration checks are read-only and separate from deterministic fixture tests.
- Keep fixture content product-neutral and free of personal absolute paths.
