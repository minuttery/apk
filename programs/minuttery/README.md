# Minuttery Solana program

Anchor workspace imported from [`0xNicko/minuttery`](https://github.com/0xNicko/minuttery), directory `minuttery_program/`, commit [`93d3160a68b8452ec69b246ce3385a73cc74af91`](https://github.com/0xNicko/minuttery/tree/93d3160a68b8452ec69b246ce3385a73cc74af91/minuttery_program).

The Rust source, program ID, Cargo manifests, `Cargo.lock`, JavaScript dependencies, and `yarn.lock` are preserved. This is ordinary source in the monorepo, not a Git submodule or a nested repository. The upstream web files were not imported over `apps/web`.

## Tooling and dependencies

Run all commands below from this directory:

```bash
cd programs/minuttery
```

Required tools:

- Rust/Cargo **1.89.0** (pinned in `rust-toolchain.toml`) and Solana/Agave **3.1.11** with `cargo-build-sbf`.
- Anchor CLI **0.31.1**, matching the Rust and TypeScript dependencies. With AVM installed: `avm install 0.31.1` and `avm use 0.31.1`.
- Node.js **24** for the original test runner's CommonJS import of the ESM ECVRF package.
- Yarn Classic **1.22.x**.

See the official [Anchor installation guide](https://www.anchor-lang.com/docs/installation) and [0.31.1 release notes](https://www.anchor-lang.com/docs/updates/release-notes/0-31-1). This workspace pins the toolchain versions used for the local setup. The older Solana 2.1 SBF compiler cannot parse the Rust 2024 dependencies already present in the imported lockfile.

```bash
yarn install --frozen-lockfile
anchor --version
solana --version
cargo --version
anchor build
```

This workspace deliberately keeps its own Yarn and Cargo lockfiles, separate from the mobile npm workspaces. The root `npm ci` installs the mobile dependencies; run Yarn here for the program's test dependencies. Build artifacts and generated IDL/types go into this directory's ignored `target/` folder. The generated test import `target/types/minuttery.ts` comes from the Rust `#[program]` module named `minuttery`; the binary and program keypair use the Cargo library name `minuttery_program`.

## Wallet and deployment

`Anchor.toml` still targets **Devnet** and the existing program:

```text
9Uf52hSPJPDqDj7QFqL5dKmdJseU1pRtzL8oNQGeDxrP
```

The provider wallet is read from the local, ignored `.solana/wallet.json`. Use your funded Devnet wallet there, or pass its path explicitly:

```bash
anchor deploy --provider.wallet /absolute/path/to/existing-wallet.json
```

To preserve the existing deployment, restore the original program keypair from your previous workspace into `target/deploy/minuttery_program-keypair.json`. The provider wallet must hold the existing upgrade authority. These private files are not present in Git. In this development environment, the supplied program keypair has been restored at that path and the supplied wallet saved at `.solana/wallet.json`, both with mode `600`. A keypair automatically generated during a fresh build does not have the existing program's address.

The restored program keypair matches the existing program ID. On 2026-09-25, a fresh Devnet query confirmed that the supplied authority keypair has public address `8hfz4tKgpwrTHdqfFJo9jQA7XH4jci39zsThNJ3ZapJN`, matching the program's current upgrade authority. It is now configured at `.solana/wallet.json` with mode `600`; the `.solana/` directory has mode `700`. The previous provider wallet (`4uWPExUJo5A5yNPjHbSNmr7wVTonHfatqYeje56Rd7dy`) is preserved locally at `.solana/wallet-4uWPExUJo5A5yNPjHbSNmr7wVTonHfatqYeje56Rd7dy.json`, also ignored by Git. No on-chain authority was changed.

Check the restored program keypair's public address against the ID above, then deploy:

```bash
solana-keygen pubkey target/deploy/minuttery_program-keypair.json
anchor deploy
```

Keep the existing program ID; do not run `anchor keys sync` against a newly generated keypair to resolve a mismatch. `.solana/`, `*-keypair.json`, and `target/` are ignored by Git.

## Tests

The imported suite is a **Devnet integration test**, not an isolated local test. It funds temporary players, submits bets in two rooms, and waits for an external worker to settle both rounds. Before running it, you need:

- Generated IDL and TypeScript types from `anchor build`.
- A funded provider wallet matching the existing config's `house` account.
- The existing ECVRF operator keypair matching the on-chain config and the worker.
- The settlement worker running on the same network/program and processing the tested rooms.

Restore the operator keypair at `.solana/ecvrf-test-keypair.json`, or set `ECVRF_KEYPAIR_PATH` to its location. The previous hard-coded workspace path is no longer used. If the file is absent, the original test behavior creates a keypair; that new keypair will not match an already-initialized config.

Test the existing deployment without deploying it again:

```bash
anchor test --skip-deploy
```

To use existing build artifacts as well:

```bash
anchor test --skip-build --skip-deploy
```

To use a custom operator key location:

```bash
ECVRF_KEYPAIR_PATH=/absolute/path/to/ecvrf-test-keypair.json anchor test --skip-deploy
```

Plain `anchor test` retains Anchor's standard build/deploy/test behavior on the configured Devnet cluster, so it also requires the deployment keypair and upgrade authority. The worker implementation is in [`services/workers/`](../../services/workers/README.md); it must be configured and running separately. Changing the cluster to localnet alone is not enough to make this worker-dependent suite self-contained.

## Daily development

Open a new terminal after installation so the Rust, Solana, and Anchor paths are loaded. For an already-open terminal:

```bash
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

Edit `programs/minuttery_program/src/lib.rs` from this workspace, then run `anchor build`. The `target/` directory contains generated artifacts and stays out of Git; it is not missing source. A local backup of the original program keypair is stored at `.solana/program-keypair.json` (ignored by Git, mode `600`). Keep a private backup outside this Codespace as well, because `target/` also contains that non-generated identity file. Do not delete it when cleaning build artifacts.

After a build, `yarn exec tsc --noEmit` checks the test code against the generated types. Deploy only with the correct upgrade-authority wallet, and run Devnet integration tests only when the operator key and settlement worker are available.

## Import validation

Installed and checked in this Codespace: Rust 1.89.0, Solana/Agave 3.1.11, Anchor CLI 0.31.1, Node 24, and Yarn Classic. The tools are on the PATH for new Bash terminals.

`anchor build` completed successfully and generated:

- `target/deploy/minuttery_program.so`
- `target/idl/minuttery.json`
- `target/types/minuttery.ts`

`yarn exec tsc --noEmit` also passes against the generated types. The IDL address matches the original program ID. The imported test referenced obsolete `status` and `winner` account fields; it now checks account closure, matching `LiquidateRound` and the generated `RoundState` type. Rust source, `Cargo.lock`, and `yarn.lock` remain unchanged. A temporary local validator exposed the built program as an executable account; this was a loading check, not a full game test.

The build emits existing Anchor macro/deprecation warnings. The installed SBF SDK also has an empty `syscalls.txt` catalog, causing its post-build checker to warn about all imported syscalls, including standard Solana functions. Build success and local account loading do not establish that all game instructions or Devnet runtime features have been tested.

No Devnet deployment, authority change, or Devnet integration test was performed. The provider wallet now matches the verified on-chain upgrade authority. Deployment requires enough Devnet SOL; the E2E test additionally requires a provider matching the configured house, the correct operator key, and the settlement worker.
