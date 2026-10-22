import type { ReactNode } from "react";
import { View } from "react-native";
import { LoadingScreen } from "./LoadingScreen";

/** Keep navigation and in-progress forms mounted while a house reloads. */
export const ScheduleGate = ({ loading, children }: { loading: boolean; children: ReactNode }) => (
  <View className="flex-1">
    <View
      className="flex-1"
      collapsable={false}
      pointerEvents={loading ? "none" : "auto"}
      accessibilityElementsHidden={loading}
      importantForAccessibility={loading ? "no-hide-descendants" : "auto"}>
      {children}
    </View>
    {loading && (
      <View className="absolute inset-0" accessibilityViewIsModal>
        <LoadingScreen />
      </View>
    )}
  </View>
);
