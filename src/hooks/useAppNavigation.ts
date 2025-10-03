import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainAppStackParamList } from '@/router/types';
import { useHouse } from '@/context/HouseContext';

type MainAppNavigationProp = StackNavigationProp<MainAppStackParamList>;

export function useAppNavigation() {
	const navigation = useNavigation<MainAppNavigationProp>();
	const { clearCurrentHouseSelection } = useHouse();

	const navigateToHouseManagement = () => {
		console.log('useAppNavigation: Navigating to HouseManagement');
		clearCurrentHouseSelection();
		navigation.navigate('HouseManagment');
	};

	const navigateToCareManagement = () => {
		console.log('useAppNavigation: Navigating to CareManagement');
		navigation.navigate('CareManagment');
	};

	return {
		navigateToHouseManagement,
		navigateToCareManagement,
		navigation,
	};
}
