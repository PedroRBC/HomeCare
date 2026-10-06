// The part of Bun's test API used to replace native modules in tests
declare module "bun:test" {
  export const mock: {
    module(specifier: string, factory: () => Record<string, unknown>): void;
  };
}
