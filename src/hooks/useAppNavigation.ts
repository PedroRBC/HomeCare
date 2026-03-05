import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainAppStackParamList } from '@/router/types';
import { useHouse } from '@/context/HouseContext';

type MainAppNavigationProp = NativeStackNavigationProp<MainAppStackParamList>;

export function useAppNavigation() {
	const navigation = useNavigation<MainAppNavigationProp>();
	const { clearCurrentHouseSelection } = useHouse();

	const navigateToHouseManagement = () => {
		clearCurrentHouseSelection();
		navigation.navigate('HouseManagement');
	};

	const navigateToCareManagement = () => {
		navigation.navigate('CareManagement');
	};

	return {
		navigateToHouseManagement,
		navigateToCareManagement,
		navigation,
	};
}
