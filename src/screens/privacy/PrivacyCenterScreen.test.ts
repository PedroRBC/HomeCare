import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { createRenderer, installNativeRuntime, nodes, text } from "../../test/native";
installNativeRuntime();
mock.module("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "owner", consents: {} },
    updateConsents: async () => {},
    refreshEmailVerification: async () => true,
  }),
}));
mock.module("@/context/AlertContext", () => ({ useAlert: () => ({ showAlert: () => {} }) }));
mock.module("@/services/firestore", () => ({ FirestoreService: {} }));
mock.module("@/services/exportService", () => ({ exportPersonalData: async () => {} }));
mock.module("./ConsentScreen", () => ({ ConsentToggle: "ConsentToggle" }));
const { PrivacyCenterScreen } = await import("./PrivacyCenterScreen");

test("privacy controls precede the complete protection disclosures without widening consent-only navigation", () => {
  for (const profileAllowed of [false, true]) {
    const navigations: string[] = [];
    const renderer = createRenderer();
    const tree = renderer.render(() =>
      PrivacyCenterScreen({
        navigation: {
          goBack: () => {},
          navigate: (route: string) => navigations.push(route),
          getState: () => ({
            routeNames: profileAllowed
              ? ["UserProfile"]
              : ["PrivacyPolicy", "TermsOfService", "DeleteAccount"],
          }),
        },
      }),
    );
    const body = text(tree);
    assert.ok(
      body.indexOf("privacy.center.consentsTitle") < body.indexOf("privacy.center.protectionTitle"),
    );
    assert.ok(
      body.indexOf("privacy.center.rightsTitle") < body.indexOf("privacy.center.protectionTitle"),
    );
    for (const key of [
      "protectionEncryption",
      "protectionKeys",
      "protectionTls",
      "protectionDeletion",
      "protectionSupport",
      "socialLogin",
    ])
      assert.ok(body.includes(`privacy.center.${key}`));
    const actions = nodes(tree).filter((node) => node.props.onPress && node.props.title);
    assert.equal(
      actions.some((node) => node.props.title === "privacy.center.correct"),
      profileAllowed,
    );
    for (const key of ["privacy.consent.privacy", "privacy.consent.terms", "privacy.center.delete"])
      actions.find((node) => node.props.title === key)!.props.onPress();
    assert.deepEqual(navigations, ["PrivacyPolicy", "TermsOfService", "DeleteAccount"]);
    assert.ok(nodes(tree).some((node) => node.props.testID === "privacy-export"));
    assert.equal(
      nodes(tree).find((node) => node.props.testID === "privacy-analytics")!.props.value,
      false,
    );
    renderer.unmount();
  }
});
