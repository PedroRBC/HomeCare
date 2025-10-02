import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { HomeScreen } from "@/screens/home";
import { CreateScreen } from "@/screens/create";
import { HistoryScreen } from "@/screens/history";
import { SettingsScreen } from "@/screens/settings";
import { DayDetailsScreen } from "@/screens/day-details";
import { CaregiversScreen } from "@/screens/caregivers";
import { EditCaregiverScreen } from "@/screens/edit-caregiver";
import { PaymentDetailsScreen } from "@/screens/payment-details";

export type AppTabsParamList = {
  Início: undefined;
  Cuidadores: undefined;
  Adicionar: undefined;
  Histórico: undefined;
  Configurações: undefined;
};

const Tabs = createBottomTabNavigator<AppTabsParamList>();
type RootStackParamList = {
  Tabs: undefined;
  DayDetails: { date: string };
  Caregivers: undefined;
  EditCaregiver: { caregiverId: string };
  PaymentDetails: { payment: any };
};
const RootStack = createNativeStackNavigator<RootStackParamList>();

function TabsNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        animation: "fade",
        tabBarStyle: {
          backgroundColor: "#18181b",
          borderTopColor: "#27272a",
          paddingBottom: 16,
        },
        tabBarActiveTintColor: "#059669", // emerald-600
        tabBarInactiveTintColor: "#a1a1aa",
      }}
      initialRouteName="Início">
      <Tabs.Screen
        name="Início"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Cuidadores"
        component={CaregiversScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Adicionar"
        component={CreateScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Histórico"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Configurações"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
}

export function AppRoutes() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Tabs" component={TabsNavigator} />
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
    </RootStack.Navigator>
  );
}
