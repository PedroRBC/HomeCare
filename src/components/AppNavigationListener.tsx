import { useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import { useHouse } from "@/context/HouseContext";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import { parseWidgetLink } from "@/widgets/widgetData";

// The launch URL stays readable for the whole process; open it once, not after every re-login.
let initialLinkHandled = false;

export function AppNavigationListener() {
  const { currentHouse } = useHouse();
  const { navigateToCareManagement, navigateToHouseManagement, navigation } = useAppNavigation();
  const houseId = currentHouse?.id;
  const previousHouseRef = useRef(houseId);
  const [link, setLink] = useState<string | null>(null);

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

  useEffect(() => {
    if (!initialLinkHandled) {
      initialLinkHandled = true;
      void Linking.getInitialURL().then((url) => url && setLink(url));
    }
    const subscription = Linking.addEventListener("url", ({ url }) => setLink(url));
    return () => subscription.remove();
  }, []);

  // Widget links target the selected house, so wait until one is selected.
  useEffect(() => {
    if (!link || !houseId) return;
    setLink(null);
    const target = parseWidgetLink(link);
    if (!target) return;
    navigation.reset({
      index: target.screen === "day" ? 2 : 1,
      routes:
        target.screen === "day"
          ? [
              { name: "HouseManagement" },
              { name: "CareManagement" },
              { name: "DayDetails", params: { date: target.date } },
            ]
          : [
              { name: "HouseManagement" },
              { name: "CareManagement", params: { screen: "Payments" } },
            ],
    });
  }, [link, houseId, navigation]);

  return null; // This component doesn't render anything
}
