import type {FC} from 'react';
import styles from '../App.module.scss';

interface StickyPadProps {
  onChange: (value: string) => void;
  value: string;
}

export const StickyPad: FC<StickyPadProps> = ({onChange, value}) => (
  <section className={styles.stickyPad} aria-label="Sticky pad">
    <textarea
      aria-label="Sticky note"
      value={value}
      onChange={(event): void => onChange(event.target.value)}
      placeholder="Keep a thought here."
      spellCheck
    />
  </section>
);
