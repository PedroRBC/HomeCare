import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
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
import { TermsOfServiceScreen } from "@/screens/TermsOfServiceScreen";
import { AboutScreen } from "@/screens/AboutScreen";
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

const HouseManagementTabs = createBottomTabNavigator<HouseManagementTabsParamList>();
const CareManagementTabs = createBottomTabNavigator<CareManagementTabsParamList>();
const RootStack = createNativeStackNavigator<MainAppStackParamList>();

// House Management Tabs Navigator
function HouseManagementTabsNavigator() {
  const { t } = useTranslation();
  return (
    <HouseManagementTabs.Navigator
      screenOptions={{
        headerShown: false,
        animation: "shift",
        tabBarStyle: {
          backgroundColor: "#18181b",
          borderTopColor: "#27272a",
          paddingBottom: 16,
        },
        tabBarActiveTintColor: "#059669", // emerald-600
        tabBarInactiveTintColor: "#a1a1aa",
      }}
      initialRouteName="HouseSelection">
      <HouseManagementTabs.Screen
        name="HouseSelection"
        component={HouseSelectionScreen}
        options={{
          tabBarLabel: t("common.tabs.houses"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <HouseManagementTabs.Screen
        name="HouseInvite"
        component={HouseInviteScreen}
        options={{
          tabBarLabel: t("common.tabs.invites"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mail-outline" size={size} color={color} />
          ),
        }}
      />
      <HouseManagementTabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: t("common.tabs.settings"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </HouseManagementTabs.Navigator>
  );
}

// Care Management Tabs Navigator
function CareManagementTabsNavigator() {
  const { t } = useTranslation();
  return (
    <CareManagementTabs.Navigator
      screenOptions={{
        headerShown: false,
        animation: "shift",
        tabBarStyle: {
          backgroundColor: "#18181b",
          borderTopColor: "#27272a",
          paddingBottom: 16,
        },
        tabBarActiveTintColor: "#059669", // emerald-600
        tabBarInactiveTintColor: "#a1a1aa",
      }}
      initialRouteName="DayCalendar">
      <CareManagementTabs.Screen
        name="DayCalendar"
        component={HomeScreen}
        options={{
          tabBarLabel: t("common.tabs.calendar"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <CareManagementTabs.Screen
        name="Caregivers"
        component={CaregiversScreen}
        options={{
          tabBarLabel: t("common.tabs.caregivers"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <CareManagementTabs.Screen
        name="Create"
        component={CreateScreen}
        options={{
          tabBarLabel: t("common.tabs.create"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <CareManagementTabs.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{
          tabBarLabel: t("common.tabs.payments"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />
      <CareManagementTabs.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: t("common.tabs.history"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
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
