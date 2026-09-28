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
}

export type TimerStatus = "idle" | "running" | "paused" | "ringing";
export type TimerSoundId = "classic" | "digital" | "buzzer" | "chime";

export interface HomebaseTimer {
	status: TimerStatus;
	durationMs: number;
	remainingMs: number;
	endAt: number | null;
	alarmStartedAt: number | null;
	selectedSoundId: TimerSoundId;
	customPresets: number[];
	updatedAt: number;
}

export interface StorageSchema {
	homebase: HomebaseSettings;
	dailyWeatherCache: CachedDailyWeather | null;
	timer: HomebaseTimer;
}

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
};

const defaultTimerDurationMs = 15 * 60 * 1000;

export const defaultTimer: HomebaseTimer = {
	status: "idle",
	durationMs: defaultTimerDurationMs,
	remainingMs: defaultTimerDurationMs,
	endAt: null,
	alarmStartedAt: null,
	selectedSoundId: "classic",
	customPresets: [],
	updatedAt: 0,
};

export const defaultStorage: StorageSchema = {
	homebase: defaultHomebaseSettings,
	dailyWeatherCache: null,
	timer: defaultTimer,
};
