import type {WeatherLocation} from '../../types/storage';

export interface WeatherReport {
  condition: string;
  high: number;
  low: number;
  temperature: number;
}

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

interface OpenMeteoForecastResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
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

const geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';
const forecastUrl = 'https://api.open-meteo.com/v1/forecast';

function getWeatherGlobals(): WeatherGlobals {
  return globalThis as typeof globalThis & WeatherGlobals;
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

export async function fetchWeatherReport(
  location: WeatherLocation
): Promise<WeatherReport> {
  const url = new URL(forecastUrl);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', location.timezone || 'auto');

  const response = await getWeatherGlobals().fetch(url);

  if (!response.ok) {
    throw new Error('Weather forecast failed');
  }

  const data = (await response.json()) as OpenMeteoForecastResponse;
  const current = data.current;
  const daily = data.daily;

  if (
    typeof current?.temperature_2m !== 'number' ||
    typeof daily?.temperature_2m_max?.[0] !== 'number' ||
    typeof daily.temperature_2m_min?.[0] !== 'number'
  ) {
    throw new Error('Weather forecast is missing data');
  }

  return {
    condition: getWeatherDescription(current.weather_code),
    high: Math.round(daily.temperature_2m_max[0]),
    low: Math.round(daily.temperature_2m_min[0]),
    temperature: Math.round(current.temperature_2m),
  };
}
