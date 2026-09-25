# Shared Solana client

Reserved for reusable instruction builders, account decoding, program addresses, and generated bindings or IDL where applicable.

No mobile code has been extracted yet. When there is shared code to import, add a private `package.json` with a unique name, explicit exports, and dependencies. The root `packages/*` workspace pattern already includes this directory. Consumers should declare the package as a dependency.

Keep this package independent of React Native, browser wallet adapters, and worker-specific APIs so all clients can consume it.
