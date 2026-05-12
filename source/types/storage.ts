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
  weatherLocation: WeatherLocation | null;
}

export interface StorageSchema {
  homebase: HomebaseSettings;
  dailyWeatherCache: CachedDailyWeather | null;
}

export const defaultHotLinks: HotLink[] = [
  {
    id: 'github',
    title: 'GitHub',
    url: 'https://github.com',
  },
  {
    id: 'gmail',
    title: 'Gmail',
    url: 'https://mail.google.com',
  },
  {
    id: 'drive',
    title: 'Google Drive',
    url: 'https://drive.google.com',
  },
  {
    id: 'youtube',
    title: 'YouTube',
    url: 'https://youtube.com',
  },
];

export const defaultHomebaseSettings: HomebaseSettings = {
  hotLinks: defaultHotLinks,
  stickyNote: '',
  weatherLocation: null,
};

export const defaultStorage: StorageSchema = {
  homebase: defaultHomebaseSettings,
  dailyWeatherCache: null,
};
