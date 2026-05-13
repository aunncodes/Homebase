import {useEffect, useRef, useState} from 'react';
import type {FC} from 'react';
import {Check, Palette} from 'lucide-react';
import type {HomebaseThemeId} from '../../types/storage';
import {themes} from '../themes';
import styles from '../App.module.scss';

interface ThemePickerProps {
  onThemeChange: (themeId: HomebaseThemeId) => void;
  selectedThemeId: HomebaseThemeId;
}

export const ThemePicker: FC<ThemePickerProps> = ({
  onThemeChange,
  selectedThemeId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return (): void => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={styles.themePicker} ref={pickerRef}>
      <button
        type="button"
        className={styles.themeToggle}
        onClick={(): void => setIsOpen((currentValue) => !currentValue)}
        aria-label="Choose theme"
        aria-expanded={isOpen}
        title="Choose theme"
      >
        <Palette size={18} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className={styles.themeMenu} role="listbox" aria-label="Themes">
          {themes.map((theme) => {
            const isSelected = theme.id === selectedThemeId;

            return (
              <button
                key={theme.id}
                type="button"
                className={styles.themeOption}
                onClick={(): void => {
                  onThemeChange(theme.id);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={isSelected}
              >
                <span className={styles.themePreview} aria-hidden="true">
                  {theme.swatches.map((swatch) => (
                    <span key={swatch} style={{background: swatch}} />
                  ))}
                </span>
                <span>{theme.name}</span>
                {isSelected && <Check size={16} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
