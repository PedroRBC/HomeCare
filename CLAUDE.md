# HomeCare project instructions

## Android visual testing

- Validate app visuals in the real Android app on a connected device or emulator, not only in a browser or through source-level tests. Use a local Expo development build, not Expo Go.
- Run all commands from the current project checkout/worktree.
- Discover available devices with `adb devices -l`. If multiple devices are connected, select the intended device explicitly and use `adb -s <serial>` for subsequent commands.
- When a compatible development build is not already installed, build and install it with `bunx expo run:android --device` (the project's `bun run android` script runs `expo run:android`). Select the intended device when prompted.
- Do not rebuild the native app for every visual test. For JavaScript, TypeScript, styles, and other Metro-served changes, reuse the installed compatible development build and run `bunx expo start --dev-client`; use Fast Refresh or reload the app to load changes from the current checkout.
- Rebuild with `expo run:android` when native dependencies, config plugins, native configuration/code, or other build-time inputs change, or when the installed build is missing or incompatible with the checkout. Do not reuse a build from another checkout without checking native compatibility.
- Preserve and reuse local Bun, Expo/Metro, and Gradle caches and existing native build outputs. Avoid routine cache clearing, Gradle clean tasks, `expo start --clear`, and `expo prebuild --clean`; only clean the relevant cache/output when diagnosing a specific stale-cache or build problem.
- For USB-connected devices or local emulators, forward the active Metro port if needed with `adb -s <serial> reverse tcp:8081 tcp:8081` (replace both ports if Metro uses a different port). Open the installed development app and connect it to Metro serving the current checkout.
- Use ADB to access and exercise the app: `adb -s <serial> shell input tap <x> <y>`, `shell input swipe <x1> <y1> <x2> <y2> <duration_ms>`, and `shell input keyevent <keycode>`. Inspect relevant screens, navigation, scrolling, and keyboard behavior for the changed UI.
- Capture visual evidence with `adb -s <serial> exec-out screencap -p > <local-screenshot.png>` and inspect the resulting image. Use app-scoped logcat when diagnosing runtime errors.
- Preserve device/app data: do not clear app storage, uninstall the app, or submit destructive actions or writes to live services without explicit authorization. Prefer non-destructive navigation and authorized test data.
- Report the device used, whether the native build was reused or rebuilt, the screens/interactions checked, and any failures or blocked verification. If no usable Android device/build is available, state that visual testing was not performed rather than claiming it passed.
