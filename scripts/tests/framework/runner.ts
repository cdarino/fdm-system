import assert from "node:assert";

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: Error;
}

export interface SuiteStats {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResult[];
}

interface TestItem {
  name: string;
  fn: () => Promise<void> | void;
}

export class Suite {
  tests: TestItem[] = [];
  beforeAllFns: Array<() => Promise<void> | void> = [];
  afterAllFns: Array<() => Promise<void> | void> = [];
  beforeEachFns: Array<() => Promise<void> | void> = [];
  afterEachFns: Array<() => Promise<void> | void> = [];

  constructor(public name: string) {}
}

const registeredSuites: Suite[] = [];
let currentSuite: Suite | null = null;

export function describe(title: string, fn: () => void): Suite {
  const suite = new Suite(title);
  const prevSuite = currentSuite;
  currentSuite = suite;
  registeredSuites.push(suite);
  try {
    fn();
  } finally {
    currentSuite = prevSuite;
  }
  return suite;
}

export function it(title: string, fn: () => Promise<void> | void) {
  if (!currentSuite) {
    throw new Error('"it" must be called inside a "describe" block');
  }
  currentSuite.tests.push({ name: title, fn });
}

export const test = it;

export function beforeAll(fn: () => Promise<void> | void) {
  if (!currentSuite) throw new Error('"beforeAll" must be called inside a "describe" block');
  currentSuite.beforeAllFns.push(fn);
}

export function afterAll(fn: () => Promise<void> | void) {
  if (!currentSuite) throw new Error('"afterAll" must be called inside a "describe" block');
  currentSuite.afterAllFns.push(fn);
}

export function beforeEach(fn: () => Promise<void> | void) {
  if (!currentSuite) throw new Error('"beforeEach" must be called inside a "describe" block');
  currentSuite.beforeEachFns.push(fn);
}

export function afterEach(fn: () => Promise<void> | void) {
  if (!currentSuite) throw new Error('"afterEach" must be called inside a "describe" block');
  currentSuite.afterEachFns.push(fn);
}

export class Expectation<T> {
  private isNot = false;

  constructor(private actual: T) {}

  get not(): Expectation<T> {
    this.isNot = !this.isNot;
    return this;
  }

  toBe(expected: unknown) {
    const pass = Object.is(this.actual, expected);
    if (this.isNot ? pass : !pass) {
      assert.fail(`Expected ${JSON.stringify(this.actual)} ${this.isNot ? "not to be" : "to be"} ${JSON.stringify(expected)}`);
    }
  }

  toEqual(expected: unknown) {
    try {
      assert.deepStrictEqual(this.actual, expected);
      if (this.isNot) assert.fail("Expected values deeply not to match");
    } catch (err) {
      if (!this.isNot) throw err;
    }
  }

  toBeTruthy() {
    const pass = Boolean(this.actual);
    if (this.isNot ? pass : !pass) {
      assert.fail(`Expected ${JSON.stringify(this.actual)} ${this.isNot ? "to be falsy" : "to be truthy"}`);
    }
  }

  toBeFalsy() {
    const pass = !this.actual;
    if (this.isNot ? pass : !pass) {
      assert.fail(`Expected ${JSON.stringify(this.actual)} ${this.isNot ? "to be truthy" : "to be falsy"}`);
    }
  }

  toBeNull() {
    this.toBe(null);
  }

  toBeDefined() {
    const pass = typeof this.actual !== "undefined";
    if (this.isNot ? pass : !pass) {
      assert.fail(`Expected value ${this.isNot ? "to be undefined" : "to be defined"}`);
    }
  }

  toBeUndefined() {
    this.toBe(undefined);
  }

  toBeGreaterThan(expected: number) {
    const pass = (this.actual as unknown as number) > expected;
    if (this.isNot ? pass : !pass) {
      assert.fail(`Expected ${this.actual} ${this.isNot ? "not to be" : "to be"} greater than ${expected}`);
    }
  }

  toBeGreaterThanOrEqual(expected: number) {
    const pass = (this.actual as unknown as number) >= expected;
    if (this.isNot ? pass : !pass) {
      assert.fail(`Expected ${this.actual} ${this.isNot ? "not to be" : "to be"} greater than or equal to ${expected}`);
    }
  }

  toBeLessThan(expected: number) {
    const pass = (this.actual as unknown as number) < expected;
    if (this.isNot ? pass : !pass) {
      assert.fail(`Expected ${this.actual} ${this.isNot ? "not to be" : "to be"} less than ${expected}`);
    }
  }

  toBeLessThanOrEqual(expected: number) {
    const pass = (this.actual as unknown as number) <= expected;
    if (this.isNot ? pass : !pass) {
      assert.fail(`Expected ${this.actual} ${this.isNot ? "not to be" : "to be"} less than or equal to ${expected}`);
    }
  }

  toContain(item: unknown) {
    let pass = false;
    if (typeof this.actual === "string" && typeof item === "string") {
      pass = this.actual.includes(item);
    } else if (Array.isArray(this.actual)) {
      pass = this.actual.includes(item);
    }
    if (this.isNot ? pass : !pass) {
      assert.fail(`Expected collection ${this.isNot ? "not to contain" : "to contain"} ${JSON.stringify(item)}`);
    }
  }

  toThrow(expectedMessage?: string | RegExp) {
    if (typeof this.actual !== "function") {
      assert.fail("Expected a function to be provided to expect().toThrow()");
    }
    let threw = false;
    let errorCaught: unknown;
    try {
      (this.actual as unknown as () => unknown)();
    } catch (err) {
      threw = true;
      errorCaught = err;
    }
    if (!threw && !this.isNot) {
      assert.fail("Expected function to throw an error, but it did not.");
    }
    if (threw && this.isNot) {
      assert.fail(`Expected function not to throw, but it threw: ${errorCaught}`);
    }
    if (threw && expectedMessage && errorCaught instanceof Error) {
      if (typeof expectedMessage === "string") {
        assert.ok(
          errorCaught.message.includes(expectedMessage),
          `Expected message "${errorCaught.message}" to include "${expectedMessage}"`
        );
      } else {
        assert.ok(expectedMessage.test(errorCaught.message), "Expected message to match regex");
      }
    }
  }

  get rejects() {
    return {
      toThrow: async (expectedMessage?: string | RegExp) => {
        let threw = false;
        let errorCaught: unknown;
        try {
          await (this.actual as unknown as Promise<unknown>);
        } catch (err) {
          threw = true;
          errorCaught = err;
        }
        if (!threw && !this.isNot) {
          assert.fail("Expected async operation to reject, but it resolved.");
        }
        if (threw && this.isNot) {
          assert.fail(`Expected async operation not to reject, but it rejected: ${errorCaught}`);
        }
        if (threw && expectedMessage && errorCaught instanceof Error) {
          if (typeof expectedMessage === "string") {
            assert.ok(
              errorCaught.message.includes(expectedMessage),
              `Expected error message "${errorCaught.message}" to include "${expectedMessage}"`
            );
          } else {
            assert.ok(expectedMessage.test(errorCaught.message), "Expected error message to match regex");
          }
        }
      },
    };
  }
}

export function expect<T>(actual: T): Expectation<T> {
  return new Expectation(actual);
}

export async function runSuite(target?: Suite | string): Promise<SuiteStats> {
  let suite: Suite | undefined;
  if (target instanceof Suite) {
    suite = target;
  } else if (typeof target === "string") {
    suite = registeredSuites.find((s) => s.name === target);
  } else {
    suite = registeredSuites[registeredSuites.length - 1];
  }
  if (!suite) {
    throw new Error("No suite to run");
  }

  const results: TestResult[] = [];
  const startAll = Date.now();

  console.log(`\n📂 ${suite.name}`);

  for (const hook of suite.beforeAllFns) {
    await hook();
  }

  for (const t of suite.tests) {
    const tStart = Date.now();
    try {
      for (const hook of suite.beforeEachFns) {
        await hook();
      }

      await t.fn();

      for (const hook of suite.afterEachFns) {
        await hook();
      }

      const durationMs = Date.now() - tStart;
      results.push({ suite: suite.name, name: t.name, passed: true, durationMs });
      console.log(`  ✅  ${t.name} (${durationMs}ms)`);
    } catch (err) {
      for (const hook of suite.afterEachFns) {
        try {
          await hook();
        } catch {
          // Ignore secondary cleanup error
        }
      }
      const durationMs = Date.now() - tStart;
      const error = err instanceof Error ? err : new Error(String(err));
      results.push({ suite: suite.name, name: t.name, passed: false, durationMs, error });
      console.error(`  ❌  ${t.name} (${durationMs}ms)\n      ${error.message}`);
    }
  }

  for (const hook of suite.afterAllFns) {
    try {
      await hook();
    } catch (err) {
      console.warn(`Error in afterAll for ${suite.name}:`, err);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const durationMs = Date.now() - startAll;

  return { suiteName: suite.name, total, passed, failed, durationMs, results };
}

