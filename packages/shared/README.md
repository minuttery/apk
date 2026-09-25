# Shared application code

Reserved for types, validation, and pure application logic used by more than one component.

No implementation or npm package has been created yet. Add a private `package.json` with a unique name and explicit exports when shared code is introduced; the root `packages/*` workspace pattern already includes this directory.

Keep platform-specific UI, wallet integrations, and service credentials in their owning applications or services.
