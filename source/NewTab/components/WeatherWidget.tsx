import {useEffect, useMemo, useState} from 'react';
import type {FC, FormEvent, ReactElement} from 'react';
import {
  AlertTriangle,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudSun,
  Search,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import type {WeatherLocation, WeatherReport} from '../../types/storage';
import {
  fetchWeatherReport,
  formatLocation,
  searchWeatherLocations,
} from '../utils/weather';
import styles from '../App.module.scss';

interface WeatherWidgetProps {
  location: WeatherLocation | null;
  onLocationChange: (location: WeatherLocation | null) => void;
}

function getWeatherIcon(condition?: string): ReactElement {
  if (!condition) {
    return <AlertTriangle size={22} aria-hidden="true" />;
  }

  if (condition === 'Clear') {
    return <Sun size={22} aria-hidden="true" />;
  }

  if (condition === 'Rain' || condition === 'Drizzle') {
    return <CloudRain size={22} aria-hidden="true" />;
  }

  if (condition === 'Snow') {
    return <CloudSnow size={22} aria-hidden="true" />;
  }

  if (condition === 'Storms') {
    return <Zap size={22} aria-hidden="true" />;
  }

  if (condition === 'Cloudy' || condition === 'Foggy') {
    return <Cloud size={22} aria-hidden="true" />;
  }

  return <CloudSun size={22} aria-hidden="true" />;
}

export const WeatherWidget: FC<WeatherWidgetProps> = ({
  location,
  onLocationChange,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [query, setQuery] = useState(location?.name ?? '');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [weatherReport, setWeatherReport] = useState<WeatherReport | null>(
    null
  );
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState('');

  useEffect(() => {
    if (!location) {
      setWeatherReport(null);
      setWeatherError('');
      return;
    }

    setIsLoadingWeather(true);
    fetchWeatherReport(location)
      .then((report): void => {
        setWeatherReport(report);
        setWeatherError('');
      })
      .catch((): void => {
        setWeatherReport(null);
        setWeatherError('Weather unavailable');
      })
      .finally((): void => {
        setIsLoadingWeather(false);
      });
  }, [location]);

  useEffect(() => {
    if (isPickerOpen) {
      setQuery(location?.name ?? '');
      setResults([]);
      setSearchError('');
    }
  }, [isPickerOpen, location]);

  const weatherSummary = useMemo((): string => {
    if (!location) {
      return 'City not set';
    }

    if (isLoadingWeather) {
      return 'Loading weather';
    }

    if (weatherError) {
      return weatherError;
    }

    return weatherReport?.condition ?? 'Weather';
  }, [isLoadingWeather, location, weatherError, weatherReport]);

  const handleSearch = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    setIsSearching(true);
    setSearchError('');

    try {
      const nextResults = await searchWeatherLocations(query);
      setResults(nextResults);

      if (nextResults.length === 0) {
        setSearchError('No matching cities found.');
      }
    } catch {
      setResults([]);
      setSearchError('City search is unavailable.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectLocation = (nextLocation: WeatherLocation): void => {
    onLocationChange(nextLocation);
    setIsPickerOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={styles.weatherWidget}
        onClick={(): void => setIsPickerOpen(true)}
        aria-label="Set weather city"
      >
        <span className={styles.weatherIcon}>
          {getWeatherIcon(weatherReport?.condition)}
        </span>
        <span className={styles.weatherContent}>
          <span className={styles.kicker}>Weather</span>
          <strong>{location?.name ?? 'City not set'}</strong>
          {weatherReport && location ? (
            <>
              <span className={styles.weatherTemp}>
                {weatherReport.temperature}&deg;F
              </span>
              <span>{weatherReport.condition}</span>
              <span>
                H: {weatherReport.high}&deg; L: {weatherReport.low}&deg;
              </span>
            </>
          ) : (
            <span>{weatherSummary}</span>
          )}
        </span>
      </button>

      {isPickerOpen && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event): void => {
            if (event.target === event.currentTarget) {
              setIsPickerOpen(false);
            }
          }}
        >
          <section
            className={styles.weatherModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="weather-modal-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.kicker}>Weather location</p>
                <h2 id="weather-modal-title">Pick your city</h2>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={(): void => setIsPickerOpen(false)}
                aria-label="Close weather picker"
                title="Close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className={styles.weatherPickerBody}>

              <div className={styles.cityPicker}>
                <form className={styles.citySearch} onSubmit={handleSearch}>
                  <label>
                    <span>City or postal code</span>
                    <input
                      type="search"
                      value={query}
                      onChange={(event): void => setQuery(event.target.value)}
                      placeholder="Richmond"
                      autoComplete="off"
                    />
                  </label>
                  <button
                    type="submit"
                    className={styles.iconButton}
                    aria-label="Search cities"
                    title="Search"
                    disabled={isSearching}
                  >
                    <Search size={18} aria-hidden="true" />
                  </button>
                </form>

                {searchError && (
                  <p className={styles.formError}>{searchError}</p>
                )}

                <div className={styles.cityResults}>
                  {results.map((result) => (
                    <button
                      key={`${result.id}-${result.latitude}`}
                      type="button"
                      onClick={(): void => selectLocation(result)}
                    >
                      <strong>{result.name}</strong>
                      <span>{formatLocation(result)}</span>
                    </button>
                  ))}
                </div>

                {location && (
                  <button
                    type="button"
                    className={styles.clearLocationButton}
                    onClick={(): void => onLocationChange(null)}
                  >
                    Clear saved city
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
};
