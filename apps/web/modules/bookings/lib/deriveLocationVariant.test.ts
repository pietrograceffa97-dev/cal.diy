import { describe, expect, it } from "vitest";
import { deriveLocationVariant } from "./deriveLocationVariant";

describe("deriveLocationVariant", () => {
  it("returns tbd for null, undefined, or empty location", () => {
    expect(deriveLocationVariant(null)).toEqual({ kind: "tbd" });
    expect(deriveLocationVariant(undefined)).toEqual({ kind: "tbd" });
    expect(deriveLocationVariant("")).toEqual({ kind: "tbd" });
    expect(deriveLocationVariant("   ")).toEqual({ kind: "tbd" });
  });

  it("returns video variant when location is an https URL", () => {
    expect(deriveLocationVariant("https://meet.daily.co/abc-123")).toEqual({
      kind: "video",
      url: "https://meet.daily.co/abc-123",
    });
  });

  it("returns video variant when location is an http URL", () => {
    expect(deriveLocationVariant("http://zoom.us/j/123456")).toEqual({
      kind: "video",
      url: "http://zoom.us/j/123456",
    });
  });

  it("returns video-pending when location is a conferencing integration type", () => {
    expect(deriveLocationVariant("integrations:daily")).toEqual({ kind: "video-pending" });
    expect(deriveLocationVariant("integrations:google:meet")).toEqual({ kind: "video-pending" });
    expect(deriveLocationVariant("integrations:office365_video")).toEqual({ kind: "video-pending" });
  });

  it("returns phone variant for a plain phone number value", () => {
    expect(deriveLocationVariant("+15551234567")).toEqual({
      kind: "phone",
      number: "+15551234567",
    });
    expect(deriveLocationVariant("+44 20 7946 0958")).toEqual({
      kind: "phone",
      number: "+44 20 7946 0958",
    });
  });

  it("returns tbd for phone-typed location without a concrete number", () => {
    // 'phone' type means 'ask attendee for their number' — but no number stored
    // at the booking level means we cannot surface a directional message.
    expect(deriveLocationVariant("phone")).toEqual({ kind: "tbd" });
  });

  it("returns tbd for somewhereElse location type", () => {
    expect(deriveLocationVariant("somewhereElse")).toEqual({ kind: "tbd" });
  });

  it("returns address variant for in-person location type with free-form text", () => {
    const result = deriveLocationVariant("Cal HQ\n123 Market Street, San Francisco, CA");
    expect(result).toEqual({
      kind: "address",
      venue: "Cal HQ",
      address: "123 Market Street, San Francisco, CA",
    });
  });

  it("address variant with single line uses null venue", () => {
    expect(deriveLocationVariant("221B Baker Street")).toEqual({
      kind: "address",
      venue: null,
      address: "221B Baker Street",
    });
  });

  it("address variant splits comma-separated single-line address", () => {
    const result = deriveLocationVariant("Cal HQ, 123 Market Street, San Francisco");
    expect(result.kind).toBe("address");
    if (result.kind === "address") {
      expect(result.venue).toBe("Cal HQ");
      expect(result.address).toContain("123 Market Street");
    }
  });
});
