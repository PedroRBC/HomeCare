import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useEffect, useRef } from "react";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { AppNavigationListener } from "@/components/AppNavigationListener";

// Import screens
import { HomeScreen } from "@/screens/home";
import { CreateScreen } from "@/screens/create";
import { HistoryScreen } from "@/screens/history";
import { PaymentsScreen } from "@/screens/payments";
import { SettingsScreen } from "@/screens/settings";
import { DayDetailsScreen } from "@/screens/day-details";
import { CaregiversScreen } from "@/screens/caregivers";
import { EditCaregiverScreen } from "@/screens/edit-caregiver";
import { PaymentDetailsScreen } from "@/screens/payment-details";
import { AlertModal } from "@/screens/AlertModal";
import { UserProfileScreen } from "@/screens/profile";
import { AccountManagementScreen } from "@/screens/profile/AccountManagementScreen";
import { DeleteAccountScreen } from "@/screens/DeleteAccountScreen";
import { PrivacyPolicyScreen } from "@/screens/PrivacyPolicyScreen";
import { PrivacyCenterScreen } from "@/screens/privacy/PrivacyCenterScreen";
import { TermsOfServiceScreen } from "@/screens/TermsOfServiceScreen";
import { AboutScreen } from "@/screens/AboutScreen";
import { MyShiftsScreen } from "@/screens/caregiver/MyShiftsScreen";
import { useHouse } from "@/context/HouseContext";
import { useCaregiver } from "@/context/CaregiverContext";
import {
  HouseSelectionScreen,
  HouseInviteScreen,
  CreateHouseScreen,
  EditHouseScreen,
} from "@/screens/house";

import {
  MainAppStackParamList,
  HouseManagementTabsParamList,
  CareManagementTabsParamList,
} from "./types";
import { useTranslation } from "react-i18next";
import { useAppTheme, type ThemeColors } from "@/theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

// Figma tab bar: the active icon sits on a soft pill, every tab shows its label
const TabIcon = ({
  name,
  focused,
  color,
}: {
  name: IoniconName;
  focused: boolean;
  color: string;
}) => (
  <View
    className={`h-7 w-[46px] items-center justify-center rounded-full ${focused ? "bg-primary-soft" : ""}`}>
    <Ionicons name={name} size={21} color={color} />
  </View>
);

const tabIcon =
  (name: IoniconName) =>
  ({ focused, color }: { focused: boolean; color: string }) => (
    <TabIcon name={name} focused={focused} color={color} />
  );

const tabBarOptions = (colors: ThemeColors) => ({
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 16,
    height: 76,
  },
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: colors.textSecondary,
  tabBarLabel: ({
    focused,
    color,
    children,
  }: {
    focused: boolean;
    color: string;
    children: string;
  }) => (
    <Text
      numberOfLines={1}
      style={{
        color,
        fontSize: 10,
        marginTop: 4,
        fontFamily: focused ? "Inter_700Bold" : "Inter_400Regular",
      }}>
      {children}
    </Text>
  ),
});

const HouseManagementTabs = createBottomTabNavigator<HouseManagementTabsParamList>();
const CareManagementTabs = createBottomTabNavigator<CareManagementTabsParamList>();
const RootStack = createNativeStackNavigator<MainAppStackParamList>();

// House Management Tabs Navigator
function HouseManagementTabsNavigator({
  navigation,
}: NativeStackScreenProps<MainAppStackParamList, "HouseManagement">) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { userHouses } = useHouse();
  const { links } = useCaregiver();
  // Caregivers who manage no house land on their own schedule
  const isOnlyCaregiver = userHouses.length === 0 && links.length > 0;
  const initialRouteName = isOnlyCaregiver ? "MyShifts" : "HouseSelection";

  // Also when a house links her while she is already logged in
  const wasOnlyCaregiver = useRef(isOnlyCaregiver);
  useEffect(() => {
    if (isOnlyCaregiver && !wasOnlyCaregiver.current) {
      navigation.navigate("HouseManagement", { screen: "MyShifts" });
    }
    wasOnlyCaregiver.current = isOnlyCaregiver;
  }, [isOnlyCaregiver, navigation]);

  return (
    <HouseManagementTabs.Navigator
      screenOptions={{
        headerShown: false,
        animation: "shift",
        ...tabBarOptions(colors),
      }}
      initialRouteName={initialRouteName}>
      <HouseManagementTabs.Screen
        name="HouseSelection"
        component={HouseSelectionScreen}
        options={{
          title: t("common.tabs.houses"),
          tabBarIcon: tabIcon("home-outline"),
        }}
      />
      <HouseManagementTabs.Screen
        name="HouseInvite"
        component={HouseInviteScreen}
        options={{
          title: t("common.tabs.invites"),
          tabBarIcon: tabIcon("mail-outline"),
        }}
      />
      <HouseManagementTabs.Screen
        name="MyShifts"
        component={MyShiftsScreen}
        options={{
          title: t("caregiverView.tab"),
          tabBarIcon: tabIcon("calendar-outline"),
        }}
      />
      <HouseManagementTabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t("common.tabs.settings"),
          tabBarIcon: tabIcon("settings-outline"),
        }}
      />
    </HouseManagementTabs.Navigator>
  );
}

// Care Management Tabs Navigator
function CareManagementTabsNavigator() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <CareManagementTabs.Navigator
      screenOptions={{
        headerShown: false,
        animation: "shift",
        ...tabBarOptions(colors),
      }}
      initialRouteName="DayCalendar">
      <CareManagementTabs.Screen
        name="DayCalendar"
        component={HomeScreen}
        options={{
          title: t("common.tabs.calendar"),
          tabBarIcon: tabIcon("calendar-outline"),
        }}
      />
      <CareManagementTabs.Screen
        name="Caregivers"
        component={CaregiversScreen}
        options={{
          title: t("common.tabs.caregivers"),
          tabBarIcon: tabIcon("people-outline"),
        }}
      />
      <CareManagementTabs.Screen
        name="Create"
        component={CreateScreen}
        options={{
          title: t("common.tabs.create"),
          tabBarIcon: tabIcon("add-circle-outline"),
        }}
      />
      <CareManagementTabs.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{
          title: t("common.tabs.payments"),
          tabBarIcon: tabIcon("card-outline"),
        }}
      />
      <CareManagementTabs.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: t("common.tabs.history"),
          tabBarIcon: tabIcon("time-outline"),
        }}
      />
    </CareManagementTabs.Navigator>
  );
}

// Main App Routes Component
export function MainAppRoutes() {
  return (
    <>
      <AppNavigationListener />
      <RootStack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={"HouseManagement"}>
        <RootStack.Screen name="HouseManagement" component={HouseManagementTabsNavigator} />
        <RootStack.Screen name="CareManagement" component={CareManagementTabsNavigator} />
        <RootStack.Screen
          name="DayDetails"
          component={DayDetailsScreen}
          options={{ animation: "slide_from_bottom" }}
        />
        <RootStack.Screen
          name="EditCaregiver"
          component={EditCaregiverScreen}
          options={{ animation: "slide_from_right" }}
        />
        <RootStack.Screen
          name="PaymentDetails"
          component={PaymentDetailsScreen}
          options={{
            animation: "fade",
            presentation: "transparentModal",
            headerShown: false,
            gestureEnabled: true,
          }}
        />
        <RootStack.Screen
          name="AlertModal"
          component={AlertModal}
          options={{
            animation: "fade",
            presentation: "transparentModal",
            headerShown: false,
            gestureEnabled: true,
          }}
        />
        <RootStack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{ animation: "slide_from_right" }}
        />
        <RootStack.Screen
          name="AccountManagement"
          component={AccountManagementScreen}
          options={{ animation: "slide_from_right" }}
        />
        <RootStack.Screen
          name="CreateHouse"
          component={CreateHouseScreen}
          options={{ animation: "slide_from_right" }}
        />
        <RootStack.Screen
          name="EditHouse"
          component={EditHouseScreen}
          options={{ animation: "slide_from_right" }}
        />
        <RootStack.Screen
          name="DeleteAccount"
          component={DeleteAccountScreen}
          options={{ animation: "slide_from_right" }}
        />
        <RootStack.Screen
          name="PrivacyCenter"
          component={PrivacyCenterScreen}
          options={{ animation: "slide_from_right" }}
        />
        <RootStack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{ animation: "slide_from_right" }}
        />
        <RootStack.Screen
          name="TermsOfService"
          component={TermsOfServiceScreen}
          options={{ animation: "slide_from_right" }}
        />
        <RootStack.Screen
          name="About"
          component={AboutScreen}
          options={{ animation: "slide_from_right" }}
        />
      </RootStack.Navigator>
    </>
  );
}
