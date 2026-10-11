import AsyncStorage from "@react-native-async-storage/async-storage";
import { VariableContextProvider } from "nativewind";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { PropsWithChildren } from "react";
import { Appearance, AppState, Platform } from "react-native";
import { createThemeStore } from "./preference";
import { palettes, themeVariables } from "./palette";

export type { ThemeColors, ThemeScheme } from "./palette";
export type { ThemePreference } from "./preference";

const ThemeContext = createContext<ReturnType<typeof createThemeStore> | null>(null);

export const AppThemeProvider = ({ children }: PropsWithChildren) => {
  const [store] = useState(() => createThemeStore(AsyncStorage, Appearance.getColorScheme()));
  const { scheme } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const variables = useMemo(() => themeVariables(palettes[scheme]), [scheme]);

  useEffect(() => {
    const appearance = Appearance.addChangeListener(({ colorScheme }) => {
      store.syncSystemScheme(colorScheme);
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") store.syncSystemScheme(Appearance.getColorScheme());
    });
    store.syncSystemScheme(Appearance.getColorScheme());
    void store.hydrate();
    return () => {
      appearance.remove();
      appState.remove();
    };
  }, [store]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    // Match the browser canvas/overscroll and native controls to the resolved app mode.
    const root = document.documentElement;
    const background = root.style.backgroundColor;
    const colorScheme = root.style.colorScheme;
    const previousVariables = Object.keys(variables).map((name) => [
      name,
      root.style.getPropertyValue(name),
    ]);
    root.style.backgroundColor = palettes[scheme].background;
    root.style.colorScheme = scheme;
    // Web Modal uses a DOM portal outside the provider's wrapper.
    Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, value));
    return () => {
      root.style.backgroundColor = background;
      root.style.colorScheme = colorScheme;
      previousVariables.forEach(([name, value]) => {
        if (value) root.style.setProperty(name, value);
        else root.style.removeProperty(name);
      });
    };
  }, [scheme, variables]);

  return (
    <ThemeContext.Provider value={store}>
      {/* Context follows React Native Modal children, even across native view roots. */}
      <VariableContextProvider value={variables}>{children}</VariableContextProvider>
    </ThemeContext.Provider>
  );
};

const useThemeStore = () => {
  const store = useContext(ThemeContext);
  if (!store) throw new Error("useAppTheme must be used inside AppThemeProvider");
  return store;
};

export const useAppTheme = () => {
  const store = useThemeStore();
  const { preference, scheme } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return { colors: palettes[scheme], scheme, preference, setPreference: store.setPreference };
};

export const useThemeLoaded = () => {
  const store = useThemeStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot).loaded;
};
