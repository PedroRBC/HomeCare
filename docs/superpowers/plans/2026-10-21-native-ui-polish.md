# HomeCare Native UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve native interaction reliability, accessibility and visual consistency while making house selection and privacy controls more direct.

**Architecture:** Refine the incumbent Expo/React Native implementation, semantic theme and existing navigation. Keep payment/domain rules and backend contracts unchanged; fix UI state ownership in the existing provider and screens. Reuse focused shared UI only where multiple screens actually need it; introduce no general-purpose design-system framework.

**Tech Stack:** Expo54, React Native0.81.5, React19.1, TypeScript, NativeWind5 preview, Inter, React Navigation7, Bun/node:test, local Firebase emulators.

**Spec:** `.impeccable/critique/2026-10-21T14-44-50Z__src-screens.md`, plus the user's approved decisions: **Both together** (reliability/accessibility and visual consistency), **Compact layouts** (compact house selection and privacy controls before long explanations).

## Global Constraints

- Preserve the current blue identity, light/dark semantic palettes, functions, role restrictions and navigation routes.
- Preserve legal wording and substantive privacy/security claims. Legal translation is not part of this implementation; record it as a separate follow-up.
- No dependency upgrades, native configuration changes, backend schema/rule changes, destructive live actions or production data access.
- Use existing Inter400/500/700 fonts; do not request an unloaded weight.
- New UI strings must have English, Portuguese and Spanish entries using the existing locale structure.
- Native Android validation must use a compatible development build and this checkout's Metro; not Expo Go or browser screenshots.
- Reuse the current native build/caches for JS-only changes. Preserve app storage, native outputs and user/device settings.
- Financial records, dates, rates and permissions must not change as a side effect of visual polish.
- Minimum48dp target height for compact controls; aim for48x48dp standalone icon buttons. Seven-column calendars must remain within the screen with no overlapping hit areas; report any unavoidable narrow cell width rather than claiming universal48x48 compliance.
- Android setup: discover with adb devices -l, select one serial explicitly. This machine's SDK is /home/pedro/Android/Sdk and existing AVDs are under /home/pedro/.config/.android/avd. Earlier emulator task ended at30minutes; a new validation run needs an appropriate bounded runtime.

## Review Focus

- A stale house/user listener must not alter the active house's error/readiness state; pin this in Task1 provider regression tests.
- One failed initial listener must never produce a reassuring zero-pending/empty-history screen; pin Task1 component behavior.
- Two immediate submit taps must create at most one caregiver; rejection must preserve input and enable retry; pin Task2 tests.
- Long localized labels, large system text and narrow seven-column calendars must remain usable without overlapping touch areas; pin Task3 prop/label checks and native validation.
- Consent-pending users must retain export/legal/deletion access without gaining profile routes or losing policy disclosures; pin Task5 ordering/navigation tests.

---

### Task 1: Honest schedule and payment feedback

**Files:** Modify `src/context/ScheduleContext.tsx`, `src/screens/home.tsx`, `src/screens/payments.tsx`, `src/screens/history.tsx`, `src/components/UpcomingPaymentsList.tsx`, `src/i18n/locales/{en,pt,es}/{common,errors,payments,history}.ts` (matching existing namespace modules, not new JSON files). Create `src/context/ScheduleContext.test.ts`, `src/screens/payments.test.ts`, `src/components/UpcomingPaymentsList.test.ts`.

**Interfaces:** Extend `ScheduleContextValue` with `hasLoadError: boolean` and `retryLoad: () => void`. Preserve all existing method signatures, including `markPaidForPeriod(...): Promise<void>` and `UpcomingPaymentsList.onMarkPaid(item): Promise<void>`; failures must reject.

- [ ] Write failing regressions using the existing isolated `mock.module` approach (`src/context/AlertContext.test.ts`): initial listener rejection sets error/not-ready; empty successful snapshots are genuinely ready; retry resubscribes; a callback from a disposed house cannot change current readiness/error. Assert payments/history render an error/retry surface instead of success/empty content while unavailable.
- [ ] Write a rejected-payment regression: the screen displays its error alert and returns a rejected promise; the list clears busy state without hiding the card. A successful promise alone triggers completion/disappearance. Clean completion timers on unmount if retaining that implementation.
- [ ] Run new tests individually with `bun test <test-path>` and verify the assertions fail for the current behavior.
- [ ] Implement provider-owned error and retry state using the existing active/house/user guards; clean up old subscriptions. Clear error only for a new load/retry and report readiness only after all four initial snapshots. Surface one consistent retry presentation on home/payments/history; don't expose raw service messages or reassure users from partial data.
- [ ] Preserve error classification in Payments and rethrow after presenting the alert so the list cannot enter its success branch. Do not alter payment-domain rules.
- [ ] Run new tests and existing payment/service/locale tests through the isolated runner (`bun run test`); require no regressions.
- [ ] Commit this independently testable change only under the user's durable publishing authorization, with the required coauthor trailer.

### Task 2: Single-flight caregiver submission

**Files:** Modify `src/screens/create.tsx`; create `src/screens/create.test.ts`; update locale entries only if existing processing/error labels cannot be reused.

**Interfaces:** Preserve `addCaregiver(caregiver): Promise<void>`. Add screen-local busy state and a synchronous ref guard; no new shared submission abstraction.

- [ ] Write a failing handler-level test: two immediate valid submissions call addCaregiver once; rejection preserves all field values, clears busy state and permits retry; success clears fields once and shows one success alert.
- [ ] Run `bun test src/screens/create.test.ts`; verify duplicate-submit assertion fails before implementation.
- [ ] Guard before awaiting; disable the button during submission, expose accessibility busy/disabled state and show processing feedback. Release the guard in finally, retaining input on failure.
- [ ] Re-run the test and existing rate-validation tests; require pass. Verify on Android with synthetic data only.
- [ ] Commit the fix with the required coauthor trailer.

### Task 3: Native control sizing and meaningful labels

**Files:** Modify `src/components/CalendarGrid.tsx`, `src/components/CalendarHeader.tsx`, `src/components/HomeHeader.tsx`, `src/components/AvatarPicker.tsx`, `src/screens/caregiver/MyShiftsScreen.tsx`, password-eye controls in Login/Register/AccountManagement/DeleteAccount, `src/router/main-app.routes.tsx`, and locales. Create `src/components/CalendarGrid.test.ts`, `src/components/AvatarPicker.test.ts`.

**Interfaces:** Keep calendar callbacks/data props unchanged. Generate date labels using the current app locale, including full date and localized payment/shift status. Avatar choices expose accessible names and selection state; Android back closes the picker without committing changes.

- [ ] Write failing element-prop tests for complete calendar date/status labels, selected/current state where meaningful, password show/hide names, avatar selected state and onRequestClose. Assert standalone icon targets have explicit48dp dimensions or non-overlapping equivalent touch area.
- [ ] Run focused tests; verify current missing semantics fail.
- [ ] Increase calendar cells to48dp height; enlarge Today/arrows/menu/filter actions, without overlapping adjacent hit areas. Calendar width remains responsive. Add labels/roles/states; treat decorative icons as hidden from accessibility. Make avatar cancellation behavior explicit. Improve tab-label readability without clipping at long locale strings/large text.
- [ ] Run focused tests and `bun run typecheck`. On Android inspect calendar, picker and tabs in both themes, Portuguese/English and150% text; use TalkBack if available and explicitly disclose if not.
- [ ] Commit with the required coauthor trailer.

### Task 4: Consistent typography and quieter action hierarchy

**Files:** Modify `src/screens/home.tsx`, `src/components/HomeHeader.tsx`, `src/screens/caregivers.tsx`, `src/screens/create.tsx`, `src/screens/edit-caregiver.tsx`, `src/screens/payments.tsx`, `src/screens/history.tsx`, `src/screens/settings.tsx`, `src/screens/profile/UserProfileScreen.tsx`, `src/screens/profile/AccountManagementScreen.tsx`, `src/screens/house/{CreateHouseScreen,EditHouseScreen,HouseInviteScreen}.tsx`, `src/screens/payment-details.tsx`, `src/screens/AlertModal.tsx`, `src/components/UpcomingPaymentsList.tsx`, and `src/theme/palette.test.ts` only if adding semantic pairs.

**Interfaces:** No route/domain API changes. If three or more headings need the same composition, add `src/components/ScreenHeading.tsx` with `title: string`, `subtitle?: string`, `action?: React.ReactNode`; otherwise use existing conventions directly.

- [ ] Establish the shared visual decisions: working-screen heading24sp Inter700; section heading18sp Inter500; body14sp; supporting labels12sp unless platform accessibility scaling requires more. Use20dp page inset,24dp between sections and12dp between related controls, preserving safe areas and tab clearance.
- [ ] Add behavior/element regressions that destructive actions retain their confirmation handlers and remain discoverable after moving below routine controls. Do not add source-string snapshot tests for spacing; native before/after captures are the visual oracle.
- [ ] Replace mixed generic bold/semibold styles with loaded Inter families in the scoped screens. Keep total amounts prominent and labels subordinate. Use semantic success/danger colors; keep blue for primary actions and selected state.
- [ ] Make Delete Payment a separated secondary destructive action beneath record information; similarly separate house/caregiver destruction from Save. Confirm dialogs retain unmistakable destructive confirmation, cancellation and Android back handling; make long-content dialogs fully scrollable within safe bounds.
- [ ] Run `bun run lint`, `bun run typecheck`, `bun run test` and semantic palette tests. Compare native light/dark captures of home, payments/history, forms and dialogs; require no obscured actions or lost content.
- [ ] Commit with the required coauthor trailer.

### Task 5: Compact house selection and controls-first privacy

**Files:** Modify `src/screens/house/HouseSelectionScreen.tsx`, `src/screens/privacy/PrivacyCenterScreen.tsx`; create screen element/ordering tests adjacent to each. Reuse existing title/subtitle strings and preserve DATA_PROTECTION content.

**Interfaces:** House selection/edit/create and all existing RightItem callbacks remain unchanged. PrivacyCenter's canEditProfile route guard and consent saving/export busy states remain intact.

- [ ] Write failing composition tests: house choice follows a compact title/subtitle instead of the84dp decorative logo; verification/access-repair notices and caregiver/pending-invite variants remain present. Privacy order is consents, rights/actions, full protection explanations; a consent-only navigator never offers unavailable UserProfile navigation. All original disclosure keys and legal routes remain available.
- [ ] Run focused tests and verify ordering/compact-header assertions fail before editing.
- [ ] Remove the redundant large logo introduction on house selection, left-align the compact heading and reduce surrounding spacing; preserve the persistent AppHeader brand. Keep house rows, edit/create actions and first-use guidance discoverable.
- [ ] Reorder privacy sections to put consent controls and user rights before the full protection explanations. Keep all substantive wording; do not hide disclosures behind an unchecked accordion or change consent defaults. Keep deletion secondary and clearly identified.
- [ ] Run focused/full tests, lint and typecheck. Validate house selection with0/1/multiple houses and pending invitations using local test data, plus privacy from signed-in and consent-pending states. Capture before/after evidence; inspect actual images.
- [ ] Commit with required coauthor trailer.

## Whole-branch verification and delivery

- [ ] Run `bun run lint`, `bun run typecheck`, `bun run test`, `bun run test:ci-helpers`, `bun run security:check`; record actual results.
- [ ] Review the complete diff with a fresh reviewer; verify findings before applying fixes.
- [ ] Repeat native screen coverage on a compatible reused dev build. Record device, build reuse, themes, locale, keyboard, text scaling, local failure/retry checks and any blocked states. Preserve system settings and stop task-owned services after validation.
- [ ] Re-run the design critique against current rendering, explicitly distinguishing subjective scores from test results.
- [ ] Follow the user's default publish workflow: commit, push this worktree branch and create a PR against master. Do not merge, deploy or publish a release. Register the PR with T3 immediately and confirm it appears in the thread's PR list. Use required commit/PR attribution.

## Plan self-review

All approved areas map to Tasks1–5. Legal translation and externally authenticated/provider-specific screens remain explicit follow-ups rather than quietly expanding scope. Provider/list callback signatures are consistent across tasks; new error state belongs to the provider and completion state to the list. Each Review Focus item has a test/native verification owner. No product implementation has begun.
