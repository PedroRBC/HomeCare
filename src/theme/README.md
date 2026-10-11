# Dynamic appearance

HomeCare follows [NativeWind v5's dynamic themes guide](https://www.nativewind.dev/v5/guides/themes): `VariableContextProvider` overrides inherited CSS variables without rebuilding the stylesheet.

- `palette.ts` defines the Figma blue light palette and its dark counterpart. `useAppTheme().colors` supplies the same values for navigation, icons, placeholders, switches, and other props that do not accept utility classes.
- `global.css` declares light-mode `:root` defaults and semantic Tailwind aliases with `@theme inline`. Utilities such as `bg-app`, `bg-surface`, `text-content`, and `text-accent` reference the inherited `--app-*` variables.
- `metro.config.js` excludes every `--app-*` token from native compiler inlining. Without this, the light defaults can be baked into native styles and ignore subsequent provider changes. Add any new token to the palette, CSS defaults/aliases, and exclusion list together; the palette/compiler tests check their parity.
- `metro.transformer.js` forwards those options to the CSS compiler. `react-native-css@3.0.7` reads them from per-file transform options, which Metro never populates, so without the wrapper the exclusion list is silently ignored and dark mode keeps light backgrounds/text. The compiler test runs Metro's real transformer to catch this.
- `AppThemeProvider` scopes variables to the entire app, including React Native modal children. Web document defaults also follow the preference so portal content and overscroll use the same palette.

## Preferences

Settings exposes **White / Dark / Auto**, localized in English, Spanish, and Portuguese. The stored values are `light | dark | system` under AsyncStorage key `@homecare:theme`; missing or invalid values default to Auto. Auto follows device appearance changes and refreshes on foreground resume. Manual modes remain fixed when the device changes appearance.

Preference hydration cannot overwrite a more recent user selection. UI updates are immediate, writes are ordered, and unavailable storage does not block startup. A failed write keeps the current appearance for this session, but cannot guarantee persistence after restart.

## Native branding

The native splash follows the OS before JavaScript can load the saved preference; subsequent app UI uses the saved preference. `expo-system-ui` enables Android's automatic appearance configuration. Native splash, launcher artwork, or native dependency changes require a new native build, not just a JavaScript reload.

The logo PNGs in `assets/brand/` and the launcher, splash and favicon images in `assets/` are committed exports of the HomeCare Figma artwork; replace them directly when the brand changes.

## Checks

Run `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run deps:check`. The unit runner includes preference races, palette contrast/parity, and the actual Tailwind-to-native compiler pipeline (including opacity modifiers). Android prebuild/export checks validate configuration and bundling; they do not replace live device testing of appearance switching, modals, persistence, and splash rendering.
