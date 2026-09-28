import { CalendarDays, LogOut, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { FC } from "react";
import type { CalendarEventPreview, CalendarSettings, CalendarSummary } from "../../types/storage";
import { connectGoogleCalendar, disconnectGoogleCalendar, fetchGoogleCalendars, fetchUpcomingCalendarEvents, getCachedCalendarEvents} from "../utils/calendar";
import styles from "../App.module.scss";

interface CalendarWidgetProps {
	settings: CalendarSettings;
	onSettingsChange(settings: CalendarSettings): void;
}

type WidgetStatus = "idle" | "loading" | "error";

export const CalendarWidget: FC<CalendarWidgetProps> = ({ settings, onSettingsChange }) => {
	const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
	const [events, setEvents] = useState<CalendarEventPreview[]>([]);
	const [status, setStatus] = useState<WidgetStatus>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const isConnected = settings.selectedCalendarIds.length > 0;

	const loadEvents = async (showLoading: boolean): Promise<void> => {
		if (settings.selectedCalendarIds.length === 0) {
			setEvents([]);
			return;
		}

		if (showLoading) {
			setStatus("loading");
		}

		setErrorMessage(null);

		try {
			const cachedEvents = await getCachedCalendarEvents(settings);

			if (cachedEvents) {
				setEvents(cachedEvents);
				setStatus("idle");
				return;
			}

			const nextEvents = await fetchUpcomingCalendarEvents(settings);
			setEvents(nextEvents);
			setStatus("idle");
		} catch {
			setErrorMessage("Could not load events.");
			setStatus("error");
		}
	};

	const connect = async (): Promise<void> => {
		setStatus("loading");
		setErrorMessage(null);

		try {
			await connectGoogleCalendar();

			const nextCalendars = await fetchGoogleCalendars();
			const selectedCalendarIds = nextCalendars
				.filter((calendar) => calendar.primary || calendar.selected)
				.map((calendar) => calendar.id);

			setCalendars(nextCalendars);
			onSettingsChange({
				...settings,
				selectedCalendarIds,
			});
			setStatus("idle");
		} catch {
			setErrorMessage("Could not connect Google Calendar.");
			setStatus("error");
		}
	};

	const disconnect = async (): Promise<void> => {
		await disconnectGoogleCalendar();
		setEvents([]);
		setCalendars([]);
		onSettingsChange({
			...settings,
			selectedCalendarIds: [],
		});
	};

	const toggleCalendar = (calendarId: string): void => {
		const selectedCalendarIds = settings.selectedCalendarIds.includes(calendarId)
			? settings.selectedCalendarIds.filter((selectedCalendarId) => selectedCalendarId !== calendarId)
			: [...settings.selectedCalendarIds, calendarId];

		onSettingsChange({
			...settings,
			selectedCalendarIds,
		});
	};

	const updateDaysAhead = (daysAhead: number): void => {
		onSettingsChange({
			...settings,
			daysAhead,
		});
	};

	const updateShowAllDayEvents = (showAllDayEvents: boolean): void => {
		onSettingsChange({
			...settings,
			showAllDayEvents,
		});
	};

	useEffect(() => {
		let isActive = true;

		const loadCalendars = async (): Promise<void> => {
			if (!isConnected) {
				return;
			}

			try {
				const nextCalendars = await fetchGoogleCalendars();

				if (isActive) {
					setCalendars(nextCalendars);
				}
			} catch {
				if (isActive) {
					setErrorMessage("Could not load calendars.");
				}
			}
		};

		void loadCalendars();

		return () => {
			isActive = false;
		};
	}, [isConnected]);

	useEffect(() => {
		let isActive = true;

		const load = async (): Promise<void> => {
			if (!isActive) {
				return;
			}

			await loadEvents(events.length === 0);
		};

		void load();

		return () => {
			isActive = false;
		};
	}, [settings.selectedCalendarIds, settings.daysAhead, settings.maxEvents, settings.showAllDayEvents]);

	if (!isConnected) {
		return (
			<section className={styles.card}>
				<div className={styles.header}>
					<div className={styles.iconBox}>
						<CalendarDays size={19} />
					</div>
					<div>
						<p className={styles.kicker}>Calendar</p>
						<h2 className={styles.title}>Upcoming events</h2>
					</div>
				</div>

				<p className={styles.emptyText}>Connect Google Calendar to show upcoming events from your selected calendars.</p>

				<button className={styles.primaryButton} type="button" onClick={connect} disabled={status === "loading"}>
					{status === "loading" ? "Connecting..." : "Connect Google Calendar"}
				</button>

				{errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
			</section>
		);
	}

	return (
		<section className={styles.card}>
			<div className={styles.header}>
				<div className={styles.iconBox}>
					<CalendarDays size={19} />
				</div>
				<div>
					<p className={styles.kicker}>Calendar</p>
					<h2 className={styles.title}>Upcoming</h2>
				</div>

				<div className={styles.actions}>
					<button
						className={styles.iconButton}
						type="button"
						onClick={() => void loadEvents(true)}
						aria-label="Refresh calendar"
					>
						<RefreshCw size={16} />
					</button>
					<button
						className={styles.iconButton}
						type="button"
						onClick={() => void disconnect()}
						aria-label="Disconnect Google Calendar"
					>
						<LogOut size={16} />
					</button>
				</div>
			</div>

			<div className={styles.controls}>
				<label>
					<span>Range</span>
					<select value={settings.daysAhead} onChange={(event) => updateDaysAhead(Number(event.target.value))}>
						<option value={1}>1 day</option>
						<option value={3}>3 days</option>
						<option value={7}>7 days</option>
						<option value={14}>14 days</option>
					</select>
				</label>

				<label className={styles.checkControl}>
					<input
						type="checkbox"
						checked={settings.showAllDayEvents}
						onChange={(event) => updateShowAllDayEvents(event.target.checked)}
					/>
					<span>All-day</span>
				</label>
			</div>

			{calendars.length > 0 ? (
				<div className={styles.calendarPicker}>
					{calendars.map((calendar) => (
						<label className={styles.calendarOption} key={calendar.id}>
							<input
								type="checkbox"
								checked={settings.selectedCalendarIds.includes(calendar.id)}
								onChange={() => toggleCalendar(calendar.id)}
							/>
							<span className={styles.calendarDot} style={{ backgroundColor: calendar.backgroundColor }} />
							<span>{calendar.name}</span>
						</label>
					))}
				</div>
			) : null}

			{status === "loading" && events.length === 0 ? <p className={styles.emptyText}>Loading events...</p> : null}
			{errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

			{status !== "loading" && events.length === 0 && !errorMessage ? (
				<p className={styles.emptyText}>No upcoming events.</p>
			) : null}

			{events.length > 0 ? (
				<ol className={styles.eventList}>
					{events.map((event) => (
						<li className={styles.eventItem} key={`${event.calendarId}-${event.id}`}>
							<span className={styles.eventColor} style={{ backgroundColor: event.calendarColor }} />
							<div className={styles.eventBody}>
								<div className={styles.eventTopline}>
									<strong>{event.title}</strong>
									<span>{formatEventTime(event)}</span>
								</div>
								<p>{formatEventDate(event.start)}</p>
							</div>
						</li>
					))}
				</ol>
			) : null}
		</section>
	);
};

function formatEventTime(event: CalendarEventPreview): string {
	if (event.isAllDay) {
		return "All day";
	}

	const date = new Date(event.start);

	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

function formatEventDate(value: string): string {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return new Intl.DateTimeFormat(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	}).format(date);
}
