import { describe, expect, it } from "vitest";
import { getBrandingHostname, isCustomBranding } from "./branding";

describe("isCustomBranding", () => {
	it("keeps the default Elmo identity attributed", () => {
		expect(isCustomBranding()).toBe(false);
		expect(isCustomBranding({})).toBe(false);
		expect(isCustomBranding({ name: "Elmo" })).toBe(false);
		expect(isCustomBranding({ icon: "/icons/elmo-icon.svg" })).toBe(false);
		expect(
			isCustomBranding({
				name: "Elmo",
				icon: "/icons/elmo-icon.svg",
			}),
		).toBe(false);
	});

	it("recognizes every supported custom identity shape", () => {
		expect(isCustomBranding({ name: "TradeSites AEO" })).toBe(true);
		expect(isCustomBranding({ icon: "/brand/tradesites-aeo.png" })).toBe(true);
		expect(
			isCustomBranding({
				name: "TradeSites AEO",
				icon: "/brand/tradesites-aeo.png",
			}),
		).toBe(true);
	});
});

describe("getBrandingHostname", () => {
	it("retains Elmo attribution for default branding", () => {
		expect(getBrandingHostname({}, false)).toBe("elmohq.com");
	});

	it("prefers the parent brand hostname for custom branding", () => {
		expect(
			getBrandingHostname(
				{
					parentUrl: "https://www.tradesites.ai/path",
					url: "https://aeo.tradesites.ai",
				},
				true,
			),
		).toBe("www.tradesites.ai");
	});

	it("falls back to the application hostname", () => {
		expect(getBrandingHostname({ url: "https://aeo.tradesites.ai/" }, true)).toBe("aeo.tradesites.ai");
	});

	it("does not leak Elmo when custom URLs are missing or malformed", () => {
		expect(getBrandingHostname({}, true)).toBe("");
		expect(getBrandingHostname({ parentUrl: "not a url", url: "still not a url" }, true)).toBe("");
	});
});
