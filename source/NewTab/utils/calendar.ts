import { getStorage, setStorage } from "../../utils/storage";
import type { CalendarAuthCache, CalendarEventPreview, CalendarEventsCache, CalendarSettings, CalendarSummary} from "../../types/storage";

const clientId = "406403648155-qhvo68mmvtbcv692rrrheg2kr9f1lqmb.apps.googleusercontent.com";
const authUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenUrl = "https://oauth2.googleapis.com/token";
const calendarApiUrl = "https://www.googleapis.com/calendar/v3";
const calendarScope = "https://www.googleapis.com/auth/calendar.readonly";

const tokenExpiryBufferMs = 60000;
const calendarCacheMaxAgeMs = 120000; // 2 * 60 * 1000

interface FetchResponse {
	json(): Promise<unknown>;
	ok: boolean;
	status: number;
}

interface RuntimeLastError {
	message?: string;
}

interface CalendarGlobals {
	fetch(input: string | URL, init?: RequestInit): Promise<FetchResponse>;
	crypto: Crypto;
	browser?: {
		identity?: {
			getRedirectURL(): string;
			launchWebAuthFlow(details: { url: string; interactive: boolean }): Promise<string>;
		};
	};
	chrome?: {
		identity?: {
			getRedirectURL(): string;
			launchWebAuthFlow(
				details: { url: string; interactive: boolean },
				callback: (responseUrl?: string) => void
			): void;
		};
		runtime?: {
			lastError?: RuntimeLastError;
		};
	};
}

interface GoogleCalendarListResponse {
	items?: Array<{
		id: string;
		summary: string;
		backgroundColor?: string;
		primary?: boolean;
		selected?: boolean;
	}>;
}

interface GoogleEventsResponse {
	items?: Array<{
		id: string;
		summary?: string;
		status?: string;
		location?: string;
		htmlLink?: string;
		start: {
			date?: string;
			dateTime?: string;
		};
		end?: {
			date?: string;
			dateTime?: string;
		};
	}>;
}

interface GoogleTokenResponse {
	access_token?: string;
	expires_in?: number;
	token_type?: string;
	error?: string;
	error_description?: string;
}

function getCalendarGlobals(): CalendarGlobals {
	return globalThis as typeof globalThis & CalendarGlobals;
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function createCodeVerifier(): string {
	const bytes = new Uint8Array(32);
	getCalendarGlobals().crypto.getRandomValues(bytes);

	return base64UrlEncode(bytes);
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
	const encodedVerifier = new TextEncoder().encode(codeVerifier);
	const digest = await getCalendarGlobals().crypto.subtle.digest("SHA-256", encodedVerifier);

	return base64UrlEncode(new Uint8Array(digest));
}

async function getRedirectUrl(): Promise<string> {
	const calendarGlobals = getCalendarGlobals();

	if (calendarGlobals.browser?.identity?.getRedirectURL) {
		return calendarGlobals.browser.identity.getRedirectURL();
	}

	if (calendarGlobals.chrome?.identity?.getRedirectURL) {
		return calendarGlobals.chrome.identity.getRedirectURL();
	}

	throw new Error("Extension identity API is unavailable");
}

async function launchAuthFlow(url: string, interactive: boolean): Promise<string> {
	const calendarGlobals = getCalendarGlobals();

	if (calendarGlobals.browser?.identity?.launchWebAuthFlow) {
		return calendarGlobals.browser.identity.launchWebAuthFlow({
			url,
			interactive,
		});
	}

	if (calendarGlobals.chrome?.identity?.launchWebAuthFlow) {
		return new Promise((resolve, reject) => {
			calendarGlobals.chrome?.identity?.launchWebAuthFlow(
				{
					url,
					interactive,
				},
				(responseUrl) => {
					const errorMessage = calendarGlobals.chrome?.runtime?.lastError?.message;

					if (errorMessage) {
						reject(new Error(errorMessage));
						return;
					}

					if (!responseUrl) {
						reject(new Error("Google authorization did not return a response URL"));
						return;
					}

					resolve(responseUrl);
				}
			);
		});
	}

	throw new Error("Extension identity API is unavailable");
}

function getCodeFromRedirectUrl(responseUrl: string): string {
	const url = new URL(responseUrl);
	const error = url.searchParams.get("error");

	if (error) {
		throw new Error(error);
	}

	const code = url.searchParams.get("code");

	if (!code) {
		throw new Error("Google authorization did not return an authorization code");
	}

	return code;
}

async function exchangeCodeForAccessToken(
	code: string,
	codeVerifier: string,
	redirectUrl: string
): Promise<CalendarAuthCache> {
	const body = new URLSearchParams({
		client_id: clientId,
		code,
		code_verifier: codeVerifier,
		grant_type: "authorization_code",
		redirect_uri: redirectUrl,
	});

	const response = await getCalendarGlobals().fetch(tokenUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body,
	});

	const data = (await response.json()) as GoogleTokenResponse;

	if (!response.ok || !data.access_token) {
		throw new Error(data.error_description || data.error || "Google token exchange failed");
	}

	return {
		accessToken: data.access_token,
		expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
	};
}

function isUsableAuthCache(value: unknown): value is CalendarAuthCache {
	if (!value || typeof value !== "object") {
		return false;
	}

	const cache = value as Partial<CalendarAuthCache>;

	return (
		typeof cache.accessToken === "string" &&
		typeof cache.expiresAt === "number" &&
		cache.expiresAt > Date.now() + tokenExpiryBufferMs
	);
}

async function getCachedAccessToken(): Promise<string | null> {
	const { calendarAuthCache } = await getStorage(["calendarAuthCache"]);

	if (!isUsableAuthCache(calendarAuthCache)) {
		return null;
	}

	return calendarAuthCache.accessToken;
}

export async function getCalendarRedirectUrl(): Promise<string> {
	return getRedirectUrl();
}

export async function connectGoogleCalendar(): Promise<void> {
	const redirectUrl = await getRedirectUrl();
	const codeVerifier = createCodeVerifier();
	const codeChallenge = await createCodeChallenge(codeVerifier);

	const url = new URL(authUrl);
	url.searchParams.set("client_id", clientId);
	url.searchParams.set("redirect_uri", redirectUrl);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", calendarScope);
	url.searchParams.set("code_challenge", codeChallenge);
	url.searchParams.set("code_challenge_method", "S256");
	url.searchParams.set("access_type", "online");
	url.searchParams.set("prompt", "consent");

	const responseUrl = await launchAuthFlow(url.toString(), true);
	const code = getCodeFromRedirectUrl(responseUrl);
	const authCache = await exchangeCodeForAccessToken(code, codeVerifier, redirectUrl);

	await setStorage({
		calendarAuthCache: authCache,
	});
}

export async function disconnectGoogleCalendar(): Promise<void> {
	await setStorage({
		calendarAuthCache: null,
		calendarEventsCache: null,
	});
}

async function getAccessToken(): Promise<string> {
	const cachedAccessToken = await getCachedAccessToken();

	if (cachedAccessToken) {
		return cachedAccessToken;
	}

	await connectGoogleCalendar();

	const nextCachedAccessToken = await getCachedAccessToken();

	if (!nextCachedAccessToken) {
		throw new Error("Google Calendar is not connected");
	}

	return nextCachedAccessToken;
}

async function googleCalendarFetch<T>(path: string): Promise<T> {
	const accessToken = await getAccessToken();

	const response = await getCalendarGlobals().fetch(`${calendarApiUrl}${path}`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok) {
		if (response.status === 401) {
			await setStorage({
				calendarAuthCache: null,
			});
		}

		throw new Error(`Google Calendar request failed with status ${response.status}`);
	}

	return response.json() as Promise<T>;
}

export async function fetchGoogleCalendars(): Promise<CalendarSummary[]> {
	const data = await googleCalendarFetch<GoogleCalendarListResponse>("/users/me/calendarList");

	return (data.items ?? []).map((calendar): CalendarSummary => {
		return {
			id: calendar.id,
			name: calendar.summary,
			backgroundColor: calendar.backgroundColor,
			primary: calendar.primary,
			selected: calendar.selected,
		};
	});
}

async function fetchEventsForCalendar(
	calendar: CalendarSummary,
	settings: CalendarSettings
): Promise<CalendarEventPreview[]> {
	const now = new Date();
	const timeMax = new Date(now);
	timeMax.setDate(timeMax.getDate() + settings.daysAhead);

	const url = new URL(`${calendarApiUrl}/calendars/${encodeURIComponent(calendar.id)}/events`);
	url.searchParams.set("singleEvents", "true");
	url.searchParams.set("orderBy", "startTime");
	url.searchParams.set("timeMin", now.toISOString());
	url.searchParams.set("timeMax", timeMax.toISOString());
	url.searchParams.set("maxResults", String(settings.maxEvents));

	const path = url.toString().slice(calendarApiUrl.length);
	const data = await googleCalendarFetch<GoogleEventsResponse>(path);

	return (data.items ?? [])
		.filter((event) => event.status !== "cancelled")
		.filter((event) => settings.showAllDayEvents || !event.start.date)
		.map((event): CalendarEventPreview => {
			const start = event.start.dateTime ?? event.start.date ?? "";
			const end = event.end?.dateTime ?? event.end?.date;

			return {
				id: event.id,
				calendarId: calendar.id,
				calendarName: calendar.name,
				calendarColor: calendar.backgroundColor,
				title: event.summary || "Untitled event",
				start,
				end,
				isAllDay: Boolean(event.start.date),
				location: event.location,
				htmlLink: event.htmlLink,
			};
		});
}

function isMatchingEventsCache(value: unknown, settings: CalendarSettings): value is CalendarEventsCache {
	if (!value || typeof value !== "object") {
		return false;
	}

	const cache = value as Partial<CalendarEventsCache>;

	return (
		Array.isArray(cache.events) &&
		Array.isArray(cache.selectedCalendarIds) &&
		typeof cache.fetchedAt === "number" &&
		cache.daysAhead === settings.daysAhead &&
		cache.maxEvents === settings.maxEvents &&
		cache.showAllDayEvents === settings.showAllDayEvents &&
		Date.now() - cache.fetchedAt < calendarCacheMaxAgeMs &&
		cache.selectedCalendarIds.join("|") === settings.selectedCalendarIds.join("|")
	);
}

export async function getCachedCalendarEvents(settings: CalendarSettings): Promise<CalendarEventPreview[] | null> {
	const { calendarEventsCache } = await getStorage(["calendarEventsCache"]);

	if (!isMatchingEventsCache(calendarEventsCache, settings)) {
		return null;
	}

	return calendarEventsCache.events;
}

export async function fetchUpcomingCalendarEvents(settings: CalendarSettings): Promise<CalendarEventPreview[]> {
	if (settings.selectedCalendarIds.length === 0) {
		return [];
	}

	const calendars = await fetchGoogleCalendars();
	const selectedCalendars = calendars.filter((calendar) => settings.selectedCalendarIds.includes(calendar.id));

	const eventGroups = await Promise.all(selectedCalendars.map((calendar) => fetchEventsForCalendar(calendar, settings)));

	const events = eventGroups
		.flat()
		.sort((firstEvent, secondEvent) => firstEvent.start.localeCompare(secondEvent.start))
		.slice(0, settings.maxEvents);

	await setStorage({
		calendarEventsCache: {
			events,
			fetchedAt: Date.now(),
			selectedCalendarIds: settings.selectedCalendarIds,
			daysAhead: settings.daysAhead,
			maxEvents: settings.maxEvents,
			showAllDayEvents: settings.showAllDayEvents,
		},
	});

	return events;
}
