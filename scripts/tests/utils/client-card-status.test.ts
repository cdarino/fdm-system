import { describe, it, expect } from "vitest";
import { clientCardStatus } from "@/lib/utils/client-card-status";
import { getClientRequirements } from "@/lib/utils/client-requirements";
import type { ClientProfileRequirementsInput } from "@/lib/utils/client-requirements";

const completeSingleClient: ClientProfileRequirementsInput = {
  full_name: "Sample Buyer",
  address: "Poblacion, Babak, IGACOS",
  tin_number: "123-456-789",
  civil_status: "Single",
  spouse_name: null,
  gender: "Male",
  contact_info: [{ value: "09171234567" }],
};

describe("clientCardStatus", () => {
  it("does not flag a complete single client with civil status and gender present", () => {
    const { missingProfile } = getClientRequirements(completeSingleClient, []);
    const result = clientCardStatus({
      status: "Active",
      missingProfile,
      missingDocuments: [],
      latestActivity: {
        description: "Verified contact details",
        time: "2026-11-18T10:00:00.000Z",
        performer_name: "Staff Member",
      },
    });

    expect(result.tone).toBe("muted");
    expect(result.label).toBe("Verified contact details");
  });

  it("does not flag a complete married client with spouse name and gender present", () => {
    const { missingProfile } = getClientRequirements(
      {
        ...completeSingleClient,
        civil_status: "Married",
        spouse_name: "Sample Spouse",
        gender: "Female",
      },
      []
    );
    const result = clientCardStatus({
      status: "Active",
      missingProfile,
      missingDocuments: [],
      latestActivity: null,
    });

    expect(result).toEqual({
      label: "No activity logged",
      tone: "muted",
    });
  });

  it("flags only Spouse name when married without a spouse name", () => {
    const { missingProfile } = getClientRequirements(
      {
        ...completeSingleClient,
        civil_status: "Married",
        spouse_name: null,
      },
      []
    );
    const result = clientCardStatus({
      status: "Active",
      missingProfile,
      missingDocuments: [],
      latestActivity: null,
    });

    expect(result).toEqual({
      label: "Needs attention",
      tone: "warning",
      detail: "Missing Spouse name",
    });
  });

  it("flags Civil status and Gender when those fields are absent", () => {
    const { missingProfile } = getClientRequirements(
      {
        ...completeSingleClient,
        civil_status: null,
        gender: null,
      },
      []
    );
    const result = clientCardStatus({
      status: "Active",
      missingProfile,
      missingDocuments: ["Valid ID"],
      latestActivity: null,
    });

    expect(result).toEqual({
      label: "Needs attention",
      tone: "warning",
      detail: "Missing Civil status, Gender · Valid ID",
    });
  });

  it("prioritizes non-active lifecycle status over missing requirements", () => {
    const { missingProfile } = getClientRequirements(
      {
        ...completeSingleClient,
        civil_status: null,
        gender: null,
      },
      []
    );
    const result = clientCardStatus({
      status: "Archived",
      missingProfile,
      missingDocuments: ["Valid ID"],
      latestActivity: null,
    });

    expect(result).toEqual({
      label: "Archived",
      tone: "muted",
    });
  });
});
