import "./styles.css";
import { initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  documentId,
  getDocsFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import {
  REPORT_PAGE_SIZE,
  REPORTS_COLLECTION,
  STAFF_COLLECTION,
  exportOwnReport,
  formatReportForChat,
  issueUrlSchema,
  reportSchema,
  type FeedbackReport,
  type ReportStatus,
  type ReportType,
} from "../src/feedback/report";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("The reviewer app mount point is missing.");

appRoot.innerHTML = `
  <div class="app-frame">
    <header class="topbar">
      <a class="brand" href="#inbox" aria-label="HomeCare report inbox">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="brand-copy"><strong>HomeCare</strong><small>REPORT INBOX</small></span>
      </a>
      <div class="topbar-right">
        <span class="secure-label"><span class="secure-dot"></span> Staff workspace</span>
        <span class="user-label" id="user-label"></span>
        <button class="button button-quiet button-small" id="sign-out" type="button" hidden>Sign out</button>
      </div>
    </header>
    <main id="main-content" class="main-content" aria-live="polite"></main>
    <footer class="footer-note"><span>Private staff tool</span><span>Report content is user-submitted and untrusted</span></footer>
  </div>
  <dialog class="chat-dialog" id="chat-dialog" aria-labelledby="chat-title">
    <form method="dialog" class="dialog-shell" id="chat-form">
      <div class="dialog-heading">
        <div><p class="eyebrow">MANUAL EXPORT</p><h2 id="chat-title">Prepare a chat prompt</h2></div>
        <button class="icon-button" id="close-chat" type="button" aria-label="Close dialog">×</button>
      </div>
      <p class="privacy-callout">Report text may contain names, contact details, health information, or other private data. Review and redact the text below before copying it anywhere.</p>
      <label class="field-label" for="chat-preview">Editable prompt preview</label>
      <textarea id="chat-preview" class="chat-preview" rows="13" spellcheck="false"></textarea>
      <label class="consent-check"><input type="checkbox" id="redaction-confirm" /> <span>I reviewed this text and removed anything that should not be shared.</span></label>
      <div class="dialog-actions">
        <span class="inline-status" id="copy-status" role="status"></span>
        <button class="button button-quiet" id="cancel-chat" type="button">Cancel</button>
        <button class="button button-primary" id="copy-chat" type="button" disabled>Copy reviewed text</button>
      </div>
    </form>
  </dialog>
`;

const main = appRoot.querySelector<HTMLElement>("#main-content")!;
const signOutButton = appRoot.querySelector<HTMLButtonElement>("#sign-out")!;
const userLabel = appRoot.querySelector<HTMLElement>("#user-label")!;
const chatDialog = appRoot.querySelector<HTMLDialogElement>("#chat-dialog")!;
const chatPreview = appRoot.querySelector<HTMLTextAreaElement>("#chat-preview")!;
const redactionConfirm = appRoot.querySelector<HTMLInputElement>("#redaction-confirm")!;
const copyButton = appRoot.querySelector<HTMLButtonElement>("#copy-chat")!;
const copyStatus = appRoot.querySelector<HTMLElement>("#copy-status")!;

const env = import.meta.env;
const requiredConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
const missingConfig = Object.entries(requiredConfig)
  .filter(
    ([, value]) => !value || value.startsWith("replace-with") || value.startsWith("your-project"),
  )
  .map(([key]) => key);
const emulatorRequested = env.VITE_USE_EMULATORS === "true";
const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

function bootstrap(): void {
  if (missingConfig.length > 0) {
    renderNotice({
      kind: "setup",
      title: "Connect a Firebase web app",
      message: `Add the missing values to reviewer/.env.local: ${missingConfig.join(", ")}. Copy reviewer/.env.example as a starting point, then reload this page.`,
    });
  } else if (
    emulatorRequested &&
    (!isLoopback || !/^demo-[a-z0-9-]+$/.test(requiredConfig.projectId))
  ) {
    renderNotice({
      kind: "error",
      title: "Emulator mode is local only",
      message:
        "VITE_USE_EMULATORS=true requires localhost or 127.0.0.1 and a demo-* project ID. Set it to false for hosted builds, then rebuild.",
    });
  } else {
    startFirebase();
  }
}

interface PageState {
  reports: FeedbackReport[];
  pageCursors: (DocumentSnapshot<DocumentData> | undefined)[];
  pageIndex: number;
  hasNextPage: boolean;
  selectedId: string | null;
  statusFilter: ReportStatus | "all";
  typeFilter: ReportType | "all";
  loading: boolean;
  saving: boolean;
  error: string | null;
  warning: string | null;
  emptyPage: boolean;
}

const state: PageState = {
  reports: [],
  pageCursors: [undefined],
  pageIndex: 0,
  hasNextPage: false,
  selectedId: null,
  statusFilter: "all",
  typeFilter: "all",
  loading: false,
  saving: false,
  error: null,
  warning: null,
  emptyPage: false,
};

let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let currentUser: User | null = null;
let staffUnsubscribe: Unsubscribe | null = null;
let identityGeneration = 0;
let loadGeneration = 0;
let isStaff = false;
let currentReportToShare: FeedbackReport | null = null;

function startFirebase(): void {
  try {
    const firebaseApp = initializeApp(requiredConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
    if (emulatorRequested) {
      connectAuthEmulator(auth, "http://127.0.0.1:9199", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8180);
    }

    void setPersistence(auth, browserSessionPersistence)
      .then(() => {
        if (!auth) return;
        onAuthStateChanged(auth, handleAuthState);
      })
      .catch((error: unknown) => {
        renderNotice({
          kind: "error",
          title: "Could not start a secure session",
          message: readableError(error),
        });
      });
  } catch (error) {
    renderNotice({
      kind: "error",
      title: "Firebase could not be initialized",
      message: readableError(error),
    });
  }
}

function handleAuthState(user: User | null): void {
  identityGeneration += 1;
  loadGeneration += 1;
  staffUnsubscribe?.();
  staffUnsubscribe = null;
  currentUser = user;
  isStaff = false;
  resetPrivateState();

  if (!user) {
    userLabel.textContent = "";
    signOutButton.hidden = true;
    renderLogin();
    return;
  }

  userLabel.textContent = user.email ?? "Signed in";
  signOutButton.hidden = false;
  renderNotice({
    kind: "loading",
    title: "Checking staff access",
    message: "Verifying this account before opening the inbox…",
  });
  if (!db) return;

  const expectedGeneration = identityGeneration;
  staffUnsubscribe = onSnapshot(
    doc(db, STAFF_COLLECTION, user.uid),
    (snapshot) => {
      if (expectedGeneration !== identityGeneration || currentUser?.uid !== user.uid) return;
      if (snapshot.exists() && snapshot.data().enabled === true) {
        isStaff = true;
        void loadPage(0);
      } else {
        isStaff = false;
        loadGeneration += 1;
        resetPrivateState();
        renderNotice({
          kind: "denied",
          title: "Staff access required",
          message:
            "This account is signed in, but it is not enabled for the report inbox. Ask a HomeCare administrator to grant staff access.",
        });
      }
    },
    (error) => {
      if (expectedGeneration !== identityGeneration) return;
      isStaff = false;
      loadGeneration += 1;
      resetPrivateState();
      renderNotice({
        kind: "error",
        title: "Could not verify staff access",
        message: readableError(error),
      });
    },
  );
}

function resetPrivateState(): void {
  state.reports = [];
  state.pageCursors = [undefined];
  state.pageIndex = 0;
  state.hasNextPage = false;
  state.selectedId = null;
  state.loading = false;
  state.saving = false;
  state.error = null;
  state.warning = null;
  state.emptyPage = false;
  if (chatDialog.open) chatDialog.close();
  currentReportToShare = null;
  chatPreview.value = "";
  redactionConfirm.checked = false;
  copyButton.disabled = true;
  copyStatus.textContent = "";
}

async function loadPage(pageIndex: number): Promise<void> {
  if (!db || !currentUser || !isStaff) return;
  const requestIdentity = identityGeneration;
  const requestNumber = ++loadGeneration;
  state.loading = true;
  state.error = null;
  state.warning = null;
  state.selectedId = null;
  renderInbox();

  const constraints: QueryConstraint[] = [];
  if (state.statusFilter !== "all") constraints.push(where("status", "==", state.statusFilter));
  if (state.typeFilter !== "all") constraints.push(where("type", "==", state.typeFilter));
  constraints.push(orderBy("createdAt", "desc"), orderBy(documentId(), "desc"));
  const cursor = state.pageCursors[pageIndex];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(REPORT_PAGE_SIZE));

  try {
    const result = await getDocsFromServer(
      query(collection(db, REPORTS_COLLECTION), ...constraints),
    );
    if (requestIdentity !== identityGeneration || requestNumber !== loadGeneration || !isStaff)
      return;
    const accepted: FeedbackReport[] = [];
    let invalid = 0;
    for (const snapshot of result.docs) {
      const raw = snapshot.data();
      const parsed = reportSchema.safeParse({
        ...raw,
        id: snapshot.id,
        createdAt: timestampToIso(raw.createdAt),
        updatedAt: timestampToIso(raw.updatedAt),
      });
      if (parsed.success) accepted.push(parsed.data);
      else invalid += 1;
    }

    state.reports = accepted;
    state.pageIndex = pageIndex;
    state.hasNextPage = result.docs.length === REPORT_PAGE_SIZE;
    state.emptyPage = result.docs.length === 0;
    state.warning =
      invalid > 0
        ? `${invalid} report${invalid === 1 ? " was" : "s were"} hidden because the saved data did not match the current report format.`
        : null;
    if (state.hasNextPage) state.pageCursors[pageIndex + 1] = result.docs[result.docs.length - 1];
    renderInbox();
  } catch (error) {
    if (requestIdentity !== identityGeneration || requestNumber !== loadGeneration) return;
    state.reports = [];
    state.hasNextPage = false;
    state.error = readableError(error);
    if (isPermissionError(error)) {
      isStaff = false;
      resetPrivateState();
      renderNotice({
        kind: "denied",
        title: "Access changed",
        message:
          "The inbox could not be read. Your cached report content has been cleared. Confirm your staff access and Firestore rules, then sign in again.",
      });
      return;
    }
    renderInbox();
  } finally {
    if (requestIdentity === identityGeneration && requestNumber === loadGeneration && isStaff) {
      state.loading = false;
      renderInbox();
    }
  }
}

function renderLogin(): void {
  main.replaceChildren();
  const page = element("section", "login-layout");
  const intro = element("div", "login-intro");
  intro.append(
    textElement("p", "eyebrow", "HOMECARE · PRIVATE STAFF TOOL"),
    textElement("h1", "login-title", "A calmer way to care for the details."),
    textElement(
      "p",
      "login-copy",
      "Review feedback and bug reports submitted by HomeCare users. Access is checked against the staff list every time you sign in.",
    ),
  );
  const card = element("section", "login-card");
  card.setAttribute("aria-labelledby", "login-heading");
  card.append(
    textElement("p", "eyebrow", "AUTHORIZED STAFF"),
    textElement("h2", "card-title", "Sign in to reports"),
  );

  const errorBox = element("p", "form-error");
  errorBox.id = "login-error";
  errorBox.hidden = true;
  errorBox.setAttribute("role", "alert");
  const form = element("form", "login-form");
  form.noValidate = true;
  const emailLabel = textElement("label", "field-label", "Email address");
  emailLabel.htmlFor = "login-email";
  const email = element("input", "text-input") as HTMLInputElement;
  email.type = "email";
  email.id = "login-email";
  email.name = "email";
  email.autocomplete = "username";
  email.required = true;
  email.placeholder = "you@example.com";
  const passwordLabel = textElement("label", "field-label", "Password");
  passwordLabel.htmlFor = "login-password";
  const password = element("input", "text-input") as HTMLInputElement;
  password.type = "password";
  password.id = "login-password";
  password.name = "password";
  password.autocomplete = "current-password";
  password.required = true;
  password.placeholder = "Enter your password";
  const submit = textElement(
    "button",
    "button button-primary button-wide",
    "Sign in with email",
  ) as HTMLButtonElement;
  submit.type = "submit";
  const divider = element("div", "login-divider");
  divider.append(
    element("span", ""),
    textElement("span", "", "or continue with"),
    element("span", ""),
  );
  const google = textElement(
    "button",
    "button button-google button-wide",
    "Continue with Google",
  ) as HTMLButtonElement;
  google.type = "button";
  const note = textElement(
    "p",
    "login-note",
    "Accounts are provisioned by an administrator. There is no public sign-up.",
  );
  form.append(emailLabel, email, passwordLabel, password, submit);
  card.append(errorBox, form, divider, google, note);
  page.append(intro, card);
  main.append(page);

  let busy = false;
  const setBusy = (value: boolean) => {
    busy = value;
    submit.disabled = value;
    google.disabled = value;
    submit.textContent = value ? "Signing in…" : "Sign in with email";
  };
  const showError = (message: string) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !auth) return;
    if (!email.value.trim() || !password.value) {
      showError("Enter both your email and password.");
      return;
    }
    setBusy(true);
    errorBox.hidden = true;
    try {
      await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
    } catch (error) {
      showError(readableError(error));
      setBusy(false);
    }
  });
  google.addEventListener("click", async () => {
    if (busy || !auth) return;
    setBusy(true);
    errorBox.hidden = true;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      showError(readableError(error));
      setBusy(false);
    }
  });
}

function renderInbox(): void {
  if (!isStaff) return;
  main.replaceChildren();
  const shell = element("section", "inbox-shell");
  const heading = element("div", "page-heading");
  const titleGroup = element("div", "heading-copy");
  titleGroup.append(
    textElement("p", "eyebrow", "FEEDBACK & BUGS"),
    textElement("h1", "page-title", "Report inbox"),
    textElement(
      "p",
      "page-subtitle",
      "Read, triage, and close the loop on user-submitted reports.",
    ),
  );
  const refresh = textElement(
    "button",
    "button button-quiet refresh-button",
    "↻  Refresh",
  ) as HTMLButtonElement;
  refresh.type = "button";
  refresh.disabled = state.loading;
  refresh.addEventListener("click", () => void loadPage(state.pageIndex));
  heading.append(titleGroup, refresh);

  const filters = element("div", "filter-bar");
  const statusFilter = makeSelect("Filter by status", state.statusFilter, [
    ["all", "All statuses"],
    ["open", "Open"],
    ["in_review", "In review"],
    ["resolved", "Resolved"],
  ]);
  statusFilter.addEventListener("change", () => {
    state.statusFilter = statusFilter.value as ReportStatus | "all";
    resetPagination();
    void loadPage(0);
  });
  const typeFilter = makeSelect("Filter by report type", state.typeFilter, [
    ["all", "All report types"],
    ["feedback", "Feedback"],
    ["bug", "Bug"],
  ]);
  typeFilter.addEventListener("change", () => {
    state.typeFilter = typeFilter.value as ReportType | "all";
    resetPagination();
    void loadPage(0);
  });
  const filterCaption = textElement(
    "span",
    "results-caption",
    state.loading ? "Loading reports…" : `${state.reports.length} on this page`,
  );
  filters.append(statusFilter, typeFilter, filterCaption);
  shell.append(heading, filters);
  if (state.error) shell.append(makeAlert(state.error, true));
  if (state.warning) shell.append(makeAlert(state.warning, false));

  const workspace = element("div", `workspace${state.selectedId ? " has-selection" : ""}`);
  const listPanel = element("section", "report-panel report-list-panel");
  listPanel.setAttribute("aria-label", "Reports");
  const listTop = element("div", "panel-topline");
  listTop.append(
    textElement("h2", "panel-heading", "Latest reports"),
    textElement("span", "count-pill", String(state.reports.length)),
  );
  listPanel.append(listTop);
  const rows = element("div", "report-list");
  if (state.loading && state.reports.length === 0) {
    rows.append(makeEmptyState("spinner", "Loading the inbox", "Checking for the latest reports…"));
  } else if (state.reports.length === 0) {
    rows.append(
      makeEmptyState(
        "inbox",
        state.emptyPage ? "No reports here" : "No reports to show",
        state.error
          ? "Check the connection and retry."
          : "Try another filter, or refresh in a moment.",
      ),
    );
  } else {
    for (const report of state.reports) rows.append(makeReportRow(report));
  }
  const pager = element("div", "pager");
  const previous = textElement(
    "button",
    "button button-quiet button-small",
    "←  Newer",
  ) as HTMLButtonElement;
  previous.type = "button";
  previous.disabled = state.loading || state.pageIndex === 0;
  previous.addEventListener("click", () => void loadPage(Math.max(0, state.pageIndex - 1)));
  const pageNumber = textElement("span", "page-number", `Page ${state.pageIndex + 1}`);
  const next = textElement(
    "button",
    "button button-quiet button-small",
    "Older  →",
  ) as HTMLButtonElement;
  next.type = "button";
  next.disabled = state.loading || !state.hasNextPage;
  next.addEventListener("click", () => void loadPage(state.pageIndex + 1));
  pager.append(previous, pageNumber, next);
  listPanel.append(rows, pager);

  const detailPanel = element(
    "section",
    `report-panel detail-panel${state.selectedId ? " is-active" : ""}`,
  );
  detailPanel.setAttribute("aria-label", "Selected report details");
  const selected = state.reports.find((report) => report.id === state.selectedId);
  if (selected) detailPanel.append(makeDetails(selected));
  else
    detailPanel.append(
      makeEmptyState(
        "note",
        "Select a report",
        "Choose a report from the inbox to read its details and update its triage status.",
      ),
    );
  workspace.append(listPanel, detailPanel);
  shell.append(workspace);
  main.append(shell);
}

function makeReportRow(report: FeedbackReport): HTMLButtonElement {
  const row = element(
    "button",
    `report-row${report.id === state.selectedId ? " is-selected" : ""}`,
  ) as HTMLButtonElement;
  row.type = "button";
  row.setAttribute("aria-pressed", String(report.id === state.selectedId));
  row.addEventListener("click", () => {
    state.selectedId = report.id;
    renderInbox();
  });
  const top = element("div", "row-top");
  top.append(makeTypeBadge(report.type), makeStatusBadge(report.status));
  const title = textElement("span", "row-title", report.title);
  const description = textElement("span", "row-description", report.description);
  const meta = element("span", "row-meta");
  meta.append(
    textElement("span", "", formatDate(report.createdAt)),
    textElement("span", "meta-dot", "·"),
    textElement("span", "", `Updated ${formatRelativeDate(report.updatedAt)}`),
  );
  row.append(top, title, description, meta);
  return row;
}

function makeDetails(report: FeedbackReport): HTMLElement {
  const details = element("div", "details-content");
  const back = textElement("button", "mobile-back", "← Back to inbox") as HTMLButtonElement;
  back.type = "button";
  back.addEventListener("click", () => {
    state.selectedId = null;
    renderInbox();
  });
  const top = element("div", "detail-topline");
  top.append(makeTypeBadge(report.type), makeStatusBadge(report.status));
  const title = textElement("h2", "detail-title", report.title);
  const meta = textElement(
    "p",
    "detail-meta",
    `Submitted ${formatDate(report.createdAt)} · Updated ${formatRelativeDate(report.updatedAt)}`,
  );
  details.append(back, top, title, meta, makeRule());

  details.append(
    textElement("h3", "section-heading", "Description"),
    textElement("p", "report-copy", report.description),
  );
  if (report.type === "bug") {
    const bugFields: [string, string][] = [
      ["Steps to reproduce", report.steps],
      ["Expected behavior", report.expected],
      ["What happened", report.actual],
    ];
    for (const [label, value] of bugFields) {
      if (!value.trim()) continue;
      details.append(
        textElement("h3", "section-heading detail-section-heading", label),
        textElement("p", "report-copy", value),
      );
    }
  }

  const context = element("section", "context-card");
  context.append(textElement("h3", "section-heading", "Technical context"));
  const contextGrid = element("dl", "context-grid");
  const appVersion = report.context.appVersion ? `v${report.context.appVersion}` : "Not provided";
  const build = report.context.appBuild ? `Build ${report.context.appBuild}` : "Not provided";
  for (const [label, value] of [
    ["App version", appVersion],
    ["App build", build],
    ["Platform", report.context.platform],
    ["OS version", report.context.osVersion || "Not provided"],
    ["Language", report.context.language],
  ]) {
    const pair = element("div", "context-pair");
    pair.append(
      textElement("dt", "context-label", label),
      textElement("dd", "context-value", value),
    );
    contextGrid.append(pair);
  }
  context.append(contextGrid);
  details.append(context, makeRule());

  const triage = element("section", "triage-section");
  triage.append(
    textElement("p", "eyebrow", "STAFF ONLY"),
    textElement("h3", "section-heading triage-heading", "Triage"),
  );
  const statusLabel = textElement("label", "field-label", "Status");
  statusLabel.htmlFor = "triage-status";
  const statusSelect = makeSelect("Report status", report.status, [
    ["open", "Open"],
    ["in_review", "In review"],
    ["resolved", "Resolved"],
  ]);
  statusSelect.id = "triage-status";
  const issueLabel = textElement("label", "field-label", "GitHub issue (optional)");
  issueLabel.htmlFor = "issue-url";
  const issueInput = element("input", "text-input") as HTMLInputElement;
  issueInput.id = "issue-url";
  issueInput.type = "url";
  issueInput.inputMode = "url";
  issueInput.placeholder = "https://github.com/org/repo/issues/123";
  issueInput.value = report.issueUrl ?? "";
  const issueHelp = textElement(
    "p",
    "field-help",
    "Only a canonical https://github.com/{owner}/{repo}/issues/{number} URL is accepted.",
  );
  const saveStatus = element("p", "inline-status");
  saveStatus.id = "triage-status-message";
  saveStatus.setAttribute("role", "status");
  const save = textElement("button", "button button-primary", "Save triage") as HTMLButtonElement;
  save.type = "button";
  save.id = "save-triage";
  save.disabled = state.saving;
  save.addEventListener("click", async () => {
    if (state.saving || !currentUser || !isStaff || !db) return;
    const issueUrl = issueInput.value.trim() || null;
    const parsedUrl = issueUrlSchema.safeParse(issueUrl);
    if (!parsedUrl.success) {
      saveStatus.textContent =
        "Enter a canonical HTTPS GitHub issue URL, or leave this field blank.";
      saveStatus.className = "inline-status error-text";
      issueInput.focus();
      return;
    }
    const expectedIdentity = identityGeneration;
    const reviewerUid = currentUser.uid;
    state.saving = true;
    save.disabled = true;
    saveStatus.textContent = "Saving…";
    saveStatus.className = "inline-status";
    try {
      await updateDoc(doc(db, REPORTS_COLLECTION, report.id), {
        status: statusSelect.value,
        issueUrl: parsedUrl.data,
        reviewerUid,
        updatedAt: serverTimestamp(),
      });
      if (identityGeneration !== expectedIdentity || currentUser?.uid !== reviewerUid || !isStaff)
        return;
      saveStatus.textContent = "Saved. Refreshing the report list…";
      saveStatus.className = "inline-status success-text";
      await loadPage(state.pageIndex);
      if (identityGeneration !== expectedIdentity || currentUser?.uid !== reviewerUid || !isStaff)
        return;
      state.selectedId = report.id;
      renderInbox();
    } catch (error) {
      if (identityGeneration !== expectedIdentity || currentUser?.uid !== reviewerUid) return;
      if (clearOnPermissionError(error)) return;
      saveStatus.textContent = readableError(error);
      saveStatus.className = "inline-status error-text";
    } finally {
      if (identityGeneration === expectedIdentity && currentUser?.uid === reviewerUid) {
        state.saving = false;
        save.disabled = false;
        // Loading the page replaces the original button while the save is pending.
        const currentSave = document.querySelector<HTMLButtonElement>("#save-triage");
        if (currentSave) currentSave.disabled = false;
      }
    }
  });
  triage.append(statusLabel, statusSelect, issueLabel, issueInput, issueHelp, saveStatus, save);
  details.append(triage, makeRule());

  const tools = element("section", "export-tools");
  tools.append(textElement("h3", "section-heading", "Careful sharing"));
  tools.append(
    textElement(
      "p",
      "field-help",
      "Report text is untrusted and may contain sensitive information. The prompt is not sent anywhere automatically.",
    ),
  );
  const prepare = textElement(
    "button",
    "button button-quiet",
    "Review chat prompt",
  ) as HTMLButtonElement;
  prepare.type = "button";
  prepare.addEventListener("click", () => openChatDialog(report));
  const download = textElement(
    "button",
    "button button-quiet",
    "Download report JSON",
  ) as HTMLButtonElement;
  download.type = "button";
  download.addEventListener("click", () => downloadReport(report));
  const remove = textElement(
    "button",
    "button button-danger-quiet",
    "Delete report…",
  ) as HTMLButtonElement;
  remove.type = "button";
  remove.addEventListener("click", () => void removeReport(report));
  const actions = element("div", "tool-actions");
  actions.append(prepare, download, remove);
  tools.append(actions);
  details.append(tools);
  return details;
}

async function removeReport(report: FeedbackReport): Promise<void> {
  if (!currentUser || !isStaff || !db) return;
  const expectedIdentity = identityGeneration;
  const reviewerUid = currentUser.uid;
  const approved = window.confirm(`Delete “${report.title}” permanently? This cannot be undone.`);
  if (!approved) return;
  try {
    await deleteDoc(doc(db, REPORTS_COLLECTION, report.id));
    if (identityGeneration !== expectedIdentity || currentUser?.uid !== reviewerUid || !isStaff)
      return;
    state.selectedId = null;
    await loadPage(state.pageIndex);
  } catch (error) {
    if (identityGeneration !== expectedIdentity || currentUser?.uid !== reviewerUid) return;
    if (clearOnPermissionError(error)) return;
    state.error = readableError(error);
    renderInbox();
  }
}

function openChatDialog(report: FeedbackReport): void {
  currentReportToShare = report;
  chatPreview.value = formatReportForChat(report);
  redactionConfirm.checked = false;
  copyButton.disabled = true;
  copyStatus.textContent = "";
  chatDialog.showModal();
  chatPreview.focus();
}

function downloadReport(report: FeedbackReport): void {
  const json = JSON.stringify(exportOwnReport(report), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const anchor = element("a", "") as HTMLAnchorElement;
  anchor.href = url;
  anchor.download = `homecare-report-${report.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function resetPagination(): void {
  state.pageCursors = [undefined];
  state.pageIndex = 0;
  state.hasNextPage = false;
  state.reports = [];
  state.selectedId = null;
  state.emptyPage = false;
}

function makeEmptyState(
  icon: "spinner" | "inbox" | "note",
  title: string,
  message: string,
): HTMLElement {
  const wrap = element("div", `empty-state${icon === "spinner" ? " is-loading" : ""}`);
  const symbol = element("span", `empty-icon empty-icon-${icon}`);
  symbol.setAttribute("aria-hidden", "true");
  if (icon !== "spinner") symbol.textContent = icon === "inbox" ? "⌂" : "↖";
  wrap.append(
    symbol,
    textElement("strong", "empty-title", title),
    textElement("span", "empty-copy", message),
  );
  return wrap;
}

function makeAlert(message: string, isError: boolean): HTMLElement {
  const alert = textElement(
    "div",
    `inline-alert${isError ? " alert-error" : " alert-warning"}`,
    message,
  );
  alert.setAttribute("role", isError ? "alert" : "status");
  return alert;
}

function makeRule(): HTMLElement {
  return element("div", "section-rule");
}

function makeStatusBadge(status: ReportStatus): HTMLElement {
  const labels: Record<ReportStatus, string> = {
    open: "Open",
    in_review: "In review",
    resolved: "Resolved",
  };
  const badge = textElement(
    "span",
    `status-badge status-${status.replace("_", "-")}`,
    labels[status],
  );
  return badge;
}

function makeTypeBadge(type: ReportType): HTMLElement {
  const badge = textElement(
    "span",
    `type-badge type-${type}`,
    type === "bug" ? "Bug report" : "Feedback",
  );
  return badge;
}

function makeSelect(
  label: string,
  selected: string,
  options: [string, string][],
): HTMLSelectElement {
  const select = element("select", "select-input") as HTMLSelectElement;
  select.setAttribute("aria-label", label);
  for (const [value, text] of options) {
    const option = textElement("option", "", text) as HTMLOptionElement;
    option.value = value;
    select.append(option);
  }
  select.value = selected;
  return select;
}

function renderNotice(options: {
  kind: "setup" | "error" | "loading" | "denied";
  title: string;
  message: string;
}): void {
  main.replaceChildren();
  const page = element("section", `notice-page notice-${options.kind}`);
  const card = element("div", "notice-card");
  const mark = element("span", `notice-mark notice-mark-${options.kind}`);
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = options.kind === "loading" ? "…" : options.kind === "denied" ? "!" : "i";
  card.append(
    mark,
    textElement("p", "eyebrow", "HOMECARE · REPORT INBOX"),
    textElement("h1", "notice-title", options.title),
    textElement("p", "notice-copy", options.message),
  );
  if (options.kind === "loading") {
    const progress = element("div", "loading-line");
    card.append(progress);
  }
  if (options.kind === "denied" || options.kind === "error") {
    const button = textElement(
      "button",
      "button button-quiet",
      "Sign out and try another account",
    ) as HTMLButtonElement;
    button.type = "button";
    button.addEventListener("click", () => {
      if (auth) void signOut(auth);
    });
    card.append(button);
  }
  page.append(card);
  main.append(page);
}

function timestampToIso(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return (value.toDate() as Date).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : "";
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  const delta = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function readableError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (
    code.includes("auth/invalid-credential") ||
    code.includes("auth/wrong-password") ||
    code.includes("auth/user-not-found")
  ) {
    return "Email or password was not recognized.";
  }
  if (code.includes("auth/popup-closed-by-user"))
    return "The Google sign-in window was closed before finishing.";
  if (code.includes("auth/unauthorized-domain"))
    return "This domain is not authorized for Firebase Authentication. Add it in Firebase Console → Authentication → Settings → Authorized domains.";
  if (code.includes("permission-denied"))
    return "Firestore denied this request. Confirm this account is enabled in staff_access and that the report rules are deployed.";
  if (code.includes("failed-precondition"))
    return "This filter needs a Firestore index. Use the index link in the browser console, or retry without the filter after an administrator creates it.";
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  return message.length > 360 ? `${message.slice(0, 357)}…` : message;
}

function clearOnPermissionError(error: unknown): boolean {
  if (!isPermissionError(error)) return false;
  isStaff = false;
  loadGeneration += 1;
  resetPrivateState();
  renderNotice({
    kind: "denied",
    title: "Access changed",
    message:
      "Your cached report content has been cleared. Confirm your staff access, then sign in again.",
  });
  return true;
}

function isPermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String(error.code).includes("permission-denied")
  );
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function textElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] {
  const node = element(tag, className);
  node.textContent = text;
  return node;
}

signOutButton.addEventListener("click", () => {
  if (auth) void signOut(auth);
});

redactionConfirm.addEventListener("change", () => {
  copyButton.disabled = !redactionConfirm.checked;
  copyStatus.textContent = "";
});

chatPreview.addEventListener("input", () => {
  redactionConfirm.checked = false;
  copyButton.disabled = true;
  copyStatus.textContent = "";
});

copyButton.addEventListener("click", async () => {
  if (!redactionConfirm.checked || !currentReportToShare || !isStaff) return;
  const expectedIdentity = identityGeneration;
  try {
    await navigator.clipboard.writeText(chatPreview.value);
    if (expectedIdentity !== identityGeneration || !isStaff || !currentReportToShare) return;
    copyStatus.textContent = "Copied. The text was not sent to any service.";
    copyStatus.className = "inline-status success-text";
  } catch {
    if (expectedIdentity !== identityGeneration || !isStaff || !currentReportToShare) return;
    chatPreview.focus();
    chatPreview.select();
    copyStatus.textContent =
      "Clipboard access is unavailable. The text is selected; use your device’s copy command.";
    copyStatus.className = "inline-status error-text";
  }
});

function closeChatDialog(): void {
  chatDialog.close();
  currentReportToShare = null;
  chatPreview.value = "";
  redactionConfirm.checked = false;
  copyButton.disabled = true;
}

appRoot.querySelector<HTMLButtonElement>("#close-chat")!.addEventListener("click", closeChatDialog);
appRoot
  .querySelector<HTMLButtonElement>("#cancel-chat")!
  .addEventListener("click", closeChatDialog);
chatDialog.addEventListener("click", (event) => {
  if (event.target === chatDialog) closeChatDialog();
});
chatDialog.addEventListener("close", () => {
  currentReportToShare = null;
  chatPreview.value = "";
  redactionConfirm.checked = false;
  copyButton.disabled = true;
});

bootstrap();
