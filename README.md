# minuttery

Minuttery is a lottery game on Solana with one-minute rounds. Each player connects their wallet, chooses a room, and enters a shared prize pool. The interface displays the countdown, player count, prize pool, and results, with links to view transactions on Solana Explorer.

This monorepo contains the **Android app generated with Expo and built with React Native and TypeScript** in [`apps/mobile/`](./apps/mobile), alongside the web client in [`apps/web/`](./apps/web). The included configuration uses **Solana Devnet and test SOL**.

[Web version](https://minuttery.com) · [Repository releases](https://github.com/minuttery/minuttery/releases)

## Repository layout

```text
apps/
  mobile/                 Expo / React Native Android app
  web/                    Existing standalone web client
services/
  workers/                Round settlement worker and results API
programs/
  minuttery/              Anchor workspace for the Solana program
packages/
  solana-client/          Reserved for shared Solana client code
  shared/                 Reserved for shared types and validation
```

The repository uses npm workspaces and one `package-lock.json` at the root. Install dependencies with `npm ci` from the repository root. The mobile app keeps its existing dependencies and scripts in `apps/mobile/package.json`; the shared packages contain documentation only until their implementations arrive. The worker and results API live in `services/workers/`. The Solana workspace in `programs/minuttery` keeps its own Yarn and Cargo lockfiles. Rust programs keep their own Cargo/Anchor tooling.

**Expo and EAS commands run from `apps/mobile`.** Its `app.json` and `eas.json` retain the same project ID, Android application ID, runtime policy, update URL, channels, and build profiles. No new Expo project or credentials are needed for this move. For an existing checkout, restart Metro from the new directory with `npx expo start --clear` once.

The root npm scripts forward to the mobile workspace, so `npm run dev`, `npm run android`, `npm run build:apk`, and the other existing npm scripts also work from the repository root. Arguments are forwarded, for example `npm run dev -- --clear`. Direct `npx expo ...` and `npx eas-cli ...` commands must run inside `apps/mobile`.

```bash
# From the repository root:
npm ci
cd apps/mobile

# Same EAS commands and profile/channel as before:
npx eas-cli@latest build --platform android --profile approval
npx eas-cli@latest update --channel approval --message "Describe the change"
```

This follows Expo's [npm workspace support](https://docs.expo.dev/guides/monorepos/) and [EAS monorepo layout](https://docs.expo.dev/build-reference/build-with-monorepos/). Each application or service will have its own deployment process. A coordinated source change does not automatically update already-installed APKs.

## Solana program

The Anchor workspace lives in [`programs/minuttery/`](./programs/minuttery/README.md). From that folder, use `yarn install --frozen-lockfile`, `anchor build`, `anchor deploy`, and `anchor test --skip-deploy` for tests against the existing Devnet deployment. See its README for toolchain requirements, the original deployment/operator keys, and the external settlement worker required by the integration tests. Mobile Expo/EAS commands and dependencies remain independent.

## Designed for mobile from the ground up

**Designed for mobile from the ground up.** The Android experience uses native React Native components: a portrait layout, touch controls, gesture-dismissable bottom sheets, animations, support for device safe areas, and the native share menu for invitations. Wallet connections use Mobile Wallet Adapter; Seed Vault integration is also available for compatible Solana Mobile devices.

Although a web version exists, the APK has its own native interface. The Android game is implemented in [`apps/mobile/components/game/game-feature.tsx`](./apps/mobile/components/game/game-feature.tsx).

## Playing together: APK + desktop web + mobile web

All three clients can participate in the same rounds: they share the Solana program and each room's accounts.

1. Each player opens their client:
   - **Android:** install and open the APK, then connect a wallet compatible with Mobile Wallet Adapter.
   - **Desktop web:** open [minuttery.com](https://minuttery.com) and connect a browser wallet.
   - **Mobile web:** open the same URL. If the browser does not provide a compatible wallet, use a wallet's built-in browser, such as Phantom's. The passkey option requires WebAuthn and PRF support on the device and browser.
2. Use **separate wallets**, all on **Devnet**, with enough test SOL for the entry and transaction fees. If using a passkey, deposit test SOL into the address shown in that session.
3. Choose the **same room**: 0.1, 1, 2, or 5 SOL per entry.
4. Check that everyone sees the **same round number** and confirm your entry **before second 55**. Each round lasts 60 seconds; enter early enough for the transaction to confirm.
5. Wait for the result. The player count and prize pool update as the client queries the network; the history lets you review results and their transactions.

For example, one player using the APK, another on a computer, and another in Phantom's browser can enter the **0.1 SOL** room during the same round and play together.

Rooms are public. Sharing an invitation opens Minuttery, but does not create a private room or automatically select a room or round: coordinate both with the other players. Keep automatic date and time enabled on your devices.

For a local installation to participate alongside the other clients, everyone must use the same network and this program:

```text
9Uf52hSPJPDqDj7QFqL5dKmdJseU1pRtzL8oNQGeDxrP
```

## Clone and run Android locally

### Requirements

- Node.js 22.13 or later in the 22.x release line, or Node.js 24.3 or later in the 24.x release line, and npm.
- JDK 17 and Android Studio with the Android SDK, Platform Tools, and any build components requested by Gradle, including NDK and CMake.
- An Android phone with USB debugging enabled, or an emulator. To test wallet connections, use a device with a compatible wallet installed.
- Internet access to install dependencies and query Solana and the results API.

### Installation

```bash
git clone https://github.com/minuttery/minuttery.git
cd minuttery
npm ci
cd apps/mobile
```

Connect your phone or start the emulator, then run:

```bash
adb devices
npm run android
```

`npm run android` runs `expo run:android`: it generates the Android project if needed, builds and installs the app, and starts Metro. The `apps/mobile/android/` directory is generated with Expo and excluded from Git.

To start Metro in subsequent sessions:

```bash
npm run dev
```

If your USB-connected phone cannot reach Metro:

```bash
adb reverse tcp:8081 tcp:8081
```

This app requires its own native build because of its wallet, passkey, and cryptography dependencies. **Expo Go is not sufficient**; see the [Expo documentation on native code](https://docs.expo.dev/workflow/customizing/).

You do not need an `.env` file to use the included configuration. The network is defined in [`apps/mobile/constants/app-config.ts`](./apps/mobile/constants/app-config.ts); the program and results API are defined in `apps/mobile/components/game/game-feature.tsx`. For an initial local test, use a wallet connection: native passkeys use the `minuttery.com` domain and require a valid association between the domain and the app's signing identity.

## Run the web client locally

The browser client in this repository is located in `apps/web/`. You can preview it with Python 3 from the project root:

```bash
python3 -m http.server 8080 --directory apps/web
```

Open `http://localhost:8080`. No Expo build is required, but Internet access is needed to load dependencies from CDNs and connect to Solana.

To view it from another phone on the same network, open `http://<your-computer-local-IP>:8080`. This lets you test the interface; passkeys require a secure context, such as HTTPS or `localhost`. To test authentication from another device, use an HTTPS origin and a compatible wallet or passkey.

**Scope of the local setup:** this repository contains the clients and the [Solana program](./programs/minuttery/README.md), and the [worker and results API](./services/workers/README.md) that process rounds and publish results. Running the app on your computer still depends on the deployed program and running worker/API services; copying their source does not start them.

In [`apps/web/config.js`](./apps/web/config.js), `API_BASE` is empty: requests to `/winners` use the same origin. This static server does not provide API routes. For history and synchronization, configure an API or a local proxy. The optional local `scripts/preview-web.py` proxy is excluded from Git and is not included in new clones. The Android client queries `https://minuttery.com/winners`.

The `npm run web` script starts the Expo browser entry point, but the instructions above apply to the standalone web client included in this repository; the native dependencies do not guarantee web compatibility for the Expo entry point.

## Build and distribute the APK

Run the commands in this section from `apps/mobile`. To generate a local debug APK:

```bash
npx expo prebuild -p android
cd android
./gradlew assembleDebug
cd ..
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

On Windows, use `gradlew.bat assembleDebug`. This debug APK requires Metro to load the JavaScript code during development.

To generate an installable distribution APK with EAS, the project includes the `approval` profile:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile approval
```

This workflow requires an Expo account with access to the configured project. If you cloned the repository for your own project, configure your EAS project and its identifiers in `apps/mobile/app.json`, including the updates URL, before building or publishing updates. Local development builds do not require access to the team's EAS project.

**Recommended distribution:** attach the APK to a [GitHub Release](https://github.com/minuttery/minuttery/releases), together with its version and installation instructions. This makes it available from the repository without adding binaries to Git history. GitHub supports releases for [distributing binary files](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases). The releases link does not imply that an APK has already been published.

To install a downloaded APK, open it on Android and allow installation from that source when prompted by the system.

### Updates with EAS Update

The `approval` profile is linked to the `approval` channel. Contributors with project permissions can publish compatible JavaScript, styling, and asset changes:

```bash
npx eas-cli@latest update --channel approval --message "Describe the change"
```

Changes to native dependencies or configuration require rebuilding the APK and maintaining a compatible runtime version.

## Development checks

From the repository root:

```bash
npm run lint:check
npm exec --workspace=minutteryapk -- tsc --noEmit
```

## License

[Apache 2.0](./LICENSE).
