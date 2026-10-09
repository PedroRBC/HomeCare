import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ConsentScreen } from "@/screens/privacy/ConsentScreen";
import { PrivacyCenterScreen } from "@/screens/privacy/PrivacyCenterScreen";
import { DeleteAccountScreen } from "@/screens/DeleteAccountScreen";
import { PrivacyPolicyScreen } from "@/screens/PrivacyPolicyScreen";
import { TermsOfServiceScreen } from "@/screens/TermsOfServiceScreen";
import { AlertModal } from "@/screens/AlertModal";
import { ConsentStackParamList } from "./types";

const ConsentStack = createNativeStackNavigator<ConsentStackParamList>();

// Shown until the user accepts the current policies. The rest of the app stays
// closed, but exporting the data and deleting the account (LGPD art. 18) must not
// depend on accepting.
export function ConsentRoutes() {
  return (
    <ConsentStack.Navigator
      screenOptions={{ headerShown: false, animation: "slide_from_right" }}
      initialRouteName="Consent">
      <ConsentStack.Screen name="Consent" component={ConsentScreen} />
      <ConsentStack.Screen name="PrivacyCenter" component={PrivacyCenterScreen} />
      <ConsentStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <ConsentStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <ConsentStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <ConsentStack.Screen
        name="AlertModal"
        component={AlertModal}
        options={{
          animation: "fade",
          presentation: "transparentModal",
          headerShown: false,
          gestureEnabled: true,
        }}
      />
    </ConsentStack.Navigator>
  );
}
