import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { createRenderer, installNativeRuntime, nodes, text } from "../../test/native";
installNativeRuntime();
const state: any = {
  userHouses: [],
  invitations: [],
  houseAccessIssues: [],
  isLoading: false,
  refreshHouses: async () => {},
  selectHouse: async () => {},
};
mock.module("@/context/HouseContext", () => ({ useHouse: () => state }));
mock.module("@/context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
mock.module("@/context/CaregiverContext", () => ({
  useCaregiver: () => ({ links: [], acceptedLinks: [], pendingLinks: [] }),
}));
mock.module("@/context/AlertContext", () => ({ useAlert: () => ({ showAlert: () => {} }) }));
mock.module("@/hooks/useAppNavigation", () => ({
  useAppNavigation: () => ({ navigateToCareManagement: () => {} }),
}));
const { HouseSelectionScreen } = await import("./HouseSelectionScreen");

test("compact house heading leaves house choices and role-specific recovery discoverable", () => {
  for (const count of [0, 1, 3]) {
    state.userHouses = Array.from({ length: count }, (_, i) => ({
      id: String(i),
      name: `House ${i}`,
      managers: [],
    }));
    state.houseAccessIssues = ["missing"];
    state.invitations = [
      { id: "invite", status: "pending", houseName: "Invited house", invitedByName: "Owner" },
    ];
    const renderer = createRenderer();
    const tree = renderer.render(() =>
      HouseSelectionScreen({ navigation: { navigate: () => {} } }),
    );
    const heading = nodes(tree).find((node) => node.props.title === "houses.select.title");
    assert.ok(heading);
    assert.equal(heading.props.subtitle, "houses.select.subtitle");
    assert.ok(nodes(tree).some((node) => node.props.testID === "house-access-retry"));
    assert.ok(text(tree).includes("Invited house"));
    assert.ok(text(tree).includes("houses.select.create"));
    if (count > 0) assert.ok(text(tree).includes("House 0"));
    else assert.ok(text(tree).includes("houses.select.unavailable"));
    renderer.unmount();
  }
});
