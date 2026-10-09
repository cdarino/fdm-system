import { describe, it, expect } from "vitest";
import {
  documentsForLot,
  getMissingReleaseDocuments,
  getRequiredReleaseDocuments,
  isReleasePacketComplete,
} from "@/lib/utils/release-requirements";

describe("Release packet checklist", () => {
  it("needs the Deed of Sale only when the title is in FDM's name", () => {
    expect(getRequiredReleaseDocuments("fdm")).toContain("Deed of Sale");
    expect(getRequiredReleaseDocuments("client")).not.toContain("Deed of Sale");
    expect(getRequiredReleaseDocuments("client")).toHaveLength(5);
  });

  it("keeps the Deed of Sale when whose name is not recorded yet", () => {
    expect(getRequiredReleaseDocuments(null)).toContain("Deed of Sale");
  });

  it("never asks for an e-CAR", () => {
    expect(getRequiredReleaseDocuments("fdm")).not.toContain("eCAR");
  });

  it("lists missing items in checklist order", () => {
    expect(getMissingReleaseDocuments("fdm", ["Payment History", "Title Copy"])).toEqual([
      "SOA",
      "Certificate of Ownership",
      "Contract",
      "Deed of Sale",
    ]);
  });

  it("is complete once every required item is uploaded", () => {
    const clientPacket = ["SOA", "Payment History", "Certificate of Ownership", "Contract", "Title Copy"];
    expect(isReleasePacketComplete("client", clientPacket)).toBe(true);
    expect(isReleasePacketComplete("fdm", clientPacket)).toBe(false);
  });

  it("counts a client's documents for a lot when linked to it or to no lot", () => {
    const docs = [
      { id: "a", property_id: "lot-1" },
      { id: "b", property_id: "lot-2" },
      { id: "c", property_id: null },
      { id: "d" },
    ];
    expect(documentsForLot(docs, "lot-1").map((d) => d.id)).toEqual(["a", "c", "d"]);
  });
});
