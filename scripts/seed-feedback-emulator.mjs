import { pathToFileURL } from "node:url";

export function feedbackEmulatorConfig(env = process.env) {
  const projectId = env.GCLOUD_PROJECT ?? "demo-homecare-rules";
  const authHost = env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestoreHost = env.FIRESTORE_EMULATOR_HOST;
  const localHost = /^(localhost|127\.0\.0\.1):[1-9][0-9]{0,4}$/;
  if (
    !projectId.startsWith("demo-") ||
    !/^[a-z0-9-]+$/.test(projectId) ||
    !authHost ||
    !firestoreHost ||
    !localHost.test(authHost) ||
    !localHost.test(firestoreHost)
  ) {
    throw new Error(
      "Seeding requires a demo-* project and explicit loopback Auth/Firestore emulator hosts. Production is never supported.",
    );
  }
  for (const host of [authHost, firestoreHost]) {
    if (Number(host.split(":")[1]) > 65535) throw new Error("Invalid emulator port");
  }
  return { projectId, authHost, firestoreHost };
}

export function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, entry]) => [key, firestoreValue(entry)]),
        ),
      },
    };
  }
  throw new Error("Unsupported seed field");
}

async function request(url, body, headers = {}, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error?.message ?? `Emulator request failed (${response.status})`);
  return result;
}

export async function seedFeedbackEmulator(env = process.env) {
  const { projectId, authHost, firestoreHost } = feedbackEmulatorConfig(env);
  const password = "local-feedback-demo-only";
  const account = async (email) => {
    const url = `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:`;
    try {
      return await request(`${url}signUp?key=demo-key`, {
        email,
        password,
        returnSecureToken: true,
      });
    } catch (error) {
      if (error.message !== "EMAIL_EXISTS") throw error;
      return request(`${url}signInWithPassword?key=demo-key`, {
        email,
        password,
        returnSecureToken: true,
      });
    }
  };
  const staff = await account("staff@example.test");
  const author = await account("user@example.test");
  const documentUrl = `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/`;
  const write = (path, fields) =>
    request(`${documentUrl}${path}`, { fields }, { Authorization: "Bearer owner" }, "PATCH");
  await write(`staff_access/${staff.localId}`, { enabled: { booleanValue: true } });
  for (let i = 1; i <= 55; i++) {
    const type = i % 3 === 0 ? "feedback" : "bug";
    const content = {
      schemaVersion: 1,
      reporterUid: author.localId,
      type,
      title:
        i === 1
          ? "<img src=x onerror=alert('untrusted')>"
          : type === "bug"
            ? `Demo ${i}: keyboard covers the save button`
            : `Demo ${i}: make the schedule easier to read`,
      description:
        "Synthetic emulator report, not a real user submission. Use this to verify the private feedback workflow.",
      steps: type === "bug" ? "Open a form and focus the last input." : "",
      expected: type === "bug" ? "The save button remains reachable." : "",
      actual: type === "bug" ? "The keyboard covers the button." : "",
      context: {
        appVersion: "2.6.0",
        appBuild: "1",
        platform: "android",
        osVersion: "15",
        language: "en",
      },
      status: i % 5 === 0 ? "resolved" : i % 4 === 0 ? "in_review" : "open",
      issueUrl: null,
      reviewerUid: null,
    };
    const time = new Date(Date.now() - i * 60000).toISOString();
    const fields = firestoreValue(content).mapValue.fields;
    fields.createdAt = { timestampValue: time };
    fields.updatedAt = { timestampValue: time };
    await write(`feedback_reports/demo-report-${String(i).padStart(3, "0")}`, fields);
  }
  console.log(`Seeded 55 synthetic reports in ${projectId}. No production service was contacted.`);
  console.log(`Staff login: staff@example.test / ${password}`);
  console.log(`Nonstaff login: user@example.test / ${password}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedFeedbackEmulator().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
