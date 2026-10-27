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

export { palettes, THEME_NAMES, themeLabels } from "./palette";
export type { ThemeColors, ThemeName, ThemeScheme } from "./palette";
export type { ThemePreference } from "./preference";

const ThemeContext = createContext<ReturnType<typeof createThemeStore> | null>(null);

export const AppThemeProvider = ({ children }: PropsWithChildren) => {
  const [store] = useState(() => createThemeStore(AsyncStorage, Appearance.getColorScheme()));
  const { scheme, theme } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const colors = palettes[theme][scheme];
  const variables = useMemo(() => themeVariables(colors), [colors]);

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
    root.style.backgroundColor = colors.background;
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
  }, [colors, scheme, variables]);

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
  const { preference, scheme, theme } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return {
    colors: palettes[theme][scheme],
    scheme,
    preference,
    setPreference: store.setPreference,
    theme,
    setTheme: store.setTheme,
  };
};

export const useThemeLoaded = () => {
  const store = useThemeStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot).loaded;
};
