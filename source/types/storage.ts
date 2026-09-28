export interface HotLink {
	id: string;
	title: string;
	url: string;
	iconUrl?: string;
}

export interface WeatherLocation {
	id: number;
	name: string;
	latitude: number;
	longitude: number;
	admin1?: string;
	country?: string;
	timezone?: string;
}

export interface WeatherReport {
	condition: string;
	high: number;
	low: number;
	temperature: number;
}

export type HomebaseThemeId = "light" | "green" | "purple" | "dark" | "warm";

export interface CalendarSettings {
	selectedCalendarIds: string[];
	daysAhead: number;
	maxEvents: number;
	showAllDayEvents: boolean;
}

export interface CalendarAuthCache {
	accessToken: string;
	expiresAt: number;
}

export interface CalendarSummary {
	id: string;
	name: string;
	backgroundColor?: string;
	primary?: boolean;
	selected?: boolean;
}

export interface CalendarEventPreview {
	id: string;
	calendarId: string;
	calendarName: string;
	calendarColor?: string;
	title: string;
	start: string;
	end?: string;
	isAllDay: boolean;
	location?: string;
	htmlLink?: string;
}

export interface CalendarEventsCache {
	events: CalendarEventPreview[];
	fetchedAt: number;
	selectedCalendarIds: string[];
	daysAhead: number;
	maxEvents: number;
	showAllDayEvents: boolean;
}

export interface CachedDailyWeather {
	locationId: number;
	forecastDate: string;
	high: number;
	low: number;
	fetchedAt: number;
}

export interface HomebaseSettings {
	hotLinks: HotLink[];
	stickyNote: string;
	themeId: HomebaseThemeId;
	weatherLocation: WeatherLocation | null;
	calendar: CalendarSettings;
}

export interface StorageSchema {
	homebase: HomebaseSettings;
	dailyWeatherCache: CachedDailyWeather | null;
	calendarAuthCache: CalendarAuthCache | null;
	calendarEventsCache: CalendarEventsCache | null;
}

export const defaultCalendarSettings: CalendarSettings = {
	selectedCalendarIds: [],
	daysAhead: 7,
	maxEvents: 6,
	showAllDayEvents: true,
};

export const defaultHotLinks: HotLink[] = [
	{
		id: "github",
		title: "GitHub",
		url: "https://github.com",
	},
	{
		id: "gmail",
		title: "Gmail",
		url: "https://mail.google.com",
	},
	{
		id: "drive",
		title: "Google Drive",
		url: "https://drive.google.com",
	},
	{
		id: "youtube",
		title: "YouTube",
		url: "https://youtube.com",
	},
];

export const defaultHomebaseSettings: HomebaseSettings = {
	hotLinks: defaultHotLinks,
	stickyNote: "",
	themeId: "light",
	weatherLocation: null,
	calendar: defaultCalendarSettings,
};

export const defaultStorage: StorageSchema = {
	homebase: defaultHomebaseSettings,
	dailyWeatherCache: null,
	calendarAuthCache: null,
	calendarEventsCache: null,
};
