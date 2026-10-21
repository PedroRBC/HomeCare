import { useEffect, useRef } from "react";
import { useHouse } from "@/context/HouseContext";
import { useAppNavigation } from "@/hooks/useAppNavigation";

export function AppNavigationListener() {
  const { currentHouse } = useHouse();
  const { navigateToCareManagement, navigateToHouseManagement } = useAppNavigation();
  const houseId = currentHouse?.id;
  const previousHouseRef = useRef(houseId);

  useEffect(() => {
    // Only navigate if the house selection actually changed
    if (houseId !== previousHouseRef.current) {
      if (houseId) {
        navigateToCareManagement();
      } else {
        navigateToHouseManagement();
      }

      previousHouseRef.current = houseId;
    }
  }, [houseId, navigateToCareManagement, navigateToHouseManagement]);

  return null; // This component doesn't render anything
}
