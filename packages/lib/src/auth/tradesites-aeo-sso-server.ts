import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { ensureLocalOrgMembership, LOCAL_ORG } from "../db/provisioning";
import { safeAeoReturnTo, type TradesitesSsoPayload, verifyTradesitesSsoToken } from "./tradesites-sso-token";

const querySchema = z.object({
	token: z.string(),
	returnTo: z.string().optional(),
});

type BetterAuthUser = {
	id: string;
	email: string;
	name: string;
	emailVerified: boolean;
	image?: string | null;
	createdAt: Date;
	updatedAt: Date;
};

type EndpointContext = {
	context: {
		internalAdapter: {
			findUserByEmail: (email: string) => Promise<{ user: unknown } | null>;
			createUser: (user: { email: string; name: string; emailVerified: boolean }) => Promise<unknown>;
		};
	};
};

export function tradesitesAeoSso(): BetterAuthPlugin {
	return {
		id: "tradesites-aeo-sso",
		endpoints: {
			tradesitesAeoSsoCallback: createAuthEndpoint(
				"/tradesites-aeo/callback",
				{
					method: "GET",
					query: querySchema,
					requireHeaders: true,
				},
				async (ctx) => {
					const returnTo = safeAeoReturnTo(ctx.query.returnTo);
					const secret = process.env.TRADESITES_AEO_SSO_SECRET;
					if (!secret) throw ctx.redirect(errorUrl("disabled", returnTo));

					const verified = verifyTradesitesSsoToken(ctx.query.token, secret);
					if (!verified.ok) throw ctx.redirect(errorUrl(verified.error, returnTo));

					const reserved = await ctx.context.internalAdapter.reserveVerificationValue({
						identifier: `tradesites-aeo-sso:${verified.payload.jti}`,
						value: verified.payload.sub,
						expiresAt: new Date(verified.payload.exp * 1000),
					});
					if (!reserved) throw ctx.redirect(errorUrl("replayed", returnTo));

					const user = await findOrProvisionUser(ctx, verified.payload);
					if (!user) throw ctx.redirect(errorUrl("no_account", returnTo));

					await ensureLocalOrgMembership({ userId: user.id, role: "member" });
					const session = await ctx.context.internalAdapter.createSession(user.id, false, {
						activeOrganizationId: LOCAL_ORG.id,
					});

					await setSessionCookie(ctx, { session, user });
					throw ctx.redirect(returnTo);
				},
			),
		},
	};
}

async function findOrProvisionUser(
	ctx: EndpointContext,
	payload: TradesitesSsoPayload,
): Promise<BetterAuthUser | null> {
	const email = payload.email.trim().toLowerCase();
	const existing = await ctx.context.internalAdapter.findUserByEmail(email);
	if (existing?.user) return existing.user as BetterAuthUser;

	if (process.env.TRADESITES_AEO_SSO_AUTO_PROVISION !== "true") return null;

	try {
		return (await ctx.context.internalAdapter.createUser({
			email,
			name: payload.name?.trim() || email,
			emailVerified: true,
		})) as BetterAuthUser;
	} catch {
		const raced = await ctx.context.internalAdapter.findUserByEmail(email);
		return (raced?.user as BetterAuthUser | undefined) ?? null;
	}
}

function errorUrl(error: string, returnTo: string): string {
	const params = new URLSearchParams({ ssoError: error, returnTo });
	return `/auth/login?${params.toString()}`;
}
