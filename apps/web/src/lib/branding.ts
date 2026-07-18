import { DEFAULT_APP_ICON, DEFAULT_APP_NAME } from "@workspace/config/constants";

interface BrandingIdentity {
	name?: string | null;
	icon?: string | null;
}

interface BrandingLinks {
	parentUrl?: string | null;
	url?: string | null;
}

export function isCustomBranding(branding?: BrandingIdentity | null): boolean {
	const name = branding?.name?.trim();
	const icon = branding?.icon?.trim();

	return (Boolean(name) && name !== DEFAULT_APP_NAME) || (Boolean(icon) && icon !== DEFAULT_APP_ICON);
}

export function getBrandingHostname(branding: BrandingLinks, hasCustomBranding: boolean): string {
	if (!hasCustomBranding) return "elmohq.com";

	for (const candidate of [branding.parentUrl, branding.url]) {
		if (!candidate) continue;

		try {
			return new URL(candidate).hostname;
		} catch {
			// Try the next configured URL without falling back to Elmo attribution.
		}
	}

	return "";
}
