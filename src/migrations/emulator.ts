import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

export function localEndpoint(value: string | undefined, name: string): string {
  const match = /^(127\.0\.0\.1|localhost):([1-9][0-9]{0,4})$/.exec(value ?? "");
  if (!match || Number(match[2]) > 65535 || match[0] !== value) {
    throw new Error(`${name} must identify a running local emulator (localhost:port)`);
  }
  return match[0];
}

export async function setFirestoreEmulatorRules(
  endpoint: string,
  projectId: string,
  rules: string,
): Promise<void> {
  localEndpoint(endpoint, "FIRESTORE_EMULATOR_HOST");
  if (!/^demo-[a-z0-9-]+$/.test(projectId)) {
    throw new Error("Rule installation requires a demo-* project");
  }
  if (process.env.FIREBASE_EMULATOR_HUB) {
    localEndpoint(process.env.FIREBASE_EMULATOR_HUB, "FIREBASE_EMULATOR_HUB");
  }
  const [host, port] = endpoint.split(":");
  const environment = await initializeTestEnvironment({
    projectId,
    firestore: { host, port: Number(port), rules },
  });
  await environment.cleanup();
}
