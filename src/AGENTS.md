# Source instructions

- Keep domain logic in `core/`; it must not write files or spawn processes directly.
- Put filesystem, Git, and process effects in `adapters/`.
- Put optional product bridges in `integrations/`; core commands must work without them.
- Return structured results with stable issue codes; render text only in `cli/`.
- Accept argv arrays at process boundaries. Never interpolate a shell command.
- Add a focused failing test before adding or changing behavior.
