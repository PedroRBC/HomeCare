import type { PaymentHistory } from "@/context/ScheduleContext";
import type { NavigatorScreenParams } from "@react-navigation/native";
import type { House } from "@/types/house.types";

// Main App Route Types
export type MainAppStackParamList = {
  HouseManagement: NavigatorScreenParams<HouseManagementTabsParamList> | undefined;
  CareManagement: undefined;
  DayDetails: { date: string };
  EditCaregiver: { caregiverId: string };
  PaymentDetails: { payment: PaymentHistory };
  AlertModal: import("@/screens/AlertModal").AlertModalParams;
  UserProfile: undefined;
  AccountManagement: undefined;
  CreateHouse: undefined;
  EditHouse: { house: House };
  DeleteAccount: undefined;
  PrivacyCenter: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  About: undefined;
};

// House Management Tabs Types
export type HouseManagementTabsParamList = {
  HouseSelection: undefined;
  HouseInvite: undefined;
  MyShifts: undefined;
  Settings: undefined;
};

// Care Management Tabs Types
export type CareManagementTabsParamList = {
  DayCalendar: undefined;
  Caregivers: undefined;
  Payments: undefined;
  History: undefined;
  Create: undefined;
};

// Auth Routes Types
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  AlertModal: undefined;
};
