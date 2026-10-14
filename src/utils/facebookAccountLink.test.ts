import { test } from "node:test";
import assert from "node:assert/strict";
import { authenticateAndLinkFacebook, FACEBOOK_LINK_TIMEOUT_MS } from "./facebookAccountLink";

const token = { type: "access" as const, token: "pending-facebook-token" };
const user = { uid: "existing-account" };

test("linking authenticates the existing account before using the Facebook credential", async () => {
  const calls: string[] = [];
  const result = await authenticateAndLinkFacebook({
    token,
    createdAt: 0,
    now: () => 1,
    authenticate: async () => {
      calls.push("authenticate");
      return user;
    },
    isCurrent: () => true,
    link: async (account, credential) => {
      assert.equal(account, user);
      assert.equal(credential, token);
      calls.push("link");
      return account;
    },
  });
  assert.equal(result.uid, user.uid);
  assert.deepEqual(calls, ["authenticate", "link"]);
});

test("a wrong password never links Facebook", async () => {
  let links = 0;
  await assert.rejects(
    authenticateAndLinkFacebook({
      token,
      createdAt: 0,
      now: () => 1,
      authenticate: async () => {
        throw new Error("wrong-password");
      },
      isCurrent: () => true,
      link: async () => {
        links++;
        return user;
      },
    }),
    /wrong-password/,
  );
  assert.equal(links, 0);
});

test("expired attempts never authenticate, and expiration during login prevents linking", async () => {
  for (const expiresDuringLogin of [false, true]) {
    let now = expiresDuringLogin ? 1 : FACEBOOK_LINK_TIMEOUT_MS;
    let authentications = 0;
    let links = 0;
    await assert.rejects(
      authenticateAndLinkFacebook({
        token,
        createdAt: 0,
        now: () => now,
        authenticate: async () => {
          authentications++;
          now = FACEBOOK_LINK_TIMEOUT_MS;
          return user;
        },
        isCurrent: () => true,
        link: async () => {
          links++;
          return user;
        },
      }),
      /FACEBOOK_LINK_EXPIRED/,
    );
    assert.equal(authentications, expiresDuringLogin ? 1 : 0);
    assert.equal(links, 0);
  }
});

test("cancelled attempts and changed sessions cannot link an authenticated account", async () => {
  let links = 0;
  await assert.rejects(
    authenticateAndLinkFacebook({
      token,
      createdAt: 0,
      now: () => 1,
      authenticate: async () => user,
      isCurrent: () => false,
      link: async () => {
        links++;
        return user;
      },
    }),
    /FACEBOOK_LINK_SESSION_CHANGED/,
  );
  assert.equal(links, 0);
});

test("the workflow never reports success for a different account or an ended session", async () => {
  for (const switchAccount of [false, true]) {
    let current = true;
    await assert.rejects(
      authenticateAndLinkFacebook({
        token,
        createdAt: 0,
        now: () => 1,
        authenticate: async () => user,
        isCurrent: () => current,
        link: async () => {
          current = switchAccount;
          return switchAccount ? { uid: "other" } : user;
        },
      }),
      /FACEBOOK_LINK_SESSION_CHANGED/,
    );
  }
});
