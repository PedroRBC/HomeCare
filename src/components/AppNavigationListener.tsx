import { useEffect, useRef } from "react";
import { useHouse } from "@/context/HouseContext";
import { useAppNavigation } from "@/hooks/useAppNavigation";

export function AppNavigationListener() {
  const { currentHouse } = useHouse();
  const { navigateToCareManagement, navigateToHouseManagement } = useAppNavigation();
  const previousHouseRef = useRef(currentHouse);

  useEffect(() => {
    // Only navigate if the house selection actually changed
    if (currentHouse !== previousHouseRef.current) {
      if (currentHouse) {
        navigateToCareManagement();
      } else {
        navigateToHouseManagement();
      }

      previousHouseRef.current = currentHouse;
    }
  }, [currentHouse, navigateToCareManagement, navigateToHouseManagement]);

  return null; // This component doesn't render anything
}
