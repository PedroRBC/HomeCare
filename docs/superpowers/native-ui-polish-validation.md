# Native UI polish validation — 2026-10-21

## Outcome

Implemented the approved combination of reliability/accessibility fixes and restrained visual refinement. The blue identity, existing functions, roles, legal wording and financial rules remain intact. House selection is compact, privacy controls precede explanations, working headings use the loaded Inter fonts, and destructive actions no longer dominate record-review screens.

Baseline: `cfe747a`. Plan: [native-ui-polish](plans/2026-10-21-native-ui-polish.md). Initial assessment: [all-screen critique](../../.impeccable/critique/2026-10-21T14-44-50Z__src-screens.md).

## Automated verification

All commands completed with exit code0 after the review fix pass:

| Command | Result |
| --- | --- |
| `bun run lint` | ESLint and Prettier passed |
| `bun run typecheck` | App and reviewer TypeScript passed |
| `bun run test` | 265 registered tests across50 files passed |
| `bun run test:ci-helpers` | 103 passed;0 failed/skipped |
| `bun run security:check` | Known secret filenames/patterns check passed; not a complete secret audit |
| `git diff --check` | Passed |

New regressions were observed failing before their fixes: schedule error/readiness/retry, rejected-payment propagation, completion timer cleanup, duplicate caregiver submission, accessible calendar/avatar/password controls, whole-dialog scrolling, privacy ordering/route guards, cross-house navigation, metadata-only navigation stability, busy-label contrast and actual native CSS dimensions.

The real Tailwind/native compiler proved two important implementation details: existing Inter aliases were not emitted from the legacy JS Tailwind configuration, and native `h-12`/`min-h-12` mapped to42dp under the14px rem default. Fonts now have explicit CSS aliases; target sizes use explicit48px units, with shared working headings/descriptions explicitly24px/14px. Tests exercise actual compiled declarations rather than trusting utility names.

## Independent review

One fresh, read-only whole-branch reviewer assessed the five implementation commits. It found no Critical issue, one Important cross-house draft/navigation issue, and a busy-label contrast issue initially graded Minor. The contrast issue was regraded Important because it was the only waiting feedback on the new async button and measured approximately1.26:1 on the light disabled surface. Both were reproduced and fixed in one test-first pass; no second review was substituted for regression verification.

Cross-house navigation now replaces the old stack with a fresh house list/care-management stack. Metadata-only updates for the same house do not navigate. Same-house retry keeps navigation and drafts mounted; switching house cannot return to the previous house's draft through Back.

## Android evidence

- Device: `HomeCare_API_35`, serial `emulator-5554`, Android15/API35, x86_64, physical1080×2400, density420.
- Build: reused the compatible local3.0.1 development build compiled from this checkout during the initial audit; no rebuild for these JS/TS/style changes, no Expo Go.
- Metro served this worktree. Firebase used the synthetic fixture and local `demo-homecare-ci` Auth/Firestore emulators. No production writes, backend deployment, app-storage clearing or uninstall.
- Initial audit source-reviewed all28 screen implementations and visited all26 routed screens. Post-change native checks covered the affected manager workflows, house forms/invites, caregiver empty state/forms and one synthetic creation, profile/account/avatar, privacy before/after consent, payment/history/dialog/confirmation paths and settings.
- Light English and dark Portuguese were inspected. Actual150% system text was verified after restarting the app, including calendar, payments, history and payment details. Tab labels now use fit-to-width rather than splitting words over two lines.
- A360dp phone-width override was exercised and reset. Seven-column calendar cells remain narrower than48dp where necessary; their height is48dp and hit areas do not overlap.
- TalkBack service binding and accessibility-tree labels were smoke-tested, not certified through a complete spoken flow. Original accessibility settings were restored.
- Gboard input and dismissal were exercised on Feedback without sending a report. This is not a full keyboard reachability certification for every form.
- Native Back dismisses the avatar picker without saving. Deletion confirmations were canceled; no payment/account/house was deleted.
- A synthetic second house was created solely in the emulator. An A-house draft did not appear in B or return through the old stack.
- Local schedule-read denial produced the explicit unavailable-data screen, not an empty/up-to-date success state. Restoring original local rules and retrying preserved the current Payments tab and an existing caregiver draft.
- Local payment-create denial produced an error while retaining the unpaid card and the R$430 pending total. Original emulator rules were restored in `finally`; tracked `firestore.rules` was never changed.
- Harness session boundaries stopped the original audit/validation background processes. The final capture run reused the emulator/build and fresh local synthetic accounts. Text size1.0, physical screen dimensions, original input method and original accessibility settings were verified after checks.

Evidence is local and ignored under `reports/design-review/`: `screens/after-*` records the broader validation and fault-injection checks; `screens/final-*` records final dimensions/type,150% text and light/dark captures. Private generated account credentials remain in ignored files and must not be committed or shared.

## Visual reassessment

Using the same subjective ten-heuristic rubric, the initial24/40 baseline improves to a directional29/40: system status, consistency, error prevention, recognition and error recovery each improve from2 to3. Other scores are unchanged. This is the implementer's evidence-informed reassessment, not an independent numerical evaluation or accessibility certification.

The remaining major design follow-up is reviewed translation of Portuguese-only legal documents. Do not close the original critique backlog as if that issue were resolved. Onboarding, Facebook linking/social authentication, maintenance/update overlays, populated/pending caregiver variants, tablets and landscape were not newly certified by this pass. Zero/one/multiple-house composition and consent-only navigation restrictions also have source-level regression coverage; native one/two-house cases were exercised.

## Rulings made, in order

1. **Keep legal translations separate.** Preserve reviewed legal wording. Cost: non-Portuguese legal reading remains limited.
2. **Preserve navigation during same-house loading.** Add a loading gate rather than unmount Routes; subsequently constrain house changes with fresh reset stacks. Cost: lifecycle/scope needs explicit regression coverage, which was added.
3. **Exclude generated graph/design caches from Prettier.** Avoid rewriting123 unrelated generated files. Cost: generated artifact formatting is not linted; source remains linted.
4. **Do not invent account-management visibility toggles.** Fix the four existing controls in Login/Register/DeleteAccount through PasswordToggle; AccountManagement had no toggle. Cost: that screen still lacks this optional affordance.
5. **Declare Inter aliases in CSS.** The legacy JS configuration was not emitted by the real compiler. Cost: typography changes across screens; compiler tests and native captures cover it.
6. **Regrade busy-feedback contrast as Important.** The only waiting feedback was unreadable. Cost: a small foreground fix beyond strict minor deferral; its regression is pinned.
7. **Use explicit native pixel sizes instead of rescaling the entire system.** Native rem defaults were producing42dp targets/21sp headings. Cost: local literal sizes need maintenance; compiler tests enforce them.
8. **Limit native certification to evidence collected.** Screen-reader smoke, phone widths and text scaling are not a complete device/accessibility audit. Cost: additional platforms/classes remain follow-up; responsive calendar widths can be below48dp without overlapping hit areas.
9. **Keep the review's legal-translation deferral.** Same approved decision as ruling1; the remaining critique issue is retained. Cost: untranslated legal content remains.
10. **Keep Back as the error-screen escape.** Fresh HouseManagement beneath CareManagement provides an exit; no new menu was added. Cost: unusual root-navigation cases remain worth testing; no trap observed.
11. **Leave unrelated pre-existing behavior out of scope.** Avoid validation/backend/legacy-UI drift. Cost: unrelated existing issues remain.
12. **Do not add coverage-only assertions.** The existing guards plus native retry/scope checks cover the reviewed bug. Cost: broader stale-user and every-field draft assertions remain unpinned.

**Deferred reviewer minors:** none after the justified busy-contrast regrade. Broader limitations and legal translation above remain follow-ups, not silently claimed as complete.
