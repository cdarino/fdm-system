import { faker } from "@faker-js/faker";

/**
 * A unique, letters-only suffix for test names. Client and user names reject
 * digits, so `Date.now()` cannot be appended to them directly.
 */
export function uniqueNameSuffix(): string {
  return Date.now()
    .toString()
    .replace(/\d/g, (digit) => "abcdefghij"[Number(digit)]);
}

/** A Philippine mobile number in the format the contact rules accept. */
export function fakePhMobile(): string {
  return `09${faker.string.numeric(9)}`;
}
