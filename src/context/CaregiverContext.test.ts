import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { createRenderer, installNativeRuntime } from "@/test/native";
import type { CaregiverLink } from "@/utils/caregiverShifts";

installNativeRuntime();
const user = { uid: "cg", email: "cg@example.com", emailVerified: true };
let receiveLinks: (links: CaregiverLink[]) => void;
const accesses: { userId: string; linkId: string }[] = [];
mock.module("./AuthContext", () => ({ useAuth: () => ({ user }) }));
mock.module("@/services/caregiverPay", () => ({ CaregiverPayService: { read: async () => null } }));
mock.module("@/services/firestore", () => ({
  FirestoreService: {
    subscribeToCaregiverLinks: (_email: string, update: typeof receiveLinks) => {
      receiveLinks = update;
      return () => {};
    },
    subscribeToHouseSchedule: (
      _house: string,
      access: (typeof accesses)[number],
      update: (schedule: unknown) => void,
    ) => {
      accesses.push(access);
      update({ "2026-10-31": { day: ["c1"], night: [] } });
      return () => {};
    },
  },
}));
const { CaregiverProvider } = await import("./CaregiverContext");

test("shared house access selects an active accepted link in either order and after disabling another", () => {
  const link = (caregiverId: string, disabled: boolean): CaregiverLink => ({
    id: `h1__${caregiverId}`,
    houseId: "h1",
    houseName: "House",
    caregiverId,
    caregiverName: caregiverId,
    email: user.email,
    status: "accepted",
    disabled,
  });
  for (const order of [false, true]) {
    const renderer = createRenderer();
    const read = () =>
      (renderer.render(() => CaregiverProvider({ children: null })) as any).props.value;
    read();
    const links = [link("c1", false), link("c2", true)];
    receiveLinks(order ? links.reverse() : links);
    read();
    assert.equal(accesses.at(-1)!.linkId, "h1__c1");
    assert.equal(read().shifts.length, 1);
    // Historical schedule remains available if all links are disabled, but notes rules still deny it.
    receiveLinks([link("c1", true), link("c2", true)]);
    read();
    assert.ok(accesses.at(-1));
    receiveLinks([link("c1", false), link("c2", true)]);
    read();
    assert.equal(accesses.at(-1)!.linkId, "h1__c1");
    renderer.unmount();
  }
});
