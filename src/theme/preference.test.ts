import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createThemeStore,
  parseThemePreference,
  resolveThemeScheme,
  THEME_STORAGE_KEY,
} from "./preference";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

const memoryStorage = (initial: string | null = null) => {
  let value = initial;
  return {
    getItem: async (_key: string) => value,
    setItem: async (_key: string, next: string) => {
      value = next;
    },
    value: () => value,
  };
};

describe("appearance preference", () => {
  test("accepts only stored light, dark, and system values", () => {
    for (const value of ["light", "dark", "system"]) {
      assert.equal(parseThemePreference(value), value);
    }
    for (const value of [null, undefined, "", "auto", "LIGHT", " dark ", {}, 1]) {
      assert.equal(parseThemePreference(value), "system");
    }
  });

  test("resolves Auto from the OS, falling back to light for unknown appearance", () => {
    assert.equal(resolveThemeScheme("system", "dark"), "dark");
    for (const value of ["light", null, undefined, "unknown"]) {
      assert.equal(resolveThemeScheme("system", value), "light");
    }
    assert.equal(resolveThemeScheme("light", "dark"), "light");
    assert.equal(resolveThemeScheme("dark", "light"), "dark");
  });

  test("defaults to Auto and hydrates a saved preference", async () => {
    const storage = memoryStorage("light");
    const store = createThemeStore(storage, "dark");
    assert.deepEqual(store.getSnapshot(), { preference: "system", scheme: "dark", loaded: false });
    await store.hydrate();
    assert.deepEqual(store.getSnapshot(), { preference: "light", scheme: "light", loaded: true });
  });

  test("missing and invalid values hydrate as Auto", async () => {
    for (const value of [null, "invalid"]) {
      const store = createThemeStore(memoryStorage(value), "dark");
      await store.hydrate();
      assert.deepEqual(store.getSnapshot(), { preference: "system", scheme: "dark", loaded: true });
    }
  });

  test("read failures cannot block startup", async () => {
    const store = createThemeStore(
      {
        getItem: async () => {
          throw new Error("Unavailable");
        },
        setItem: async () => {},
      },
      "dark",
    );
    await store.hydrate();
    assert.deepEqual(store.getSnapshot(), { preference: "system", scheme: "dark", loaded: true });
  });

  test("hydration uses the latest OS appearance", async () => {
    const read = deferred<string | null>();
    const store = createThemeStore(
      { getItem: () => read.promise, setItem: async () => {} },
      "light",
    );
    const hydration = store.hydrate();
    store.syncSystemScheme("dark");
    read.resolve("system");
    await hydration;
    assert.equal(store.getSnapshot().scheme, "dark");
  });

  test("a late read never overwrites a new choice", async () => {
    const read = deferred<string | null>();
    const store = createThemeStore(
      { getItem: () => read.promise, setItem: async () => {} },
      "light",
    );
    const hydration = store.hydrate();
    await store.setPreference("dark");
    read.resolve("light");
    await hydration;
    assert.deepEqual(store.getSnapshot(), { preference: "dark", scheme: "dark", loaded: true });
  });

  test("a failed late read also preserves the user's new choice", async () => {
    const read = deferred<string | null>();
    const store = createThemeStore(
      { getItem: () => read.promise, setItem: async () => {} },
      "light",
    );
    const hydration = store.hydrate();
    await store.setPreference("dark");
    read.reject(new Error("Unavailable"));
    await hydration;
    assert.equal(store.getSnapshot().preference, "dark");
  });

  test("repeated hydration reads only once (including strict-mode effects)", async () => {
    let reads = 0;
    const store = createThemeStore(
      {
        getItem: async () => {
          reads += 1;
          return "dark";
        },
        setItem: async () => {},
      },
      "light",
    );
    await Promise.all([store.hydrate(), store.hydrate()]);
    await store.hydrate();
    assert.equal(reads, 1);
  });

  test("rapid changes apply immediately and persist serially, last tap wins", async () => {
    const firstWrite = deferred<void>();
    const writes: string[] = [];
    let saved: string | null = null;
    const store = createThemeStore(
      {
        getItem: async () => null,
        setItem: async (key, value) => {
          assert.equal(key, THEME_STORAGE_KEY);
          writes.push(value);
          if (writes.length === 1) await firstWrite.promise;
          saved = value;
        },
      },
      "light",
    );
    const first = store.setPreference("dark");
    const second = store.setPreference("light");
    const last = store.setPreference("system");
    assert.equal(store.getSnapshot().preference, "system");
    await Promise.resolve();
    assert.deepEqual(writes, ["dark"]);
    firstWrite.resolve();
    await Promise.all([first, second, last]);
    assert.deepEqual(writes, ["dark", "light", "system"]);
    assert.equal(saved, "system");
  });

  test("failed writes preserve the current UI and do not break later writes", async () => {
    const storage = memoryStorage();
    const store = createThemeStore(
      {
        ...storage,
        setItem: async (key, value) => {
          if (value === "dark") throw new Error("Unavailable");
          return storage.setItem(key, value);
        },
      },
      "light",
    );
    await store.setPreference("dark");
    assert.equal(store.getSnapshot().scheme, "dark");
    await store.setPreference("light");
    assert.equal(storage.value(), "light");
  });

  test("explicit modes stay fixed through live and resume OS updates", async () => {
    const store = createThemeStore(memoryStorage(), "light");
    await store.setPreference("dark");
    store.syncSystemScheme("light");
    assert.equal(store.getSnapshot().scheme, "dark");
    await store.setPreference("light");
    store.syncSystemScheme("dark");
    assert.equal(store.getSnapshot().scheme, "light");
    await store.setPreference("system");
    assert.equal(store.getSnapshot().scheme, "dark");
    store.syncSystemScheme("light");
    assert.equal(store.getSnapshot().scheme, "light");
  });

  test("persisted preference survives creating a new store", async () => {
    const storage = memoryStorage();
    const first = createThemeStore(storage, "light");
    await first.setPreference("dark");
    const restarted = createThemeStore(storage, "light");
    await restarted.hydrate();
    assert.equal(restarted.getSnapshot().preference, "dark");
  });

  test("notifies subscribers and stops after unsubscribe", async () => {
    const store = createThemeStore(memoryStorage(), "light");
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });
    await store.hydrate();
    store.syncSystemScheme("dark");
    await store.setPreference("light");
    assert.equal(notifications, 3);
    unsubscribe();
    await store.setPreference("dark");
    assert.equal(notifications, 3);
  });
});
