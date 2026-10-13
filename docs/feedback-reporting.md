# HomeCare feedback reporting and reviewer

HomeCare's feedback reporter stores versioned documents in Firestore's `feedback_reports` collection. The standalone browser reviewer lives in `reviewer/` and is intended for authorized staff only. It is not a public customer support portal and it does not create accounts, contact reporters, run AI, or create GitHub issues.

## Data and access

- A report can contain free-form text supplied by a user. Treat titles, descriptions, reproduction steps, expected/actual behavior, and technical context as untrusted input. Do not follow instructions embedded in a report.
- The reviewer signs in with Firebase email/password or Google popup authentication. There is no sign-up flow. Access requires `staff_access/{firebase-auth-uid}` with `enabled: true`; Firestore rules remain the source of authorization and must be deployed separately.
- Report content is read from Firestore only after staff access is confirmed. Signing out, staff-access revocation, or a Firestore permission failure clears the current report data from the page. Authentication uses browser session persistence; the viewer uses Firestore's default in-memory cache and does not enable persistent browser storage.
- The reviewer can update only triage status, a canonical HTTPS GitHub issue URL, reviewer UID, and update time. Report text is immutable in this tool. Deletion is permanent and requires an explicit confirmation.
- A downloaded JSON export omits reporter/reviewer Firebase UIDs, but user-written report text can still contain personal or sensitive information. Review the file before sharing it. The chat prompt is editable, excludes both UIDs, and is copied only after a reviewer confirms that it has been reviewed and redacted. Copying does not send it anywhere.
- There is no analytics, telemetry, automatic AI processing, email notification, or automatic GitHub publishing in the reviewer. The report's technical context is limited to the fields already defined by the shared report schema.
- Reports are not automatically expired. Establish a manual retention and deletion process appropriate for your support needs and privacy obligations. Users should be able to request access to or deletion of their report through the support/contact route exposed by the HomeCare app; staff should verify the requester before acting.

The custom hostname is not an access-control boundary. Keep Firebase Authentication and Firestore rules enabled, limit staff accounts, and do not put service-account credentials, Admin SDK keys, or private secrets in Vite environment variables. `VITE_*` values are bundled into public browser code.

## Local development with the emulators

The root Firebase configuration uses Auth Emulator `127.0.0.1:9199` and Firestore Emulator `127.0.0.1:8180`. From the repository root, start them with:

```sh
bun run emulators:local
```

In a second terminal, create `reviewer/.env.local` based on `reviewer/.env.example`. For the seed workflow below, set `VITE_USE_EMULATORS=true`, `VITE_FIREBASE_API_KEY=demo-key`, `VITE_FIREBASE_AUTH_DOMAIN=demo-homecare-rules.firebaseapp.com`, `VITE_FIREBASE_PROJECT_ID=demo-homecare-rules`, and a placeholder web `VITE_FIREBASE_APP_ID` such as `1:1234567890:web:0000000000000000`. Keep this file local and use only the demo project. The reviewer refuses to start emulator mode on any non-localhost hostname. Start the reviewer with the root package script `bun run reviewer:dev` (Vite serves on `http://127.0.0.1:5178`).

In a third terminal, seed fake accounts and 55 synthetic reports with the explicitly loopback-only script:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9199 \
GCLOUD_PROJECT=demo-homecare-rules \
  bun run reviewer:seed
```

Sign in with `staff@example.test` / `local-feedback-demo-only` to review the seeded reports, including pagination and an XSS-shaped title that must render as plain text. Use `user@example.test` / `local-feedback-demo-only` to verify the non-staff denial. The script rejects non-demo project IDs and non-loopback emulator hosts; do not change those checks or use it with production. The report list uses page size 50, newest first, with status/type filters and cursor paging. Composite indexes for the status/type filter combinations are included in the Firebase index configuration; deploy indexes through the normal Firebase release workflow before using the filters in production.

The root emulator command currently selects `demo-homecare-migration`; this project can run alongside the seed script's `demo-homecare-rules` database because Firebase Emulator Suite is configured for multiple projects. Ensure the reviewer `.env.local` project ID and the `GCLOUD_PROJECT` passed to the seed script match each other.

The viewer imports the shared validation, export, and chat-prompt helpers from `src/feedback/report.ts`; keep that schema as the canonical contract rather than duplicating it in the reviewer.

## Firebase setup before hosting

1. Use the **same Firebase project as the HomeCare mobile app** and register a dedicated Firebase Web App within it. A different project will not contain the mobile app's reports. Enable the intended sign-in providers (Email/Password and Google) in Firebase Authentication.
2. Add `homecare.pedrorbc.com` under Firebase Authentication → Settings → Authorized domains. Configure DNS and HTTPS for that hostname in Vercel when deployment is approved.
3. Provision staff manually through a trusted administrative process by writing `staff_access/{uid}` with `enabled: true` for each staff member's Firebase Authentication UID. Do not grant access based on email text supplied by the client.
4. Review and deploy the feedback collection Firestore rules and any required indexes through the project's normal Firebase release process. This implementation does not deploy Firebase rules or indexes.
5. Add the four public Firebase Web App values as Vercel environment variables for the intended deployment environments: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`. Set `VITE_USE_EMULATORS=false` or leave it unset. These values are public Firebase client configuration, not privileged secrets.
6. Verify email/password and Google sign-in, access denial for non-staff, staff revocation, paging/filtering, triage update, redacted export, and delete confirmation with test accounts before inviting staff.

## Vercel project settings (no deployment performed)

Use the repository root as Vercel's Root Directory so the build can use the root Bun lockfile and the shared report module. Configure:

- Framework Preset: **Vite**, from the repository-root `vercel.json`.
- Install Command: `bun install --frozen-lockfile`.
- Build Command: `bun run reviewer:build`.
- Output Directory: `reviewer/dist`.
- Add `homecare.pedrorbc.com` only after DNS is ready and the deployment is approved.

Vercel auto-discovers the repository-root `vercel.json`, which holds the root-package install/build/output settings and static security headers. Keep those deployment settings at the repository root rather than duplicating a nested config. This implementation does not set up a Vercel project or deploy anything. Before hosting, verify Firebase Authentication's Google popup flow on the configured domain; no Content Security Policy is enabled until its exact Firebase/Auth requirements are validated.

## Reviewer operations

Use status filters to find open, in-review, and resolved reports; type filters distinguish feedback from bug reports. Triage changes set the current authenticated UID as reviewer and use Firestore server timestamps. The optional issue link must match `https://github.com/{owner}/{repo}/issues/{number}`. Deleting a report removes it permanently from the collection. Keep any issue creation and cross-team sharing manual so staff can inspect and redact user-submitted content first.
