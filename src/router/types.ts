// Main App Route Types
export type MainAppStackParamList = {
	HouseManagment: undefined;
	CareManagment: undefined;
	DayDetails: { date: string };
	EditCaregiver: { caregiverId: string };
	PaymentDetails: { payment: any };
	AlertModal: import('@/screens/AlertModal').AlertModalParams;
	UserProfile: undefined;
	CreateHouse: undefined;
	EditHouse: { house: any };
	DeleteAccount: undefined;
	PrivacyPolicy: undefined;
	About: undefined;
};

// House Management Tabs Types
export type HouseManagementTabsParamList = {
	HouseSelection: undefined;
	HouseInvite: undefined;
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
