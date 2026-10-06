/**
 * Runs async tasks one at a time, in the order they were queued. A failed task
 * doesn't stop the ones after it; its caller still gets the error.
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };
}
