// The part of Bun's test API used for native modules and deterministic clocks in tests
declare module "bun:test" {
  export function setSystemTime(now?: Date | number): void;
  export const mock: {
    module(specifier: string, factory: () => Record<string, unknown>): void;
  };
}
