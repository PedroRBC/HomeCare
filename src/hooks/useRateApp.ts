import { useEffect, useState } from "react";
import * as StoreReview from "expo-store-review";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@homecare:rate_app_count";
const MIN_ACTIONS_TO_PROMPT = 10;

export function useRateApp() {
  const [hasPrompted, setHasPrompted] = useState(false);
  const [actionCount, setActionCount] = useState(0);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    checkAvailability();
    loadActionCount();
  }, []);

  const checkAvailability = async () => {
    const available = await StoreReview.isAvailableAsync();
    setIsAvailable(available);
  };

  const loadActionCount = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      setActionCount(stored ? parseInt(stored, 10) : 0);
    } catch (error) {
      console.error("Error loading action count:", error);
    }
  };

  const incrementActionCount = async () => {
    if (hasPrompted || !isAvailable) return;

    const newCount = actionCount + 1;
    setActionCount(newCount);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, newCount.toString());

      if (newCount >= MIN_ACTIONS_TO_PROMPT) {
        await requestReview();
      }
    } catch (error) {
      console.error("Error saving action count:", error);
    }
  };

  const requestReview = async () => {
    if (!isAvailable || hasPrompted) return;

    try {
      await StoreReview.requestReview();
      setHasPrompted(true);

      // Reset count after prompting
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Error requesting review:", error);
    }
  };

  const forceRequestReview = async () => {
    if (!isAvailable) return false;

    try {
      await requestReview();
      return true;
    } catch (error) {
      console.error("Error forcing review:", error);
      return false;
    }
  };

  return {
    incrementActionCount,
    requestReview,
    forceRequestReview,
    isAvailable,
    hasPrompted,
  };
}
