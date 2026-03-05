/**
 * Logger utility that only outputs in development mode.
 * Use instead of console.log for debug messages.
 * console.error should still be used directly for real errors.
 */
export const logger = {
  log: (...args: any[]) => {
    if (__DEV__) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (__DEV__) {
      console.warn(...args);
    }
  },
};
