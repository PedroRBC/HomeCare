import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen, RegisterScreen } from '@/screens/auth';
import { PrivacyPolicyScreen } from '@/screens/PrivacyPolicyScreen';
import { TermsOfServiceScreen } from '@/screens/TermsOfServiceScreen';
import { AuthStackParamList } from './types';

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
			<AuthStack.Screen
				name="PrivacyPolicy"
				component={PrivacyPolicyScreen}
				options={{ animation: "slide_from_right" }}
			/>
			<AuthStack.Screen
				name="TermsOfService"
				component={TermsOfServiceScreen}
				options={{ animation: "slide_from_right" }}
			/>
		</AuthStack.Navigator>
	);
}
