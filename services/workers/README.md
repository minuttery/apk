# Minuttery worker and results API

Imported from the VM's `minuttery-worker` directory. `index.js` settles Solana rounds and records results in SQLite; `api.js` serves `/sync`, `/winners`, and `/stats/:wallet` on `127.0.0.1:8787`. Deploy these processes independently from the mobile app and Solana program.

## Configuration

Both processes load `.env` from this directory. Existing environment variables take precedence. Paths for the wallet, ECVRF keypair, IDL, and `DB_PATH` resolve relative to this directory; absolute paths are also supported. `DB_PATH` defaults to `minuttery.db`. See `.env.example` for the configuration names.

The imported `.env` and ECVRF keypair are preserved locally with permissions `600`, and excluded from Git. The original `/opt/minuttery-worker/` paths in the local `.env` now use relative paths. **The referenced `secrets/worker-wallet.json` was not included in the copied files**: restore the worker's funded signer there, or set `WALLET_PATH` to its actual location. The program upgrade-authority wallet is not automatically used by this service.

The imported database, `minuttery.db-wal`, and `minuttery.db-shm` were moved together without opening the database. They remain local and ignored. The original `index.js.backup`, npm cache, and copied dependencies were also preserved and ignored. The copied `node_modules` is incomplete; install dependencies before starting either process.

## Run

From the repository root, install dependencies with `npm ci`; the root lockfile includes this workspace. The imported `package-lock.json` is retained as the original VM dependency snapshot.

```bash
npm run check --workspace=minuttery-worker
npm run start --workspace=minuttery-worker
# In a separate terminal:
npm run start:api --workspace=minuttery-worker
```

The worker submits transactions to the RPC network configured in `.env`. Starting it requires the correct ECVRF operator, a funded signer, and a matching deployed program/IDL. The API expects the existing database tables; no fresh-database migration was included in the supplied files. Preserve a consistent SQLite backup when transferring data from a running VM.

For an existing VM installation, update the process manager's working directory and entrypoints if the installation path changes. No systemd, PM2, reverse-proxy, or deployment configuration was supplied. The API still listens only on localhost and retains the existing website CORS settings.

The import was checked for file preservation and JavaScript syntax. Neither process was started during the move.
