import type { H3Event } from "h3";

export async function useAuth(event: H3Event, throwError?: true): Promise<string>;
export async function useAuth(
	event: H3Event,
	throwError: false
): Promise<[string, undefined] | [undefined, string]>;
export async function useAuth(event: H3Event, throwError: boolean = true) {
	const token = readAuthToken(event);
	if (!token) {
		if (throwError) {
			throw createError({
				status: 401,
				message: "Bad Authentication",
			});
		} else {
			return [undefined, "Unable to get auth token"];
		}
	}

	const email = await $storage.getItem(token);
	if (!email) {
		if (throwError) {
			throw createError({
				status: 500,
				message: "Invalid API token",
			});
		}
		return [undefined, "Unknown error while verifying token"];
	}

	if (!throwError) {
		return [email, null];
	} else {
		return email;
	}
}

export function readAuthToken(event: H3Event) {
	let auth = getHeader(event, "Authorization") || null;
	if (!auth) auth = getCookie(event, "Authorization") || null;
	if (!auth) return null;

	let [bearer, token] = auth.split(" ");
	if (bearer?.toLowerCase() !== "bearer") return null;

	if (!Boolish(token)) return null;

	return token;
}
