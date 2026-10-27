import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// shortcut: saved on this device only, move to Firestore if it must follow the account
const keyFor = (uid: string) => `@homecare:houseColors.${uid}`;

export function useChosenHouseColors(uid: string | undefined) {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  // Saving waits for this account's stored colors, so an early edit never drops them
  const [loadedUid, setLoadedUid] = useState<string>();

  useEffect(() => {
    setChosen({});
    setLoadedUid(undefined);
    if (!uid) return;
    let active = true;
    AsyncStorage.getItem(keyFor(uid))
      .then((stored) => {
        if (!active) return;
        // Edits made while reading win over the stored colors
        if (stored) setChosen((prev) => ({ ...JSON.parse(stored), ...prev }));
        setLoadedUid(uid);
      })
      .catch((error) => {
        console.error("Error loading house colors:", error);
        // Unreadable or corrupt colors must not block saving new ones for good
        if (active) setLoadedUid(uid);
      });
    return () => {
      active = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || loadedUid !== uid) return;
    AsyncStorage.setItem(keyFor(uid), JSON.stringify(chosen)).catch((error) =>
      console.error("Error saving house colors:", error),
    );
  }, [chosen, loadedUid, uid]);

  const choose = useCallback(
    (houseId: string, color: string) => setChosen((prev) => ({ ...prev, [houseId]: color })),
    [],
  );

  return [chosen, choose] as const;
}
