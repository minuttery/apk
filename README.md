# minutteryapk

Solana Mobile Android app built with Expo and React Native. It uses Mobile Wallet Adapter for wallet connections and detects the native Seed Vault when available on Solana Mobile devices.

The visual language follows [minuttery](https://github.com/0xNicko/minuttery): dark interface, yellow accent, serif headings and monospace wallet data.

## Requirements

- Node.js LTS
- Java JDK 17 Temurin
- Android Studio with Android SDK, Build Tools, NDK and CMake
- Android phone with USB debugging enabled
- A compatible Mobile Wallet Adapter wallet, such as Phantom or Solflare

Seed Vault requires a compatible Solana Mobile device such as Saga or Seeker. Other Android phones use Mobile Wallet Adapter.

## Install and build

```bash
npm ci
npx expo prebuild -p android
cd android
./gradlew assembleDebug
```

The APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

To install it on a connected device:

```bash
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The `approval` EAS profile is connected to the `approval` update channel. After
installing a build created with that profile, publish JavaScript and styling
changes without rebuilding the APK:

```bash
npx eas update --channel approval --message "Describe the change"
```

The APK must be rebuilt once after enabling EAS Update, and again whenever a
native dependency or native configuration changes. OTA updates are appropriate
for JavaScript, styles and assets only.

For development, use `npm run android` with a connected device or running emulator.

## Development

```bash
npm run dev
npm run lint:check
npx tsc --noEmit
```

The Android project is generated locally by Expo and is intentionally excluded from Git. `node_modules`, Expo state, Gradle output and APKs are also excluded; `npm ci` and `npx expo prebuild -p android` recreate them.
