import { createHmac, timingSafeEqual } from "node:crypto";

export interface TradesitesSsoPayload {
	iss: "tradesites";
	aud: "tradesites-aeo";
	sub: string;
	email: string;
	name?: string;
	iat: number;
	exp: number;
	jti: string;
}

export type TradesitesSsoVerifyResult =
	| { ok: true; payload: TradesitesSsoPayload }
	| { ok: false; error: "malformed" | "invalid_signature" | "invalid_claims" | "expired" | "not_yet_valid" };

const MAX_CLOCK_SKEW_SECONDS = 30;

export function base64UrlEncode(input: Buffer | string): string {
	return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): Buffer {
	return Buffer.from(input, "base64url");
}

export function signTradesitesSsoPayload(payload: TradesitesSsoPayload, secret: string): string {
	const body = base64UrlEncode(JSON.stringify(payload));
	const signature = createHmac("sha256", secret).update(body).digest("base64url");
	return `${body}.${signature}`;
}

export function verifyTradesitesSsoToken(
	token: string,
	secret: string,
	nowSeconds = Math.floor(Date.now() / 1000),
): TradesitesSsoVerifyResult {
	const [body, signature, extra] = token.split(".");
	if (!body || !signature || extra !== undefined) return { ok: false, error: "malformed" };

	const expected = createHmac("sha256", secret).update(body).digest("base64url");
	if (!safeEqual(signature, expected)) return { ok: false, error: "invalid_signature" };

	let payload: unknown;
	try {
		payload = JSON.parse(base64UrlDecode(body).toString("utf8"));
	} catch {
		return { ok: false, error: "malformed" };
	}

	if (!isTradesitesSsoPayload(payload)) return { ok: false, error: "invalid_claims" };
	if (payload.exp < nowSeconds - MAX_CLOCK_SKEW_SECONDS) return { ok: false, error: "expired" };
	if (payload.iat > nowSeconds + MAX_CLOCK_SKEW_SECONDS) return { ok: false, error: "not_yet_valid" };

	return { ok: true, payload };
}

export function safeAeoReturnTo(returnTo: string | undefined): string {
	if (!returnTo) return "/app";
	if (returnTo.startsWith("/") && !returnTo.startsWith("//")) return returnTo;

	try {
		const url = new URL(returnTo, "https://aeo.tradesites.ai");
		if (url.origin !== "https://aeo.tradesites.ai") return "/app";
		return `${url.pathname}${url.search}${url.hash}`;
	} catch {
		return "/app";
	}
}

function safeEqual(a: string, b: string): boolean {
	const aBuffer = Buffer.from(a);
	const bBuffer = Buffer.from(b);
	return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function isTradesitesSsoPayload(payload: unknown): payload is TradesitesSsoPayload {
	if (!payload || typeof payload !== "object") return false;
	const record = payload as Record<string, unknown>;
	return (
		record.iss === "tradesites" &&
		record.aud === "tradesites-aeo" &&
		typeof record.sub === "string" &&
		record.sub.length > 0 &&
		typeof record.email === "string" &&
		record.email.includes("@") &&
		(record.name === undefined || typeof record.name === "string") &&
		typeof record.iat === "number" &&
		Number.isInteger(record.iat) &&
		typeof record.exp === "number" &&
		Number.isInteger(record.exp) &&
		record.exp > record.iat &&
		typeof record.jti === "string" &&
		record.jti.length > 0
	);
}
