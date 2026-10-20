# Graph Report - homecare  (2026-10-18)

## Corpus Check
- 298 files · ~140,699 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 4, .example 2, .css 2)

## Summary
- 1475 nodes · 4024 edges · 102 communities (63 shown, 39 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Scheduling and Payments
- Feedback Review and Reporting
- House Scoped Firestore
- Caregiver Shifts and Exports
- App Bootstrap and Localization
- Runtime Dependency Packages
- Themed Mobile Screens
- Android Build Test Harness
- Encrypted Data Migration
- Facebook Sign In Flow
- Portuguese Translation Resources
- Spanish Translation Resources
- Navigation and Route Types
- Privacy Configuration Tests
- House Context and Navigation
- Local and Push Notifications
- Project Package Metadata
- Authentication and Provider Linking
- Onboarding and Theme Components
- Required App Updates
- Development Command Scripts
- Forms and Authentication Validation
- Social Login Interface
- Continuous Integration and Dependencies
- Firestore Security Rule Tests
- Development Dependency Packages
- Theme Compiler and Palette
- Privacy and Consent Screens
- Android APK Inspection
- Firebase Telemetry and Errors
- Google Sign In Configuration
- Expo and Metro Configuration
- Reviewer TypeScript Configuration
- Avatar and Profile Customization
- Feedback Report Query Tests
- Consent Queues and Logging
- Privacy Consent Domain
- Messaging and Store Review
- Dependency Compatibility Checks
- ESLint and Formatting
- Android Visual Testing Guidance
- App TypeScript Configuration
- Facebook Build Configuration
- Feedback Emulator Seed Data
- Alert Context and Modal
- Vercel Hosting Configuration
- Development Container Android Builds
- Feedback Access and Privacy
- Error Boundary Recovery
- Consent Record Concurrency Tests
- HomeCare Icon Design System
- Authentication Feature Documentation
- Adaptive House Heart Icon
- Rounded App Icon Design
- Monochrome Brand Mark
- Expo Documentation MCP Configuration
- Theme Architecture and Pins
- Migration and Encryption Design
- CSS Dependency Overrides
- Reviewer Vite Build
- Translation Resource Parity Tests
- Signed Android Release Workflow
- Primary House Heart Mark
- Color House Heart Mark
- Light Splash Screen Icon
- Runtime Engine Requirements
- Android Smoke Test Diagnostics
- Bun Test Type Declarations
- CSS Module Type Declarations
- Caregiver Icon Design
- Editable Icon Package Documentation
- House Heart Favicon
- Metro Transformer Entry Point
- Android Release Shell Script
- Workflow Validation Script
- Android Bundle Verification
- GitHub Actions Dependency Updates
- Monochrome Adaptive Icon
- Inverse Brand Mark
- History Icon Design
- House Icon Design
- House Board Icon
- Invitation Board Icon
- Caregiver Board Icon
- History Board Icon
- Payment Board Icon
- Shift Board Icon
- Invitation Envelope Icon
- Inverse Vector Mark
- Payment Card Icon
- Shift Calendar Icon
- Application Launcher Icon
- Notification Status Icon
- Dark Splash Screen Icon
- Splash Screen Graphic
- Bun Mock Type Declaration

## God Nodes (most connected - your core abstractions)
1. `useAppTheme()` - 95 edges
2. `react` - 70 edges
3. `react-native` - 63 edges
4. `FirestoreService` - 62 edges
5. `react-i18next` - 47 edges
6. `useAlert()` - 43 edges
7. `useScreenTracking()` - 41 edges
8. `useAuth()` - 39 edges
9. `@expo/vector-icons` - 38 edges
10. `Translations` - 38 edges

## Surprising Connections (you probably didn't know these)
- `AppUpdateManager()` --calls--> `UpdateRequiredModal()`  [EXTRACTED]
  App.tsx → src/components/UpdateRequiredModal.tsx
- `AppBootstrap()` --calls--> `ErrorBoundary`  [EXTRACTED]
  App.tsx → src/components/ErrorBoundary.tsx
- `AppBootstrap()` --calls--> `AppUpdateProvider()`  [EXTRACTED]
  App.tsx → src/context/AppUpdateContext.tsx
- `AppBootstrap()` --calls--> `CaregiverProvider()`  [EXTRACTED]
  App.tsx → src/context/CaregiverContext.tsx
- `AppBootstrap()` --calls--> `useFirebase()`  [EXTRACTED]
  App.tsx → src/hooks/useFirebase.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI jobs form the required validation pipeline** — _github_workflows_ci_quality_job, _github_workflows_ci_firestore_rules_job, _github_workflows_ci_workflow_lint_job, _github_workflows_ci_dependency_audit_job, _github_workflows_ci_android_build_job, _github_workflows_ci_android_smoke_job, _github_workflows_ci_required_gate [EXTRACTED 1.00]
- **HomeCare Routine Navigation Icons** — assets_design_homecare_icons_homecare_icon_board_casas_icon, assets_design_homecare_icons_homecare_icon_board_plantoes_icon, assets_design_homecare_icons_homecare_icon_board_cuidadores_icon, assets_design_homecare_icons_homecare_icon_board_pagamentos_icon, assets_design_homecare_icons_homecare_icon_board_convites_icon, assets_design_homecare_icons_homecare_icon_board_historico_icon [EXTRACTED 1.00]
- **Google authentication feature documentation and test journeys** — changelog_google_auth_google_auth, next_steps_google_auth_build_and_test, visual_reference_google_auth_flows, _maestro_auth_navigation_login_register_smoke_flow [INFERRED 0.85]

## Communities (102 total, 39 thin omitted)

### Community 0 - "Scheduling and Payments"
Cohesion: 0.06
Nodes (84): i18next, @react-navigation/native, Caregiver, Props, Card(), CardProps, Props, UpcomingPaymentsList() (+76 more)

### Community 1 - "Feedback Review and Reporting"
Cohesion: 0.06
Nodes (75): @react-native-firebase/auth, appRoot, bootstrap(), clearOnPermissionError(), downloadReport(), element(), formatDate(), formatRelativeDate() (+67 more)

### Community 2 - "House Scoped Firestore"
Cohesion: 0.08
Nodes (22): AppBootstrap(), AuthContextProvider(), HouseProvider(), Caregiver, ScheduleProvider(), accessDocId(), FirestoreService, getCollections() (+14 more)

### Community 3 - "Caregiver Shifts and Exports"
Cohesion: 0.06
Nodes (55): @react-native-firebase/firestore, CaregiverEmailField(), Props, CaregiverLinkStatusBadge(), LABELS, CaregiverContext, CaregiverContextValue, CaregiverProvider() (+47 more)

### Community 4 - "App Bootstrap and Localization"
Cohesion: 0.07
Nodes (43): App(), AppUpdateManager(), @expo-google-fonts/inter, expo-splash-screen, expo-status-bar, react-native-gesture-handler, MaintenanceModal(), useAppUpdateContext() (+35 more)

### Community 5 - "Runtime Dependency Packages"
Cohesion: 0.04
Nodes (50): dependencies, autoprefixer, baseline-browser-mapping, caniuse-lite, expo, expo-application, expo-crypto, expo-dev-client (+42 more)

### Community 6 - "Themed Mobile Screens"
Cohesion: 0.11
Nodes (31): react, react-i18next, react-native, AppHeader(), AppHeaderProps, CalendarGrid(), CalendarHeader(), Props (+23 more)

### Community 7 - "Android Build Test Harness"
Cohesion: 0.08
Nodes (17): entries, inspector, bundle(), run(), script, signingKey(), verifyAab, script (+9 more)

### Community 8 - "Encrypted Data Migration"
Cohesion: 0.13
Nodes (34): argumentsOf(), backupValue(), localEndpoint(), main(), requireDataset(), applyMigration(), deleteRefs(), GLOBAL_COLLECTIONS (+26 more)

### Community 9 - "Facebook Sign In Flow"
Cohesion: 0.08
Nodes (30): expo-crypto, react-native-fbsdk-next, globalScope, authenticateAndLinkFacebook(), FACEBOOK_LINK_TIMEOUT_MS, token, user, createRawNonce() (+22 more)

### Community 10 - "Portuguese Translation Resources"
Cohesion: 0.10
Nodes (19): account, auth, caregivers, caregiverView, common, create, dayDetails, errors (+11 more)

### Community 11 - "Spanish Translation Resources"
Cohesion: 0.10
Nodes (19): account, auth, caregivers, caregiverView, common, create, dayDetails, errors (+11 more)

### Community 12 - "Navigation and Route Types"
Cohesion: 0.11
Nodes (30): AppContent(), @react-navigation/native-stack, LoadingScreen(), AlertProvider(), AuthRoutes(), AuthStack, ConsentRoutes(), ConsentStack (+22 more)

### Community 13 - "Privacy Configuration Tests"
Cohesion: 0.07
Nodes (18): { AndroidConfig, withAndroidManifest, withInfoPlist }, PRIVACY_METADATA, withFacebookPrivacy(), nativeAlerts, params, react, applied, disabled (+10 more)

### Community 14 - "House Context and Navigation"
Cohesion: 0.15
Nodes (25): AppNavigationListener(), EmailVerificationBanner(), useAlert(), useCaregiver(), HouseContext, HouseContextType, HouseProviderProps, useHouse() (+17 more)

### Community 15 - "Local and Push Notifications"
Cohesion: 0.11
Nodes (4): useNotifications(), usePushNotifications(), NotificationService, PushNotificationService

### Community 16 - "Project Package Metadata"
Cohesion: 0.06
Nodes (32): main, name, private, version, autoprefixer, @babel/core, babel-preset-expo, baseline-browser-mapping (+24 more)

### Community 17 - "Authentication and Provider Linking"
Cohesion: 0.15
Nodes (20): AuthContext, AuthContextType, AuthProvider, AuthProviderProps, DeleteAccountCredentials, FacebookLinkCredentials, User, FirestoreUser (+12 more)

### Community 18 - "Onboarding and Theme Components"
Cohesion: 0.16
Nodes (18): react-native-safe-area-context, AppLogo(), AppLogoProps, Props, UpdateRequiredModal(), AboutScreen(), AboutScreenProps, FacebookLinkScreen() (+10 more)

### Community 19 - "Required App Updates"
Cohesion: 0.15
Nodes (10): @react-native-firebase/remote-config, AppUpdateContext, AppUpdateContextType, AppUpdateProvider(), AppUpdateProviderProps, AppUpdateService, DEFAULT_REMOTE_CONFIG, setMinimumFetchInterval() (+2 more)

### Community 20 - "Development Command Scripts"
Cohesion: 0.09
Nodes (22): scripts, android, deps:check, deps:inventory, emulators:local, expo:doctor, format, ios (+14 more)

### Community 21 - "Forms and Authentication Validation"
Cohesion: 0.13
Nodes (16): expo-application, zod, useFormValidation(), UseFormValidationProps, UseFormValidationReturn, LoginFormData, loginSchema, PasswordResetFormData (+8 more)

### Community 22 - "Social Login Interface"
Cohesion: 0.27
Nodes (15): @expo/vector-icons, FacebookSignInButton(), FacebookSignInButtonProps, isCancellation(), GoogleSignInButton(), GoogleSignInButtonProps, useAuth(), UserFacingAuthError (+7 more)

### Community 23 - "Continuous Integration and Dependencies"
Cohesion: 0.11
Nodes (18): Android Toolchain Setup Action, Bun and Dependencies Setup Action, Dependabot Bun Updates, Android Preview APK Build Job, Android UI Smoke Test Job, Continuous Integration Workflow, CI Dependency Audit Job, Firestore Rules Emulator Job (+10 more)

### Community 24 - "Firestore Security Rule Tests"
Cohesion: 0.12
Nodes (6): firebase, @firebase/rules-unit-testing, as(), createHouse(), manager(), unverified()

### Community 25 - "Development Dependency Packages"
Cohesion: 0.11
Nodes (19): devDependencies, @babel/core, babel-preset-expo, eslint, eslint-config-expo, eslint-config-prettier, expo-doctor, firebase (+11 more)

### Community 26 - "Theme Compiler and Palette"
Cohesion: 0.15
Nodes (15): postcss, react-native-css, @tailwindcss/postcss, config, css, cssPath, options, require (+7 more)

### Community 28 - "Privacy and Consent Screens"
Cohesion: 0.19
Nodes (17): ConsentScreen(), ConsentScreenProps, ConsentToggle(), ConsentToggleProps, HIGHLIGHTS, DATA_PROTECTION, formatDate(), PrivacyCenterScreen() (+9 more)

### Community 29 - "Android APK Inspection"
Cohesion: 0.13
Nodes (4): arguments(), inspect(), main(), verify_android()

### Community 30 - "Firebase Telemetry and Errors"
Cohesion: 0.12
Nodes (15): @react-native-firebase/analytics, @react-native-firebase/crashlytics, Props, State, useFirebase(), AnalyticsService, CrashlyticsService, enforcedPreferences (+7 more)

### Community 31 - "Google Sign In Configuration"
Cohesion: 0.18
Nodes (9): @react-native-google-signin/google-signin, getGoogleIdToken(), GoogleSignInClient, GoogleSignInOptions, isGoogleClientId(), isRecord(), resolveGoogleWebClientId(), projectRoot (+1 more)

### Community 32 - "Expo and Metro Configuration"
Cohesion: 0.17
Nodes (11): AppConfig, config, { getDefaultConfig }, nativewindConfig, { withNativewind }, expo, nativewind, addReleaseSigning() (+3 more)

### Community 33 - "Reviewer TypeScript Configuration"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, esModuleInterop, lib, module, moduleResolution, noEmit, skipLibCheck (+5 more)

### Community 34 - "Avatar and Profile Customization"
Cohesion: 0.24
Nodes (11): AVATAR_COLORS, AVATAR_ICONS, AvatarConfig, AvatarDisplay(), AvatarDisplayProps, AvatarPicker(), AvatarPickerProps, DEFAULT_AVATAR (+3 more)

### Community 35 - "Feedback Report Query Tests"
Cohesion: 0.15
Nodes (5): context, firestore, report(), serverTimestamp(), validDraft

### Community 36 - "Consent Queues and Logging"
Cohesion: 0.21
Nodes (7): ConsentRecordService, queues, Ticket, TelemetryService, logger, changedPurposes(), createSerialQueue()

### Community 37 - "Privacy Consent Domain"
Cohesion: 0.24
Nodes (10): ConsentChoice, needsConsent(), PolicyAcceptance, PRIVACY_POLICY_VERSION, restrictTelemetry(), sameTelemetry(), sanitizeAnalyticsParams(), TELEMETRY_PURPOSES (+2 more)

### Community 38 - "Messaging and Store Review"
Cohesion: 0.20
Nodes (8): expo-notifications, expo-store-review, @react-native-async-storage/async-storage, @react-native-firebase/messaging, NOTIFICATION_CHANNELS, NotificationConfig, NotificationType, PushNotificationData

### Community 39 - "Dependency Compatibility Checks"
Cohesion: 0.44
Nodes (9): semver, actualNodeVersion(), checkInstallation(), checkManifest(), installedPackages(), inventory(), readManifest(), resolvePackageDirectory() (+1 more)

### Community 40 - "ESLint and Formatting"
Cohesion: 0.22
Nodes (8): { defineConfig }, expoConfig, globals, prettierConfig, eslint, eslint-config-expo, eslint-config-prettier, globals

### Community 41 - "Android Visual Testing Guidance"
Cohesion: 0.25
Nodes (5): Android device interaction via ADB, Expo development build, Fast Refresh visual testing workflow, Native build rebuild conditions, Visual evidence and runtime diagnostics

### Community 42 - "App TypeScript Configuration"
Cohesion: 0.25
Nodes (7): expo/tsconfig.base, compilerOptions, paths, strict, exclude, extends, include

### Community 43 - "Facebook Build Configuration"
Cohesion: 0.50
Nodes (5): isFacebookAppId(), isFacebookClientToken(), isNonPlaceholderString(), resolveFacebookConfig(), projectRoot

### Community 44 - "Feedback Emulator Seed Data"
Cohesion: 0.52
Nodes (5): feedbackEmulatorConfig(), firestoreValue(), request(), seedFeedbackEmulator(), valid

### Community 45 - "Alert Context and Modal"
Cohesion: 0.48
Nodes (5): AlertContext, AlertContextType, AlertProviderProps, AlertButton, AlertModalParams

### Community 46 - "Vercel Hosting Configuration"
Cohesion: 0.29
Nodes (6): buildCommand, framework, headers, installCommand, outputDirectory, $schema

### Community 47 - "Development Container Android Builds"
Cohesion: 0.67
Nodes (5): build_eas(), build_local(), load_local_env(), build-android.sh script, usage()

### Community 48 - "Feedback Access and Privacy"
Cohesion: 0.33
Nodes (4): Shared Feedback Report Schema, Staff-Only Feedback Report Review, Consent and Data Subject Rights, Feedback Reviewer Web Entry Point

### Community 50 - "Consent Record Concurrency Tests"
Cohesion: 0.33
Nodes (4): disabled, gate, granted, started

### Community 51 - "HomeCare Icon Design System"
Cohesion: 0.40
Nodes (5): HomeCare Brand, HomeCare Icon Studio Board, House-and-Heart Brand Mark, Blue, Monochrome, and Inverse Mark Variants, HomeCare Routine Icon System

### Community 52 - "Authentication Feature Documentation"
Cohesion: 0.50
Nodes (5): Firestore Authentication Provider Synchronization, Google Authentication Feature, Multi-Provider Authentication and Provider Linking, Google Authentication Build and Test Next Steps, Google Authentication Screen and Account Flows

### Community 53 - "Adaptive House Heart Icon"
Cohesion: 0.67
Nodes (3): Adaptive App Icon, Heart Symbol, House Symbol

### Community 54 - "Rounded App Icon Design"
Cohesion: 0.67
Nodes (4): Blue Rounded-Square Background, Heart Symbol, HomeCare App Icon, House Symbol

### Community 55 - "Monochrome Brand Mark"
Cohesion: 0.67
Nodes (4): Heart, Home Care, HomeCare House-and-Heart Mark, House

### Community 56 - "Expo Documentation MCP Configuration"
Cohesion: 0.50
Nodes (3): expo-docs, npx, expo-local-docs-mcp

### Community 59 - "CSS Dependency Overrides"
Cohesion: 0.50
Nodes (4): lightningcss, postcss, overrides, @expo/metro-config

### Community 60 - "Reviewer Vite Build"
Cohesion: 0.50
Nodes (3): vite, reviewerDist, reviewerRoot

### Community 61 - "Translation Resource Parity Tests"
Cohesion: 0.50
Nodes (3): enKeys, flatten(), sourceFiles()

### Community 62 - "Signed Android Release Workflow"
Cohesion: 0.67
Nodes (3): Android Release Workflow, GitHub Release Publish Job, Signed Android Release Process

### Community 63 - "Primary House Heart Mark"
Cohesion: 0.67
Nodes (3): Heart Symbol, HomeCare Brand Mark, House Symbol

### Community 64 - "Color House Heart Mark"
Cohesion: 0.67
Nodes (3): Heart, Home, HomeCare Mark

### Community 65 - "Light Splash Screen Icon"
Cohesion: 0.67
Nodes (3): Heart Symbol, HomeCare App Icon, House Symbol

### Community 66 - "Runtime Engine Requirements"
Cohesion: 0.67
Nodes (3): engines, bun, node

## Knowledge Gaps
- **82 isolated node(s):** `npx`, `expo-local-docs-mcp`, `@react-native-firebase/app`, `@react-navigation/drawer`, `autoprefixer` (+77 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 574 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Runtime Dependency Packages` to `Project Package Metadata`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `npx`, `expo-local-docs-mcp`, `@react-native-firebase/app` to the rest of the system?**
  _82 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Scheduling and Payments` be split into smaller, more focused modules?**
  _Cohesion score 0.05907247399047787 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Themed Mobile Screens` to `Scheduling and Payments`, `Avatar and Profile Customization`, `Caregiver Shifts and Exports`, `App Bootstrap and Localization`, `Messaging and Store Review`, `Navigation and Route Types`, `Alert Context and Modal`, `House Context and Navigation`, `Local and Push Notifications`, `Project Package Metadata`, `Authentication and Provider Linking`, `Onboarding and Theme Components`, `Required App Updates`, `Forms and Authentication Validation`, `Social Login Interface`, `Privacy and Consent Screens`, `Firebase Telemetry and Errors`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `Feedback Review and Reporting` be split into smaller, more focused modules?**
  _Cohesion score 0.05877167205406994 - nodes in this community are weakly interconnected._
- **Why does `i18next` connect `Scheduling and Payments` to `Caregiver Shifts and Exports`, `App Bootstrap and Localization`, `Messaging and Store Review`, `House Context and Navigation`, `Project Package Metadata`, `Authentication and Provider Linking`, `Required App Updates`, `Forms and Authentication Validation`, `Firebase Telemetry and Errors`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `House Scoped Firestore` be split into smaller, more focused modules?**
  _Cohesion score 0.07531645569620253 - nodes in this community are weakly interconnected._
## Graph Integrity Notes

The undirected extraction diagnostic found 15 dangling-endpoint edges, 10 self-loops, 1 exact duplicate, and 133 same-endpoint collapsed edges. Different relation types can collapse onto one undirected edge, so the graph does not retain every extracted relationship separately. The structural extractor reported 33 code files without symbols.

`graphify-out/` was written into the working tree and is currently untracked. You can add `graphify-out/` to `.gitignore`, or commit only the outputs your team should share: https://docs.graphify.com/guides/team-workflows.

## Extraction Accounting and Verification

All 42 semantic input files were cache hits. This run dispatched no extraction agents. Reported token counts track semantic extraction only, not host-session orchestration.

Graphify benchmark estimated 81.7x token reduction, averaging approximately 1,204 tokens per query against its estimated 98,333-token baseline (73,750 words). That baseline is graphify's own estimate, not the detector's 140,699-word corpus count and not a measured API charge.

The standard graphify HTML export was generated successfully. Browser visual inspection was not performed because no local browser was available. No app UI changed, so Android visual testing was not performed.
