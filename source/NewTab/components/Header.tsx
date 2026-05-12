import {useEffect, useMemo, useState} from 'react';
import type {FC} from 'react';
import styles from '../App.module.scss';

function getGreeting(date: Date): string {
  const hour = date.getHours();

  if (hour < 12) {
    return 'Good morning!';
  }

  if (hour < 18) {
    return 'Good afternoon!';
  }

  return 'Good evening!';
}

export const Header: FC = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval((): void => {
      setNow(new Date());
    }, 60_000);

    return (): void => {
      window.clearInterval(timer);
    };
  }, []);

  const currentDate = useMemo(
    (): string =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(now),
    [now]
  );

  return (
    <header className={styles.header}>
      <p className={styles.kicker}>Homebase</p>
      <h1>{getGreeting(now)}</h1>
      <p className={styles.date}>{currentDate}</p>
    </header>
  );
};
