import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MainAppStackParamList } from "@/router/types";
import { useHouse } from "@/context/HouseContext";

type MainAppNavigationProp = NativeStackNavigationProp<MainAppStackParamList>;

export function useAppNavigation() {
  const navigation = useNavigation<MainAppNavigationProp>();
  const { clearCurrentHouseSelection } = useHouse();

  const navigateToHouseManagement = () => {
    clearCurrentHouseSelection();
    navigation.reset({ index: 0, routes: [{ name: "HouseManagement" }] });
  };

  const navigateToCareManagement = () => {
    navigation.reset({
      index: 1,
      routes: [{ name: "HouseManagement" }, { name: "CareManagement" }],
    });
  };

  return {
    navigateToHouseManagement,
    navigateToCareManagement,
    navigation,
  };
}
