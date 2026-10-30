import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { localEndpoint, setFirestoreEmulatorRules } from "./emulator";

test("local emulator endpoints reject remote hosts, URL tricks and invalid ports", () => {
  for (const endpoint of ["localhost:8180", "127.0.0.1:65535"]) {
    assert.equal(localEndpoint(endpoint, "TEST_HOST"), endpoint);
  }
  for (const endpoint of [
    undefined,
    "",
    "example.com:8180",
    "localhost.example.com:8180",
    "localhost:8180@example.com",
    "localhost:8180/path",
    "localhost:8180\n",
    "http://localhost:8180",
    "localhost:0",
    "localhost:65536",
  ]) {
    assert.throws(() => localEndpoint(endpoint, "TEST_HOST"), /local emulator/);
  }
});

test("rule installation rejects a remote emulator discovery hub before making requests", async () => {
  const previousHub = process.env.FIREBASE_EMULATOR_HUB;
  process.env.FIREBASE_EMULATOR_HUB = "example.com:4400";
  try {
    await assert.rejects(
      setFirestoreEmulatorRules("127.0.0.1:8180", "demo-homecare-test", "rules"),
      /FIREBASE_EMULATOR_HUB.*local emulator/,
    );
  } finally {
    if (previousHub === undefined) delete process.env.FIREBASE_EMULATOR_HUB;
    else process.env.FIREBASE_EMULATOR_HUB = previousHub;
  }
});

test("rule installation refuses remote destinations and production projects", async () => {
  await assert.rejects(
    setFirestoreEmulatorRules("example.com:8180", "demo-homecare-test", "rules"),
    /local emulator/,
  );
  await assert.rejects(
    setFirestoreEmulatorRules("127.0.0.1:8180", "homecare-production", "rules"),
    /demo-\*/,
  );
});

test("rule installation uses the Firebase emulator API and propagates rejected rules", async (t) => {
  const requests: { method?: string; path?: string; body: unknown }[] = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({
      method: request.method,
      path: request.url,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    });
    response.writeHead(requests.length === 1 ? 200 : 400);
    response.end(requests.length === 1 ? "{}" : "Invalid test rules");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `127.0.0.1:${address.port}`;
  await setFirestoreEmulatorRules(endpoint, "demo-homecare-test", "allow read: if false;");
  assert.deepEqual(requests[0], {
    method: "PUT",
    path: "/emulator/v1/projects/demo-homecare-test:securityRules",
    body: { rules: { files: [{ content: "allow read: if false;" }] } },
  });
  await assert.rejects(
    setFirestoreEmulatorRules(endpoint, "demo-homecare-test", "invalid"),
    /Invalid test rules/,
  );
});
