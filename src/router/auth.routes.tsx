import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen, RegisterScreen } from '@/screens/auth';

export type AuthStackParamList = {
	Login: undefined;
	Register: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export function AuthRoutes() {
	return (
		<AuthStack.Navigator
			screenOptions={{
				headerShown: false,
				animation: 'slide_from_right',
			}}
			initialRouteName="Login"
		>
			<AuthStack.Screen name="Login" component={LoginScreen} />
			<AuthStack.Screen name="Register" component={RegisterScreen} />
		</AuthStack.Navigator>
	);
}
