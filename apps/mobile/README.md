# Minuttery Android app

This directory is the original Expo / React Native project. App source, assets, dependencies, `app.json`, and `eas.json` live here.

Install dependencies with `npm ci` from the repository root. Then run the existing commands from this directory:

```bash
npm run dev
npm run android
npm run build:apk
npx eas-cli@latest build --platform android --profile approval
npx eas-cli@latest update --channel approval --message "Describe the change"
```

The EAS project, update URL, runtime policy, channels, package name, and build profiles are unchanged. Keep using the same Expo account and credentials. Restart Metro with `npx expo start --clear` after moving an existing checkout.

The repository root also forwards the original npm scripts to this app. Keep a single npm lockfile at the repository root; add mobile dependencies here with `npx expo install <package>` or from the root with `npm install <package> --workspace=minutteryapk`.

Generated `android/`, `ios/`, `.expo/`, and `dist/` files are local to this app and ignored by Git. Full setup and build instructions are in the [root README](../../README.md).
