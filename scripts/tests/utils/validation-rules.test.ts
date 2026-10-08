import { describe, it, expect } from "vitest";
import {
  clientSchema,
  contactInfoInputSchema,
  getContactValueError,
  personNameSchema,
} from "@/lib/validations/client";
import { createUserSchema } from "@/lib/validations/user";
import { createPropertyLotSchema, LOT_LIMITS } from "@/lib/validations/property";

describe("Person names", () => {
  const name = personNameSchema("Full name");

  it.each(["Juan dela Cruz", "Ma. Teresa Santos-Reyes", "John O'Neil", "Peña, Jose Jr.", "Ñino Ibañez"])(
    "accepts %s",
    (value) => {
      expect(name.safeParse(value).success).toBe(true);
    }
  );

  it.each(["Juan 2", "R2D2", "Juan@Cruz", "#Maria", "Ana_Lim", "-Juan", "  "])("rejects %s", (value) => {
    expect(name.safeParse(value).success).toBe(false);
  });

  it("applies to client records and user accounts", () => {
    expect(clientSchema.safeParse({ full_name: "Client 123" }).success).toBe(false);
    expect(
      createUserSchema.safeParse({
        firstName: "Ana1",
        lastName: "Lim",
        email: "ana@example.com",
        password: "secret123",
      }).success
    ).toBe(false);
  });
});

describe("Contact values", () => {
  it.each([
    ["Mobile", "09171234567"],
    ["Mobile", "0917 123 4567"],
    ["Mobile", "+63 917 123 4567"],
    ["Mobile", "+1 415 555 0100"],
    ["Phone", "(082) 221-1234"],
    ["Phone", "02 8123 4567"],
    ["Phone", "0917-123-4567"],
    ["Email", "client@example.com"],
    ["Other", "fb.com/juan.delacruz"],
  ])("accepts %s %s", (type, value) => {
    expect(getContactValueError(type, value)).toBeNull();
  });

  it.each([
    ["Mobile", "0917123456"],
    ["Mobile", "08171234567"],
    ["Mobile", "abc"],
    ["Mobile", "0917-123-456a"],
    ["Phone", "221-1234"],
    ["Phone", "call me"],
    ["Phone", "+63#9171234567"],
    ["Email", "client@"],
    ["Email", "client.example.com"],
    ["Email", "client @example.com"],
  ])("rejects %s %s", (type, value) => {
    expect(getContactValueError(type, value)).not.toBeNull();
  });

  it("reports the error on the value field", () => {
    const result = contactInfoInputSchema.safeParse({ type: "Email", value: "not-an-email" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["value"]);
  });

  it("rejects unknown contact types", () => {
    expect(contactInfoInputSchema.safeParse({ type: "Fax", value: "123" }).success).toBe(false);
  });
});

describe("Property lot bounds", () => {
  const valid = { block_number: 3, lot_number: 12, area_size: 250.5, price_per_sqm: 3500 };

  it("accepts a normal lot", () => {
    expect(createPropertyLotSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["block_number", LOT_LIMITS.blockOrLotNumber + 1],
    ["lot_number", 123456789012345],
    ["area_size", LOT_LIMITS.areaSqm + 1],
    ["price_per_sqm", 88888888888888],
    ["area_size", 250.555],
  ])("rejects %s = %s", (field, value) => {
    expect(createPropertyLotSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });
});
