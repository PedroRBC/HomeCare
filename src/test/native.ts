import { mock } from "bun:test";

export type Element = { type: unknown; props: Record<string, any> };
let active: ReturnType<typeof createRenderer>;

const element = (type: unknown, props: Record<string, any> | null, ...children: unknown[]) => ({
  type,
  props: {
    ...props,
    ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}),
  },
});

export function createRenderer() {
  const slots: any[] = [];
  let cursor = 0;
  let pending: (() => void)[] = [];
  const runtime = {
    render<T>(render: () => T): T {
      active = runtime;
      cursor = 0;
      const result = render();
      const effects = pending;
      pending = [];
      effects.forEach((effect) => effect());
      return result;
    },
    state(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (next: any) => {
          slots[index] = typeof next === "function" ? next(slots[index]) : next;
        },
      ];
    },
    ref(initial: unknown) {
      const index = cursor++;
      return slots[index] ?? (slots[index] = { current: initial });
    },
    effect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = cursor++;
      const prior = slots[index];
      if (!prior || !deps || deps.some((dep, i) => !Object.is(dep, prior.deps[i]))) {
        slots[index] = { deps, cleanup: prior?.cleanup };
        pending.push(() => {
          slots[index].cleanup?.();
          slots[index].cleanup = effect();
        });
      }
    },
    unmount() {
      slots.forEach((slot) => slot?.cleanup?.());
    },
  };
  return runtime;
}

export function installNativeRuntime() {
  const react = {
    createElement: element,
    createContext: () => ({ Provider: "Provider" }),
    useContext: () => undefined,
    useState: (initial: unknown) => active.state(initial),
    useRef: (initial: unknown) => active.ref(initial),
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => active.effect(effect, deps),
    useMemo: (factory: () => unknown) => factory(),
    useCallback: (callback: unknown) => callback,
  };
  mock.module("react", () => ({ ...react, default: react }));
  const jsx = (type: unknown, props: Record<string, any>) => element(type, props);
  mock.module("react/jsx-runtime", () => ({ jsx, jsxs: jsx, Fragment: "Fragment" }));
  mock.module("react/jsx-dev-runtime", () => ({ jsxDEV: jsx, Fragment: "Fragment" }));
  mock.module("react-native", () => ({
    View: "View",
    Text: "Text",
    Image: "Image",
    Pressable: "Pressable",
    TouchableOpacity: "Pressable",
    ScrollView: "ScrollView",
    TextInput: "TextInput",
    ActivityIndicator: "ActivityIndicator",
    RefreshControl: "RefreshControl",
    KeyboardAvoidingView: "KeyboardAvoidingView",
    Modal: "Modal",
    Animated: { View: "AnimatedView" },
    Platform: { OS: "android" },
    StyleSheet: { create: (styles: unknown) => styles },
    Linking: {
      openURL: async () => {},
      getInitialURL: async () => null,
      addEventListener: () => ({ remove: () => {} }),
    },
  }));
  mock.module("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
  mock.module("@/theme", () => ({ useAppTheme: () => ({ colors: {}, scheme: "light" }) }));
  mock.module("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
  }));
  mock.module("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
  }));
  mock.module("@/hooks/useFirebase", () => ({ useScreenTracking: () => {} }));
  mock.module("@react-navigation/native", () => ({
    useNavigation: () => ({ navigate: () => {} }),
  }));
}

export function nodes(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const node = tree as Element;
  return [node, ...nodes(node.props.children)];
}

export function text(tree: unknown): string {
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return "";
  return text((tree as Element).props.children);
}
