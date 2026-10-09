# Local data migration (PR #8)

This command upgrades the local Firebase test data from the master/2.5.0 format to the 2.6.0 encrypted format. It operates on **all houses**, including ones nobody has opened in the new app.

## Run it

Install dependencies with `bun install --frozen-lockfile`. Start the local emulators with `bun run emulators:local` in one terminal (Node 22+ and Java 21+ are required). This uses Auth **9199** and Firestore **8180** for `demo-homecare-migration` and exports local data to `reports/local-emulators` on a clean exit. If those emulators are already running here with your test data, keep using them. Close the old Android app before apply.

On later starts, reload the saved data with `bun run emulators:local -- --import reports/local-emulators`. To rehearse with existing legacy data, import that emulator export instead. A fresh emulator has no old data to migrate: the command refuses an empty dataset rather than reporting success.

```bash
# Read-only inventory: shows changes and records that need repair.
bun run migrate:local -- --dry-run

# The migration command: backs up, freezes clients, converts and verifies data.
# The flag completes old deletions whose house parent is already absent.
bun run migrate:local -- --apply --finish-deleted-houses

# Independent read-only check after the migration.
bun run migrate:local -- --verify
```

Success ends with **`MIGRATED_AND_VERIFIED`**. An already completed dataset ends with **`ALREADY_MIGRATED_AND_VERIFIED`**. A rerun is safe: existing keys and ciphertext are reused, and completed records are not encrypted twice. If an apply run is interrupted, run the same apply command again.

The default project is `demo-homecare-migration`. Use `--project demo-another-test` for another local test project. This command requires loopback emulator addresses and a `demo-*` project; it does not access a live Firebase project. To use different ports, invoke the CLI with `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` set explicitly.

## What it changes

1. Checks active house owners and membership identities against local Auth. Conflicting grants, wrong owner claims, malformed values and unreadable ciphertext stop preflight; the script does not guess a role or replace a lost key.
2. Freezes local client access and saves a timestamped backup in `reports/migrations/` (or `--backup <new-file>`). Backups contain personal data and keys and are written with owner-only permissions.
3. Creates one key for each active house that needs one. Encrypts caregiver and payment-history fields using the app's AES-256-GCM format and document/field binding. Names, amounts and all other logical record values remain intact.
4. Converts random membership IDs to `{houseId}_{userId}`, retaining the same roles. Large sets are processed in bounded operations.
5. Marks old pending invitations without `expiresAtTs` as expired. The owner can send a new invitation through the new app; the script does not silently grant access or extend an old invitation.
6. With `--finish-deleted-houses`, removes orphaned children, keys, links, invitations and grants for house parents that are already absent. Active houses are not deleted.
7. Re-reads and verifies ciphertext/key readability, absence of legacy plaintext, canonical grants and invitation status. Only after verification does it install this version's `firestore.rules` and reopen local clients.

Account profiles, authentication UIDs/passwords, optional consent choices, house metadata, schedules and payment markers keep their existing meaning. Caregiver links remain the explicitly authorized readable projection. No consent or email verification is invented by migration.

Keep the **first backup from before conversion**: backups made during retries may already contain partially migrated data. The typed JSON backup covers the Firestore inventory, not Auth passwords. Emulator export/import preserves the local Auth and Firestore dataset. There is no automatic restore command for the typed JSON backup.

## If it stops

- **`BLOCKED` before apply:** the report identifies paths and reasons. Repair conflicting/invalid access records or key/data problems, then rerun the dry-run. It has not started migration writes.
- **Empty/wrong emulator dataset:** check the project and import your legacy emulator data; do not treat a fresh empty emulator as a migration rehearsal.
- **Deleted-house cleanup required:** rerun with `--finish-deleted-houses` to finish already-deleted house records.
- **Interrupted apply:** completed transactions remain valid; clients stay frozen. Rerun `--apply` to resume from the database. Do not switch back to permissive rules over a partially migrated dataset.
- **Blocked retry:** a preflight failure does not reopen clients frozen by an earlier apply. They remain frozen until an apply completes successfully.
- **Missing/wrong key with existing ciphertext:** recover the original key/data. Generating a different key would not recover the encrypted values, so the script refuses that operation.

After success, install/open the new Android build and check house access, rates, shifts, history, export and deletion. The local rehearsal notes/recordings separately identify the tested commits and outcomes. This command is a local migration tool, not a claim that old live binaries are universally blocked.

## Regression coverage

The source tests run against separate demo project IDs, leaving the owner’s local test dataset intact:

| Behavior | Source coverage |
| --- | --- |
| Read-only planning; unopened houses; exact values; stable second apply | `src/security/localMigration.test.ts` |
| Interrupted conversion resumes with the same key | `src/security/localMigration.test.ts` |
| Conflicting roles, wrong owner, missing house references and missing/wrong key refuse writes | `src/security/localMigration.test.ts` |
| Deleted-parent children are found and cleanup preserves active houses | `src/security/localMigration.test.ts` |
| More than 500 legacy grants normalize in bounded writes | `src/security/localMigration.test.ts` |
| Live targets, remote endpoints and empty datasets are refused | `src/security/localMigrationCli.test.ts` |
| Original private backup, final rules, verification and already-migrated status | `src/security/localMigrationCli.test.ts` |
| Backup collision preserves rules; failure after freeze stays closed; retry reopens | `src/security/localMigrationCli.test.ts` |
| Valid houses/partial export remain available; missing owned data blocks erasure; missing manager-only grants can be removed | `src/security/firestoreService.test.ts` |
| New optional sensitive fields require ciphertext | `src/security/firestoreRules.test.ts` |

Start Auth and Firestore emulators before `bun run test:rules`. CI uses `emulators:exec` with both emulators and requires their presence. For a separate disposable test run (stop another instance using these ports first):

```bash
bunx firebase-tools@15.30.2 emulators:exec --project demo-homecare-rules --only auth,firestore "bun run test:rules"
```

The Android rehearsal additionally checks in-place upgrade/session continuity, decimal rates, regular/extra payments and reversal, restart, real JSON exports, wrong-password refusal, manager/account deletion and isolated house deletion. Database assertions and screen recordings complement the automated source tests.
