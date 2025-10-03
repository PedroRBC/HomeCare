import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HouseSelectionScreen, CreateHouseScreen } from '@/screens/house';
import { HouseInviteScreen } from '@/screens/house/HouseInviteScreen';
import { HouseInvitationsScreen } from '@/screens/house/HouseInvitationsScreen';

export type HouseStackParamList = {
	HouseSelection: undefined;
	CreateHouse: undefined;
	HouseInvite: undefined;
	HouseInvitations: undefined;
};

const HouseStack = createNativeStackNavigator<HouseStackParamList>();

export function HouseRoutes() {
	return (
		<HouseStack.Navigator
			screenOptions={{
				headerShown: false,
				animation: 'slide_from_right',
			}}
			initialRouteName="HouseSelection"
		>
			<HouseStack.Screen name="HouseSelection" component={HouseSelectionScreen} />
			<HouseStack.Screen name="CreateHouse" component={CreateHouseScreen} />
			<HouseStack.Screen name="HouseInvite" component={HouseInviteScreen} />
			<HouseStack.Screen name="HouseInvitations" component={HouseInvitationsScreen} />
		</HouseStack.Navigator>
	);
}
