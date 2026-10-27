import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// shortcut: saved on this device only, move to Firestore if it must follow the account
const keyFor = (uid: string) => `@homecare:houseColors.${uid}`;

export function useChosenHouseColors(uid: string | undefined) {
  const [chosen, setChosen] = useState<Record<string, string>>({});

  useEffect(() => {
    setChosen({});
    if (!uid) return;
    let active = true;
    AsyncStorage.getItem(keyFor(uid))
      .then((stored) => {
        if (active && stored) setChosen(JSON.parse(stored));
      })
      .catch((error) => console.error("Error loading house colors:", error));
    return () => {
      active = false;
    };
  }, [uid]);

  const choose = useCallback(
    (houseId: string, color: string) => {
      const next = { ...chosen, [houseId]: color };
      setChosen(next);
      if (uid) {
        AsyncStorage.setItem(keyFor(uid), JSON.stringify(next)).catch((error) =>
          console.error("Error saving house colors:", error),
        );
      }
    },
    [chosen, uid],
  );

  return [chosen, choose] as const;
}
