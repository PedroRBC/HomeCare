import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";

const nativeAlerts: unknown[][] = [];
mock.module("react-native", () => ({
  Alert: { alert: (...args: unknown[]) => nativeAlerts.push(args) },
}));
const react = {
  createContext: () => ({ Provider: "provider" }),
  useContext: () => undefined,
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
  createElement: (_type: unknown, props: unknown) => ({ props }),
};
mock.module("react", () => ({ ...react, default: react }));
mock.module("react/jsx-dev-runtime", () => ({ jsxDEV: react.createElement }));
mock.module("react/jsx-runtime", () => ({ jsx: react.createElement, jsxs: react.createElement }));
const { AlertProvider } = await import("./AlertContext");

const provider = () =>
  (
    AlertProvider({ children: null }) as unknown as {
      props: {
        value: {
          setNavigationRef: (ref: unknown) => void;
          showAlert: (alertParams: typeof params) => void;
        };
      };
    }
  ).props.value;

const onPress = () => {};
const onDismiss = () => {};
const params = {
  title: "Erro",
  message: "Este email já está registrado com outro método.",
  buttons: [{ text: "OK", onPress }],
  onDismiss,
};

test("a social login error uses native Alert when loading has unmounted navigation", () => {
  nativeAlerts.length = 0;
  const context = provider();
  let ready = true;
  const navigations: unknown[][] = [];
  context.setNavigationRef({
    isReady: () => ready,
    navigate: (...args: unknown[]) => navigations.push(args),
  });
  context.showAlert(params);
  assert.deepEqual(navigations, [["AlertModal", params]]);

  ready = false;
  context.showAlert(params);
  assert.equal(navigations.length, 1);
  assert.deepEqual(nativeAlerts, [
    [
      params.title,
      params.message,
      [{ text: "OK", style: "default", onPress }],
      {
        cancelable: true,
        onDismiss,
      },
    ],
  ]);
});

test("an async error still appears after its navigation reference is cleared", () => {
  nativeAlerts.length = 0;
  const context = provider();
  context.setNavigationRef(null);
  context.showAlert(params);
  assert.equal(nativeAlerts.length, 1);
  assert.equal(nativeAlerts[0][1], params.message);
});
