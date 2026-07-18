import { describe, expect, it } from "vitest";
import {
	safeAeoReturnTo,
	signTradesitesSsoPayload,
	type TradesitesSsoPayload,
	verifyTradesitesSsoToken,
} from "./tradesites-sso-token";

const payload: TradesitesSsoPayload = {
	iss: "tradesites",
	aud: "tradesites-aeo",
	sub: "user_123",
	email: "james@example.com",
	name: "James Wrest",
	iat: 1000,
	exp: 1060,
	jti: "handoff_123",
};

describe("TradeSites AEO SSO token", () => {
	it("round-trips a signed payload", () => {
		const token = signTradesitesSsoPayload(payload, "shared-secret");

		expect(verifyTradesitesSsoToken(token, "shared-secret", 1010)).toEqual({
			ok: true,
			payload,
		});
	});

	it("rejects a token signed with the wrong secret", () => {
		const token = signTradesitesSsoPayload(payload, "shared-secret");

		expect(verifyTradesitesSsoToken(token, "other-secret", 1010)).toEqual({
			ok: false,
			error: "invalid_signature",
		});
	});

	it("rejects expired and future-issued tokens", () => {
		const token = signTradesitesSsoPayload(payload, "shared-secret");
		const futureToken = signTradesitesSsoPayload({ ...payload, iat: 1200, exp: 1260 }, "shared-secret");

		expect(verifyTradesitesSsoToken(token, "shared-secret", 1091)).toEqual({ ok: false, error: "expired" });
		expect(verifyTradesitesSsoToken(futureToken, "shared-secret", 1000)).toEqual({
			ok: false,
			error: "not_yet_valid",
		});
	});
});

describe("AEO returnTo sanitising", () => {
	it("allows local paths only", () => {
		expect(safeAeoReturnTo("/app/default?tab=overview")).toBe("/app/default?tab=overview");
		expect(safeAeoReturnTo("https://aeo.tradesites.ai/app#top")).toBe("/app#top");
		expect(safeAeoReturnTo("https://evil.example/app")).toBe("/app");
		expect(safeAeoReturnTo("//evil.example/app")).toBe("/app");
	});
});
