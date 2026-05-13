import {getStorage, setStorage} from '../../utils/storage';
import type {
  CachedDailyWeather,
  WeatherLocation,
  WeatherReport,
} from '../../types/storage';

interface OpenMeteoGeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
  timezone?: string;
}

interface OpenMeteoGeocodingResponse {
  results?: OpenMeteoGeocodingResult[];
}

interface OpenMeteoCurrentResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
}

interface OpenMeteoDailyResponse {
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
}

interface FetchResponse {
  json(): Promise<unknown>;
  ok: boolean;
}

interface WeatherGlobals {
  fetch(input: URL): Promise<FetchResponse>;
}

interface CurrentWeather {
  condition: string;
  temperature: number;
}

interface DailyWeather {
  high: number;
  low: number;
}

const geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';
const forecastUrl = 'https://api.open-meteo.com/v1/forecast';

function getWeatherGlobals(): WeatherGlobals {
  return globalThis as typeof globalThis & WeatherGlobals;
}

function getLocalDateKey(timezone?: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

export function formatLocation(location: WeatherLocation): string {
  return [location.name, location.admin1, location.country]
    .filter(Boolean)
    .join(', ');
}

export function getWeatherDescription(weatherCode?: number): string {
  if (weatherCode === 0) {
    return 'Clear';
  }

  if (weatherCode === 1 || weatherCode === 2) {
    return 'Partly cloudy';
  }

  if (weatherCode === 3) {
    return 'Cloudy';
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return 'Foggy';
  }

  if (
    weatherCode === 51 ||
    weatherCode === 53 ||
    weatherCode === 55 ||
    weatherCode === 56 ||
    weatherCode === 57
  ) {
    return 'Drizzle';
  }

  if (
    weatherCode === 61 ||
    weatherCode === 63 ||
    weatherCode === 65 ||
    weatherCode === 66 ||
    weatherCode === 67 ||
    weatherCode === 80 ||
    weatherCode === 81 ||
    weatherCode === 82
  ) {
    return 'Rain';
  }

  if (
    weatherCode === 71 ||
    weatherCode === 73 ||
    weatherCode === 75 ||
    weatherCode === 77 ||
    weatherCode === 85 ||
    weatherCode === 86
  ) {
    return 'Snow';
  }

  if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
    return 'Storms';
  }

  return 'Weather';
}

export async function searchWeatherLocations(
  searchTerm: string
): Promise<WeatherLocation[]> {
  const trimmedSearchTerm = searchTerm.trim();

  if (trimmedSearchTerm.length < 2) {
    return [];
  }

  const url = new URL(geocodingUrl);
  url.searchParams.set('name', trimmedSearchTerm);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const response = await getWeatherGlobals().fetch(url);

  if (!response.ok) {
    throw new Error('Location search failed');
  }

  const data = (await response.json()) as OpenMeteoGeocodingResponse;

  return (data.results ?? []).map((result): WeatherLocation => {
    return {
      id: result.id,
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      admin1: result.admin1,
      country: result.country,
      timezone: result.timezone,
    };
  });
}

async function fetchCurrentWeather(
  location: WeatherLocation
): Promise<CurrentWeather> {
  const url = new URL(forecastUrl);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('timezone', location.timezone || 'auto');

  const response = await getWeatherGlobals().fetch(url);

  if (!response.ok) {
    throw new Error('Current weather failed');
  }

  const data = (await response.json()) as OpenMeteoCurrentResponse;
  const current = data.current;

  if (typeof current?.temperature_2m !== 'number') {
    throw new Error('Current weather is missing data');
  }

  return {
    condition: getWeatherDescription(current.weather_code),
    temperature: Math.round(current.temperature_2m),
  };
}

function isValidDailyWeatherCache(value: unknown): value is CachedDailyWeather {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const cache = value as Partial<CachedDailyWeather>;

  return (
    typeof cache.locationId === 'number' &&
    typeof cache.forecastDate === 'string' &&
    typeof cache.high === 'number' &&
    typeof cache.low === 'number' &&
    typeof cache.fetchedAt === 'number'
  );
}

async function getCachedDailyWeather(
  location: WeatherLocation
): Promise<DailyWeather | null> {
  const {dailyWeatherCache} = await getStorage(['dailyWeatherCache']);

  if (!isValidDailyWeatherCache(dailyWeatherCache)) {
    return null;
  }

  if (dailyWeatherCache.locationId !== location.id) {
    return null;
  }

  if (dailyWeatherCache.forecastDate !== getLocalDateKey(location.timezone)) {
    return null;
  }

  return {
    high: dailyWeatherCache.high,
    low: dailyWeatherCache.low,
  };
}

async function fetchFreshDailyWeather(
  location: WeatherLocation
): Promise<DailyWeather> {
  const url = new URL(forecastUrl);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', location.timezone || 'auto');

  const response = await getWeatherGlobals().fetch(url);

  if (!response.ok) {
    throw new Error('Daily weather failed');
  }

  const data = (await response.json()) as OpenMeteoDailyResponse;
  const daily = data.daily;

  if (
    typeof daily?.temperature_2m_max?.[0] !== 'number' ||
    typeof daily.temperature_2m_min?.[0] !== 'number'
  ) {
    throw new Error('Daily weather is missing data');
  }

  return {
    high: Math.round(daily.temperature_2m_max[0]),
    low: Math.round(daily.temperature_2m_min[0]),
  };
}

async function getDailyWeather(
  location: WeatherLocation
): Promise<DailyWeather> {
  const cachedDailyWeather = await getCachedDailyWeather(location);

  if (cachedDailyWeather) {
    return cachedDailyWeather;
  }

  const dailyWeather = await fetchFreshDailyWeather(location);

  await setStorage({
    dailyWeatherCache: {
      locationId: location.id,
      forecastDate: getLocalDateKey(location.timezone),
      high: dailyWeather.high,
      low: dailyWeather.low,
      fetchedAt: Date.now(),
    },
  });

  return dailyWeather;
}

export async function fetchWeatherReport(
  location: WeatherLocation
): Promise<WeatherReport> {
  const [currentWeather, dailyWeather] = await Promise.all([
    fetchCurrentWeather(location),
    getDailyWeather(location),
  ]);

  return {
    condition: currentWeather.condition,
    temperature: currentWeather.temperature,
    high: dailyWeather.high,
    low: dailyWeather.low,
  };
}
