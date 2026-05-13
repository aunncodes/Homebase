import {useEffect, useRef, useState} from 'react';
import type {FC} from 'react';
import {getStorage, setStorage} from '../utils/storage';
import {defaultHomebaseSettings, defaultHotLinks} from '../types/storage';
import type {
  HomebaseSettings,
  HomebaseThemeId,
  HotLink,
  WeatherLocation,
} from '../types/storage';
import {Header} from './components/Header';
import {HotLinks} from './components/HotLinks';
import {StickyPad} from './components/StickyPad';
import {ThemePicker} from './components/ThemePicker';
import {WeatherWidget} from './components/WeatherWidget';
import type {LinkDraft} from './components/LinkEditor';
import {normalizeThemeId} from './themes';
import styles from './App.module.scss';

const saveDelay = 450;

function createId(): string {
  return `link-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeUrl(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error('URL is required');
  }

  const urlWithProtocol = /^[a-z][a-z\d+.-]*:/i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;
  const parsedUrl = new URL(urlWithProtocol);

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only http and https links are supported');
  }

  return parsedUrl.toString();
}

function normalizeSettings(settings: HomebaseSettings): HomebaseSettings {
  const weatherLocation =
    settings.weatherLocation && typeof settings.weatherLocation === 'object'
      ? settings.weatherLocation
      : defaultHomebaseSettings.weatherLocation;
  const themeId = normalizeThemeId(settings.themeId);

  return {
    hotLinks: Array.isArray(settings.hotLinks)
      ? settings.hotLinks
      : defaultHotLinks,
    stickyNote:
      typeof settings.stickyNote === 'string'
        ? settings.stickyNote
        : defaultHomebaseSettings.stickyNote,
    themeId,
    weatherLocation,
  };
}

const App: FC = () => {
  const [homebase, setHomebase] = useState<HomebaseSettings>(
    defaultHomebaseSettings
  );
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [isThemeChanging, setIsThemeChanging] = useState(false);
  const themeAnimationTimer = useRef<number | null>(null);

  useEffect(() => {
    getStorage(['homebase'])
      .then(({homebase: storedHomebase}): void => {
        setHomebase(normalizeSettings(storedHomebase));
      })
      .finally((): void => {
        setHasLoadedStorage(true);
      });
  }, []);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return undefined;
    }

    const saveTimer = window.setTimeout(() => {
      setStorage({homebase}).catch(() => {
        // Storage can be unavailable in non-extension previews.
      });
    }, saveDelay);

    return (): void => {
      window.clearTimeout(saveTimer);
    };
  }, [hasLoadedStorage, homebase]);

  useEffect(
    () => (): void => {
      if (themeAnimationTimer.current) {
        window.clearTimeout(themeAnimationTimer.current);
      }
    },
    []
  );

  const createLink = (draft: LinkDraft): string | null => {
    const title = draft.title.trim();

    if (!title) {
      return 'Add a title for this link.';
    }

    try {
      const nextLink: HotLink = {
        id: createId(),
        title,
        url: normalizeUrl(draft.url),
      };

      setHomebase((currentHomebase): HomebaseSettings => {
        return {
          ...currentHomebase,
          hotLinks: [...currentHomebase.hotLinks, nextLink],
        };
      });

      return null;
    } catch {
      return 'Enter a valid http or https URL.';
    }
  };

  const updateLink = (linkId: string, draft: LinkDraft): string | null => {
    const title = draft.title.trim();

    if (!title) {
      return 'Add a title for this link.';
    }

    try {
      const normalizedUrl = normalizeUrl(draft.url);

      setHomebase((currentHomebase): HomebaseSettings => {
        return {
          ...currentHomebase,
          hotLinks: currentHomebase.hotLinks.map((link): HotLink => {
            if (link.id !== linkId) {
              return link;
            }

            return {
              ...link,
              title,
              url: normalizedUrl,
            };
          }),
        };
      });

      return null;
    } catch {
      return 'Enter a valid http or https URL.';
    }
  };

  const deleteLink = (linkId: string): void => {
    setHomebase((currentHomebase): HomebaseSettings => {
      return {
        ...currentHomebase,
        hotLinks: currentHomebase.hotLinks.filter(
          (link): boolean => link.id !== linkId
        ),
      };
    });
  };

  const updateStickyNote = (stickyNote: string): void => {
    setHomebase((currentHomebase): HomebaseSettings => {
      return {
        ...currentHomebase,
        stickyNote,
      };
    });
  };

  const updateWeatherLocation = (
    weatherLocation: WeatherLocation | null
  ): void => {
    setHomebase((currentHomebase): HomebaseSettings => {
      return {
        ...currentHomebase,
        weatherLocation,
      };
    });
  };

  const updateTheme = (themeId: HomebaseThemeId): void => {
    if (themeId === homebase.themeId) {
      return;
    }

    if (themeAnimationTimer.current) {
      window.clearTimeout(themeAnimationTimer.current);
    }

    setIsThemeChanging(true);
    themeAnimationTimer.current = window.setTimeout(() => {
      setIsThemeChanging(false);
    }, 620);

    setHomebase((currentHomebase): HomebaseSettings => {
      return {
        ...currentHomebase,
        themeId,
      };
    });
  };

  const pageClassName = `${styles.page} ${
    isThemeChanging ? styles.themeChanging : ''
  }`;

  return (
    <div className={pageClassName} data-theme={homebase.themeId}>
      <div className={styles.shell}>
        <ThemePicker
          selectedThemeId={homebase.themeId}
          onThemeChange={updateTheme}
        />
        <div className={styles.topbar}>
          <Header />
          <WeatherWidget
            location={homebase.weatherLocation}
            onLocationChange={updateWeatherLocation}
          />
        </div>

        <main className={styles.dashboard}>
          <HotLinks
            links={homebase.hotLinks}
            onAddLink={createLink}
            onDeleteLink={deleteLink}
            onUpdateLink={updateLink}
          />
          <StickyPad value={homebase.stickyNote} onChange={updateStickyNote} />
        </main>
      </div>
    </div>
  );
};

export default App;
