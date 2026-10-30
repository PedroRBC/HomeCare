import { createCipheriv, randomBytes } from "node:crypto";
import { closeSync, mkdirSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function mobileEmulatorConfig(env = process.env) {
  const projectId = env.GCLOUD_PROJECT;
  const authHost = env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestoreHost = env.FIRESTORE_EMULATOR_HOST;
  const localHost = /^(localhost|127\.0\.0\.1):([1-9][0-9]{0,4})$/;
  if (
    typeof projectId !== "string" ||
    !/^demo-[a-z0-9-]+$/.test(projectId) ||
    !authHost ||
    !firestoreHost ||
    !localHost.test(authHost) ||
    !localHost.test(firestoreHost)
  ) {
    throw new Error(
      "Seed requires explicit demo-* GCLOUD_PROJECT and loopback Auth/Firestore emulator hosts; production is unsupported.",
    );
  }
  for (const [host, expectedPort] of [
    [authHost, "9199"],
    [firestoreHost, "8180"],
  ]) {
    const match = host.match(localHost);
    if (!match || match[2] !== expectedPort) {
      throw new Error(`Unexpected emulator port. Auth must use 9199 and Firestore 8180.`);
    }
  }
  return { projectId, authHost, firestoreHost };
}

export function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number" && Number.isFinite(value)) return { doubleValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(firestoreValue) } };
  }
  if (value && typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, entry]) => [key, firestoreValue(entry)]),
        ),
      },
    };
  }
  throw new Error("Unsupported Firestore emulator seed value");
}

export function encryptField(key, value, context) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const payload = Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]);
  return `enc:v1:${payload.toString("base64")}`;
}

async function request(url, body, headers = {}, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result.error?.message ?? `Emulator request failed (${response.status})`;
    throw new Error(message);
  }
  return result;
}

export async function seedMobileEmulator(env = process.env, options = {}) {
  const { projectId, authHost, firestoreHost } = mobileEmulatorConfig(env);
  const reportsDir = resolve(options.reportsDir ?? "reports");
  mkdirSync(reportsDir, { recursive: true, mode: 0o700 });
  const credentialsPath = resolve(reportsDir, "mobile-emulator-credentials.json");
  let credentialsFile;
  try {
    credentialsFile = openSync(credentialsPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`Refusing to overwrite existing credentials file: ${credentialsPath}`);
    }
    throw error;
  }
  try {
    const email = `screenshots-${Date.now()}@example.test`;
    const password = randomBytes(24).toString("base64url");
    const authUrl = `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`;

    let account;
    try {
      account = await request(authUrl, { email, password, returnSecureToken: true });
    } catch (error) {
      unlinkSync(credentialsPath);
      throw new Error(
        `Could not create the synthetic Auth account in the emulator: ${error.message}`,
      );
    }

    const timestamp = new Date();
    const now = timestamp.toISOString();
    const dayKey = (offset) => {
      const date = new Date(timestamp);
      date.setDate(date.getDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    const uid = account.localId;
    const houseId = `demo-homecare-house-${uid}`;
    // Keep recovery credentials even if the subsequent Firestore seed fails.
    writeFileSync(
      credentialsFile,
      JSON.stringify({ email, password, projectId, uid, houseId }, null, 2) + "\n",
    );
    const caregiverId = "demo-caregiver-ana";
    const key = randomBytes(32);
    const encodedKey = key.toString("base64");
    const manager = {
      userId: uid,
      email,
      displayName: "Conta de demonstração",
      role: "owner",
      addedAt: now,
      addedBy: uid,
    };
    const house = {
      id: houseId,
      name: "Casa de demonstração",
      description: "Dados sintéticos para capturas locais.",
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      managers: [manager],
      isActive: true,
    };
    const caregiverPath = `houses/${houseId}/caregivers/${caregiverId}`;
    const caregiver = {
      id: caregiverId,
      name: encryptField(key, "Ana Cuidadora", `${caregiverPath}#name`),
      frequency: "Diário",
      amount: encryptField(key, 180, `${caregiverPath}#amount`),
      dayAmount: encryptField(key, 180, `${caregiverPath}#dayAmount`),
      nightAmount: encryptField(key, 220, `${caregiverPath}#nightAmount`),
      additionalAmount: encryptField(key, 30, `${caregiverPath}#additionalAmount`),
      createdAt: now,
      updatedAt: now,
    };
    const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => dayKey(offset));
    const schedule = Object.fromEntries(
      days.map((date, index) => [
        date,
        {
          day: [caregiverId],
          night: index % 2 === 0 ? [caregiverId] : [],
          dayExtra: [],
          nightExtra: [],
          dayAdditional: index % 3 === 0 ? [caregiverId] : [],
          nightAdditional: [],
          updatedAt: now,
        },
      ]),
    );
    const paidDate = dayKey(-1);
    const paymentKey = `day-${paidDate}-${paidDate}`;
    const paymentId = `${caregiverId}__regular:day:${paidDate}`;
    const historyKey = `${caregiverId}::Diário::regular::${paidDate}`;
    const historyPath = `houses/${houseId}/paymentHistory/${historyKey.replaceAll("/", "_")}`;
    const history = {
      id: historyKey.replaceAll("/", "_"),
      caregiverId,
      caregiverName: encryptField(key, "Ana Cuidadora", `${historyPath}#caregiverName`),
      date: now,
      frequency: "Diário",
      description: encryptField(
        key,
        "Plantão diurno pago (demonstração)",
        `${historyPath}#description`,
      ),
      amount: encryptField(key, 180, `${historyPath}#amount`),
      dayRate: encryptField(key, 180, `${historyPath}#dayRate`),
      paidAt: now,
      createdAt: now,
      managerName: encryptField(key, "Conta de demonstração", `${historyPath}#managerName`),
      periodKey: paidDate,
      paymentKeys: [paymentKey],
      historyKey,
    };

    const baseUrl = `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/`;
    const write = (path, data) =>
      request(
        `${baseUrl}${path}`,
        { fields: firestoreValue(data).mapValue.fields },
        { Authorization: "Bearer owner" },
        "PATCH",
      );
    try {
      const houseWrites = [
        write(`users/${uid}`, {
          id: uid,
          email,
          displayName: "Conta de demonstração",
          createdAt: now,
          updatedAt: now,
          providers: ["password"],
          hasPassword: true,
        }),
        write(`houses/${houseId}`, house),
        write(`user_house_access/${houseId}_${uid}`, {
          userId: uid,
          houseId,
          role: "owner",
          addedAt: now,
        }),
        write(`house_keys/${houseId}`, {
          key: encodedKey,
          version: 1,
          createdAt: now,
          createdBy: uid,
        }),
        write(caregiverPath, caregiver),
        ...Object.entries(schedule).map(([date, data]) =>
          write(`houses/${houseId}/schedule/${date}`, data),
        ),
        write(`houses/${houseId}/payments/${paymentId}`, {
          caregiverId,
          frequency: "Diário",
          paymentKey,
          createdAt: now,
          updatedAt: now,
        }),
        write(`houses/${houseId}/paymentHistory/${history.id}`, history),
      ];
      await Promise.all(houseWrites);
    } catch (error) {
      throw new Error(`Auth account was created but Firestore seed failed: ${error.message}`);
    }

    return { projectId, uid, houseId, caregiverId, credentialsPath };
  } finally {
    closeSync(credentialsFile);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedMobileEmulator()
    .then(({ projectId, houseId, credentialsPath }) => {
      console.log(
        `Seeded synthetic account, profile, house, encrypted caregiver, shifts and payment in ${projectId}.`,
      );
      console.log(
        `Credentials saved with mode 0600 at ${credentialsPath}; do not share or commit this file.`,
      );
      console.log(`House: ${houseId}. No production project or service was contacted.`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
