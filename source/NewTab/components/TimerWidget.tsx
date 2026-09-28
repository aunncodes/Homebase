import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FC, KeyboardEvent } from "react";
import { AlarmClock, Bell, Check, Pause, Play, Plus, Radio, RotateCcw, Sparkles, Square, Timer, TimerReset, Volume2, X } from "lucide-react";
import { getStorage, setStorage, subscribeStorage } from "../../utils/storage";
import { defaultTimer } from "../../types/storage";
import type { HomebaseTimer, TimerSoundId, TimerStatus } from "../../types/storage";
import styles from "../App.module.scss";

const defaultPresets = [5 * 60, 15 * 60, 30 * 60];
const maxTimerSeconds = 99 * 60 * 60 + 59 * 60 + 59;
const fallbackLockKey = "homebase:timer:alarm-owner";

const alarmSounds: Array<{
	id: TimerSoundId;
	url: string;
	icon: typeof Bell;
}> = [
	{
		id: "classic",
		url: "assets/sounds/timer/ringtone-088.mp3",
		icon: Bell,
	},
	{
		id: "digital",
		url: "assets/sounds/timer/ringtone-040.mp3",
		icon: AlarmClock,
	},
	{
		id: "buzzer",
		url: "assets/sounds/timer/ringtone-023.mp3",
		icon: Radio,
	},
	{
		id: "chime",
		url: "assets/sounds/timer/ringtone-030.mp3",
		icon: Sparkles,
	},
];

interface LockManagerLike {
	request(
		name: string,
		options: { ifAvailable: true },
		callback: (lock: unknown | null) => Promise<void> | void
	): Promise<void>;
}

interface FallbackLockValue {
	id: string;
	expiresAt: number;
}

function isTimerStatus(value: unknown): value is TimerStatus {
	return value === "idle" || value === "running" || value === "paused" || value === "ringing";
}

function isTimerSoundId(value: unknown): value is TimerSoundId {
	return value === "classic" || value === "digital" || value === "buzzer" || value === "chime";
}

function normalizeTimer(value: HomebaseTimer): HomebaseTimer {
	const durationMs = Number.isFinite(value?.durationMs) && value.durationMs > 0 ? value.durationMs : defaultTimer.durationMs;
	const remainingMs = Number.isFinite(value?.remainingMs) && value.remainingMs >= 0 ? Math.min(value.remainingMs, durationMs) : durationMs;
	const customPresets = Array.isArray(value?.customPresets)
		? value.customPresets.filter((seconds) => Number.isInteger(seconds) && seconds > 0 && seconds <= maxTimerSeconds).slice(0, 12)
		: [];

	return {
		status: isTimerStatus(value?.status) ? value.status : "idle",
		durationMs,
		remainingMs,
		endAt: typeof value?.endAt === "number" && Number.isFinite(value.endAt) ? value.endAt : null,
		alarmStartedAt: typeof value?.alarmStartedAt === "number" && Number.isFinite(value.alarmStartedAt) ? value.alarmStartedAt : null,
		selectedSoundId: isTimerSoundId(value?.selectedSoundId) ? value.selectedSoundId : defaultTimer.selectedSoundId,
		customPresets,
		updatedAt: typeof value?.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : 0,
	};
}

function formatDuration(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
	}

	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatPreset(seconds: number): string {
	if (seconds % 60 === 0 && seconds / 60 < 100) {
		return String(seconds / 60);
	}

	return formatDuration(seconds * 1000);
}

function parseTimeInput(value: string): number | null {
	const trimmedValue = value.trim();
	if (!trimmedValue || !/^\d{1,2}(?::\d{1,2}){0,2}$/.test(trimmedValue)) {
		return null;
	}

	const parts = trimmedValue.split(":").map(Number);
	let hours = 0;
	let minutes = 0;
	let seconds = 0;

	if (parts.length === 1) {
		seconds = parts[0] ?? 0;
	} else if (parts.length === 2) {
		minutes = parts[0] ?? 0;
		seconds = parts[1] ?? 0;
	} else {
		hours = parts[0] ?? 0;
		minutes = parts[1] ?? 0;
		seconds = parts[2] ?? 0;
	}

	if (minutes >= 60 && parts.length > 1) {
		return null;
	}

	if (seconds >= 60 || hours > 99) {
		return null;
	}

	const totalSeconds = hours * 3600 + minutes * 60 + seconds;
	if (totalSeconds <= 0 || totalSeconds > maxTimerSeconds) {
		return null;
	}

	return totalSeconds;
}

function formatTimeInput(value: string): string {
	const digits = value.replace(/\D/g, "").slice(0, 6);

	if (digits.length <= 2) {
		return digits;
	}

	if (digits.length <= 4) {
		return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
	}

	return `${digits.slice(0, -4)}:${digits.slice(-4, -2)}:${digits.slice(-2)}`;
}

function getTimerProgressColor(progress: number, isRinging: boolean): string {
	if (isRinging) {
		return "var(--danger)";
	}

	const clampedProgress = Math.max(0, Math.min(1, progress));
	const warmPoint = 0.45;

	if (clampedProgress >= warmPoint) {
		const warmAmount = ((1 - clampedProgress) / (1 - warmPoint)) * 100;
		return `color-mix(in srgb, var(--accent) ${(100 - warmAmount).toFixed(2)}%, #d98c45 ${warmAmount.toFixed(2)}%)`;
	}

	const dangerAmount = ((warmPoint - clampedProgress) / warmPoint) * 100;
	return `color-mix(in srgb, #d98c45 ${(100 - dangerAmount).toFixed(2)}%, var(--danger) ${dangerAmount.toFixed(2)}%)`;
}

function shouldBlockTimeKey(event: KeyboardEvent<HTMLInputElement>): boolean {
	return event.key.length === 1 && !/^\d$/.test(event.key) && !event.metaKey && !event.ctrlKey;
}

function readFallbackLock(): FallbackLockValue | null {
	try {
		const rawValue = window.localStorage.getItem(fallbackLockKey);
		return rawValue ? (JSON.parse(rawValue) as FallbackLockValue) : null;
	} catch {
		return null;
	}
}

function writeFallbackLock(id: string): boolean {
	try {
		const nextValue: FallbackLockValue = {
			id,
			expiresAt: Date.now() + 1200,
		};
		window.localStorage.setItem(fallbackLockKey, JSON.stringify(nextValue));
		return readFallbackLock()?.id === id;
	} catch {
		return true;
	}
}

const TimerWidget: FC = () => {
	const [timer, setTimer] = useState<HomebaseTimer>(defaultTimer);
	const [hasLoaded, setHasLoaded] = useState(false);
	const [now, setNow] = useState(Date.now());
	const [editValue, setEditValue] = useState(formatDuration(defaultTimer.durationMs));
	const [presetDraft, setPresetDraft] = useState("");
	const [presetMenuOpen, setPresetMenuOpen] = useState(false);
	const [soundMenuOpen, setSoundMenuOpen] = useState(false);
	const [addingPreset, setAddingPreset] = useState(false);
	const [isAlarmOwner, setIsAlarmOwner] = useState(false);
	const [audioBlocked, setAudioBlocked] = useState(false);
	const timerRootRef = useRef<HTMLDivElement | null>(null);
	const finishingRef = useRef<number | null>(null);
	const previewAudioRef = useRef<HTMLAudioElement | null>(null);
	const primedAlarmAudioRef = useRef<HTMLAudioElement | null>(null);
	const primedAlarmSoundRef = useRef<TimerSoundId | null>(null);
	const skipNextBlurCommitRef = useRef(false);
	const tabIdRef = useRef(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tab-${Date.now()}-${Math.random()}`);

	const saveTimer = (nextTimer: HomebaseTimer): void => {
		setTimer(nextTimer);
		setStorage({ timer: nextTimer }).catch(() => {});
	};

	useEffect(() => {
		getStorage(["timer"])
			.then(({ timer: storedTimer }) => {
				const nextTimer = normalizeTimer(storedTimer);
				setTimer(nextTimer);
				setEditValue(formatDuration(nextTimer.status === "idle" ? nextTimer.durationMs : nextTimer.remainingMs));
			})
			.finally(() => {
				setHasLoaded(true);
			});

		return subscribeStorage("timer", (nextValue) => {
			const nextTimer = normalizeTimer(nextValue);
			setTimer(nextTimer);
			if (nextTimer.status === "idle") {
				setEditValue(formatDuration(nextTimer.durationMs));
			}
		});
	}, []);

	useEffect(() => {
		if (timer.status !== "running") {
			return undefined;
		}

		let animationFrame = 0;
		const tick = (): void => {
			setNow(Date.now());
			animationFrame = window.requestAnimationFrame(tick);
		};

		animationFrame = window.requestAnimationFrame(tick);
		return (): void => {
			window.cancelAnimationFrame(animationFrame);
		};
	}, [timer.status]);

	const remainingMs = timer.status === "running" && timer.endAt ? Math.max(0, timer.endAt - now) : timer.status === "ringing" ? 0 : timer.remainingMs;

	useEffect(() => {
		if (!hasLoaded || timer.status !== "running" || !timer.endAt || remainingMs > 0 || finishingRef.current === timer.endAt) {
			return;
		}

		finishingRef.current = timer.endAt;
		const finishedAt = timer.endAt;
		const nextTimer: HomebaseTimer = {
			...timer,
			status: "ringing",
			remainingMs: 0,
			endAt: null,
			alarmStartedAt: finishedAt,
			updatedAt: Date.now(),
		};
		saveTimer(nextTimer);
	}, [hasLoaded, remainingMs, timer]);

	useEffect(() => {
		if (timer.status !== "ringing") {
			setIsAlarmOwner(false);
			return undefined;
		}

		const tabId = tabIdRef.current;
		const lockManager = (navigator as unknown as { locks?: LockManagerLike }).locks;
		let cancelled = false;
		let retryTimer: number | null = null;
		let releaseLock: (() => void) | null = null;
		let fallbackTimer: number | null = null;

		if (!lockManager) {
			const attemptFallbackLock = (): void => {
				if (cancelled) {
					return;
				}

				const currentLock = readFallbackLock();
				const canClaim = !currentLock || currentLock.id === tabId || currentLock.expiresAt < Date.now();
				const ownsLock = canClaim ? writeFallbackLock(tabId) : false;
				setIsAlarmOwner(ownsLock);
				fallbackTimer = window.setTimeout(attemptFallbackLock, ownsLock ? 600 : 300);
			};

			attemptFallbackLock();
			return (): void => {
				cancelled = true;
				if (fallbackTimer) {
					window.clearTimeout(fallbackTimer);
				}
				if (readFallbackLock()?.id === tabId) {
					window.localStorage.removeItem(fallbackLockKey);
				}
				setIsAlarmOwner(false);
			};
		}

		const attemptLock = (): void => {
			if (cancelled) {
				return;
			}

			void lockManager
				.request("homebase-timer-alarm", { ifAvailable: true }, async (lock) => {
					if (!lock || cancelled) {
						return;
					}

					setIsAlarmOwner(true);
					await new Promise<void>((resolve) => {
						releaseLock = resolve;
					});
					setIsAlarmOwner(false);
				})
				.catch(() => {})
				.finally(() => {
					if (!cancelled && !releaseLock) {
						retryTimer = window.setTimeout(attemptLock, 250);
					}
				});
		};

		attemptLock();

		return (): void => {
			cancelled = true;
			if (retryTimer) {
				window.clearTimeout(retryTimer);
			}
			releaseLock?.();
			setIsAlarmOwner(false);
		};
	}, [timer.status, timer.alarmStartedAt]);

	useEffect(() => {
		if (!isAlarmOwner || timer.status !== "ringing") {
			setAudioBlocked(false);
			return undefined;
		}

		const selectedSound = alarmSounds.find((sound) => sound.id === timer.selectedSoundId) ?? alarmSounds[0]!;
		const soundSource = selectedSound.url;
		let audio = primedAlarmSoundRef.current === selectedSound.id ? primedAlarmAudioRef.current : null;

		if (!audio) {
			audio = new Audio(soundSource);
			primedAlarmAudioRef.current = audio;
			primedAlarmSoundRef.current = selectedSound.id;
		}

		audio.loop = true;
		audio.preload = "auto";
		audio.volume = 0.92;
		let cancelled = false;

		const playSynced = (): void => {
			if (cancelled) {
				return;
			}

			if (timer.alarmStartedAt && Number.isFinite(audio.duration) && audio.duration > 0) {
				const elapsedSeconds = Math.max(0, (Date.now() - timer.alarmStartedAt) / 1000);
				audio.currentTime = elapsedSeconds % audio.duration;
			}

			audio
				.play()
				.then(() => {
					setAudioBlocked(false);
				})
				.catch(() => {
					setAudioBlocked(true);
				});
		};

		if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
			playSynced();
		} else {
			audio.addEventListener("loadedmetadata", playSynced, { once: true });
		}

		const retryOnInteraction = (): void => {
			if (audio.paused) {
				playSynced();
			}
		};

		document.addEventListener("pointerdown", retryOnInteraction, true);
		document.addEventListener("keydown", retryOnInteraction, true);

		return (): void => {
			cancelled = true;
			document.removeEventListener("pointerdown", retryOnInteraction, true);
			document.removeEventListener("keydown", retryOnInteraction, true);
			audio.pause();
			audio.loop = false;
			try {
				audio.currentTime = 0;
			} catch {
				// Metadata may not be available yet.
			}
		};
	}, [isAlarmOwner, timer.alarmStartedAt, timer.selectedSoundId, timer.status]);

	useEffect(() => {
		const closeMenus = (event: PointerEvent): void => {
			if (timerRootRef.current?.contains(event.target as Node)) {
				return;
			}

			setPresetMenuOpen(false);
			setSoundMenuOpen(false);
			setAddingPreset(false);
		};

		document.addEventListener("pointerdown", closeMenus);
		return (): void => {
			document.removeEventListener("pointerdown", closeMenus);
		};
	}, []);

	useEffect(
		() => (): void => {
			previewAudioRef.current?.pause();
			primedAlarmAudioRef.current?.pause();
		},
		[]
	);

	const allPresets = useMemo(() => [...defaultPresets, ...timer.customPresets], [timer.customPresets]);
	const isExpanded = timer.status !== "idle";
	const progress = timer.durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / timer.durationMs)) : 0;
	const circumference = 2 * Math.PI * 116;
	const dashOffset = circumference * (1 - progress);
	const progressColor = getTimerProgressColor(progress, timer.status === "ringing");
	const rootClassName = `${styles.timerDock} ${isExpanded ? styles.timerDockExpanded : ""} ${timer.status === "ringing" ? styles.timerDockRinging : ""} ${audioBlocked ? styles.timerAudioBlocked : ""}`;
	const ringStyle = {
		"--timer-ring-circumference": circumference,
		"--timer-ring-offset": dashOffset,
		"--timer-progress": progressColor,
	} as CSSProperties;

	const commitEditValue = (): number | null => {
		const seconds = parseTimeInput(editValue);
		if (!seconds) {
			setEditValue(formatDuration(timer.durationMs));
			return null;
		}

		const durationMs = seconds * 1000;
		if (durationMs !== timer.durationMs || timer.status !== "idle") {
			saveTimer({
				...timer,
				status: "idle",
				durationMs,
				remainingMs: durationMs,
				endAt: null,
				alarmStartedAt: null,
				updatedAt: Date.now(),
			});
		}
		setEditValue(formatDuration(durationMs));
		return durationMs;
	};

	const primeAlarmAudio = (soundId: TimerSoundId): void => {
		const selectedSound = alarmSounds.find((sound) => sound.id === soundId) ?? alarmSounds[0]!;
		const source = selectedSound.url;

		if (primedAlarmAudioRef.current && primedAlarmSoundRef.current !== soundId) {
			primedAlarmAudioRef.current.pause();
		}

		const audio = primedAlarmSoundRef.current === soundId && primedAlarmAudioRef.current ? primedAlarmAudioRef.current : new Audio(source);
		primedAlarmAudioRef.current = audio;
		primedAlarmSoundRef.current = soundId;
		audio.loop = false;
		audio.preload = "auto";
		audio.volume = 0.001;

		try {
			audio.currentTime = 0;
		} catch {
			// Metadata may not be available yet.
		}

		audio
			.play()
			.then(() => {
				setAudioBlocked(false);
				window.setTimeout(() => {
					if (primedAlarmAudioRef.current !== audio) {
						return;
					}

					audio.pause();
					audio.volume = 0.92;
					try {
						audio.currentTime = 0;
					} catch {
						// Metadata may not be available yet.
					}
				}, 90);
			})
			.catch(() => {
				setAudioBlocked(true);
			});
	};

	const startTimer = (): void => {
		if (timer.status === "paused") {
			primeAlarmAudio(timer.selectedSoundId);
			const nextTimer: HomebaseTimer = {
				...timer,
				status: "running",
				endAt: Date.now() + timer.remainingMs,
				updatedAt: Date.now(),
			};
			saveTimer(nextTimer);
			return;
		}

		if (timer.status !== "idle") {
			return;
		}

		const durationMs = commitEditValue();
		if (!durationMs) {
			return;
		}

		primeAlarmAudio(timer.selectedSoundId);

		const nextTimer: HomebaseTimer = {
			...timer,
			status: "running",
			durationMs,
			remainingMs: durationMs,
			endAt: Date.now() + durationMs,
			alarmStartedAt: null,
			updatedAt: Date.now(),
		};
		saveTimer(nextTimer);
	};

	const pauseTimer = (): void => {
		if (timer.status !== "running") {
			return;
		}

		const pausedRemainingMs = timer.endAt ? Math.max(0, timer.endAt - Date.now()) : timer.remainingMs;
		saveTimer({
			...timer,
			status: "paused",
			remainingMs: pausedRemainingMs,
			endAt: null,
			updatedAt: Date.now(),
		});
	};

	const resetTimer = (): void => {
		const nextTimer: HomebaseTimer = {
			...timer,
			status: "idle",
			remainingMs: timer.durationMs,
			endAt: null,
			alarmStartedAt: null,
			updatedAt: Date.now(),
		};
		saveTimer(nextTimer);
		setEditValue(formatDuration(timer.durationMs));
		setPresetMenuOpen(false);
		setSoundMenuOpen(false);
	};

	const selectPreset = (seconds: number): void => {
		if (timer.status === "running" || timer.status === "ringing") {
			return;
		}

		const durationMs = seconds * 1000;
		saveTimer({
			...timer,
			status: "idle",
			durationMs,
			remainingMs: durationMs,
			endAt: null,
			alarmStartedAt: null,
			updatedAt: Date.now(),
		});
		setEditValue(formatDuration(durationMs));
		setPresetMenuOpen(false);
	};

	const addPreset = (): void => {
		const seconds = parseTimeInput(presetDraft);
		if (!seconds || defaultPresets.includes(seconds) || timer.customPresets.includes(seconds)) {
			setPresetDraft("");
			return;
		}

		const customPresets = [...timer.customPresets, seconds].sort((a, b) => a - b).slice(0, 12);
		saveTimer({
			...timer,
			customPresets,
			updatedAt: Date.now(),
		});
		setPresetDraft("");
		setAddingPreset(false);
	};

	const deletePreset = (seconds: number): void => {
		saveTimer({
			...timer,
			customPresets: timer.customPresets.filter((preset) => preset !== seconds),
			updatedAt: Date.now(),
		});
	};

	const previewSound = (soundId: TimerSoundId): void => {
		const selectedSound = alarmSounds.find((sound) => sound.id === soundId);
		if (!selectedSound) {
			return;
		}

		previewAudioRef.current?.pause();
		primedAlarmAudioRef.current?.pause();

		const source = selectedSound.url;
		const audio = new Audio(source);
		audio.preload = "auto";
		audio.volume = 0.72;
		previewAudioRef.current = audio;
		primedAlarmAudioRef.current = audio;
		primedAlarmSoundRef.current = soundId;

		audio
			.play()
			.then(() => {
				setAudioBlocked(false);
			})
			.catch(() => {
				setAudioBlocked(true);
			});
	};

	const selectSound = (soundId: TimerSoundId): void => {
		saveTimer({
			...timer,
			selectedSoundId: soundId,
			updatedAt: Date.now(),
		});
		previewSound(soundId);
	};

	const onMainInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
		if (event.key === "Enter") {
			event.preventDefault();
			skipNextBlurCommitRef.current = true;
			startTimer();
			event.currentTarget.blur();
			return;
		}

		if (event.key === "Escape") {
			setEditValue(formatDuration(timer.durationMs));
			event.currentTarget.blur();
			return;
		}

		if (shouldBlockTimeKey(event)) {
			event.preventDefault();
		}
	};

	const onMainInputBlur = (): void => {
		if (skipNextBlurCommitRef.current) {
			skipNextBlurCommitRef.current = false;
			return;
		}

		commitEditValue();
	};

	const onPresetInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
		if (event.key === "Enter") {
			event.preventDefault();
			addPreset();
			return;
		}

		if (event.key === "Escape") {
			setAddingPreset(false);
			setPresetDraft("");
			return;
		}

		if (shouldBlockTimeKey(event)) {
			event.preventDefault();
		}
	};

	return (
		<div ref={timerRootRef} className={rootClassName} aria-live={timer.status === "ringing" ? "assertive" : "off"}>
			<div className={styles.timerIdleLayer} aria-hidden={isExpanded}>
				<Timer size={21} strokeWidth={2.2} />
				<input
					className={styles.timerCompactInput}
					value={editValue}
					disabled={isExpanded}
					inputMode="numeric"
					pattern="[0-9:]*"
					aria-label="Timer duration"
					onChange={(event) => setEditValue(formatTimeInput(event.target.value))}
					onBlur={onMainInputBlur}
					onFocus={(event) => event.currentTarget.select()}
					onKeyDown={onMainInputKeyDown}
				/>
				<button className={`${styles.timerIconButton} ${styles.timerPrimaryButton}`} type="button" aria-label="Start timer" title="Start" onClick={startTimer}>
					<Play size={19} fill="currentColor" />
				</button>
				<button
					className={`${styles.timerIconButton} ${presetMenuOpen ? styles.timerIconButtonActive : ""}`}
					type="button"
					aria-label="Timer presets"
					title="Presets"
					onClick={() => {
						setPresetMenuOpen((current) => !current);
						setSoundMenuOpen(false);
					}}
				>
					<TimerReset size={19} />
				</button>
				<button
					className={`${styles.timerIconButton} ${soundMenuOpen ? styles.timerIconButtonActive : ""}`}
					type="button"
					aria-label="Timer sound"
					title="Sound"
					onClick={() => {
						setSoundMenuOpen((current) => !current);
						setPresetMenuOpen(false);
					}}
				>
					<Volume2 size={19} />
				</button>
			</div>

			<div className={styles.timerExpandedLayer} aria-hidden={!isExpanded}>
				<div className={styles.timerTopActions}>
					<button
						className={`${styles.timerIconButton} ${presetMenuOpen ? styles.timerIconButtonActive : ""}`}
						type="button"
						aria-label="Timer presets"
						title="Presets"
						onClick={() => {
							setPresetMenuOpen((current) => !current);
							setSoundMenuOpen(false);
						}}
					>
						<TimerReset size={19} />
					</button>
					<button
						className={`${styles.timerIconButton} ${soundMenuOpen ? styles.timerIconButtonActive : ""}`}
						type="button"
						aria-label="Timer sound"
						title="Sound"
						onClick={() => {
							setSoundMenuOpen((current) => !current);
							setPresetMenuOpen(false);
						}}
					>
						<Volume2 size={19} />
					</button>
				</div>

				<div className={styles.timerFace} style={ringStyle}>
					<svg className={styles.timerRing} viewBox="0 0 260 260" aria-hidden="true">
						<circle className={styles.timerRingTrack} cx="130" cy="130" r="116" />
						<circle className={styles.timerRingProgress} cx="130" cy="130" r="116" />
					</svg>
					<div className={styles.timerTime}>{formatDuration(remainingMs)}</div>
				</div>

				<div className={styles.timerMainControls}>
					{timer.status === "ringing" ? (
						<button className={`${styles.timerControlButton} ${styles.timerStopButton}`} type="button" aria-label="Dismiss alarm" title="Dismiss" onClick={resetTimer}>
							<Square size={22} fill="currentColor" />
						</button>
					) : (
						<>
							<button
								className={`${styles.timerControlButton} ${styles.timerPrimaryControl}`}
								type="button"
								aria-label={timer.status === "running" ? "Pause timer" : "Resume timer"}
								title={timer.status === "running" ? "Pause" : "Resume"}
								onClick={timer.status === "running" ? pauseTimer : startTimer}
							>
								{timer.status === "running" ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}
							</button>
							<button className={styles.timerControlButton} type="button" aria-label="Reset timer" title="Reset" onClick={resetTimer}>
								<RotateCcw size={21} />
							</button>
						</>
					)}
				</div>
			</div>

			<div className={`${styles.timerPopover} ${styles.timerPresetPopover} ${presetMenuOpen ? styles.timerPopoverOpen : ""}`} aria-hidden={!presetMenuOpen}>
				<div className={styles.timerPresetGrid}>
					{allPresets.map((seconds) => {
						const isCustom = timer.customPresets.includes(seconds);
						const isSelected = Math.round(timer.durationMs / 1000) === seconds;

						return (
							<div key={seconds} className={styles.timerPresetWrap}>
								<button
									className={`${styles.timerPresetButton} ${isSelected ? styles.timerPresetButtonActive : ""}`}
									type="button"
									disabled={timer.status === "running" || timer.status === "ringing"}
									aria-label={`Set timer to ${formatDuration(seconds * 1000)}`}
									title={formatDuration(seconds * 1000)}
									onClick={() => selectPreset(seconds)}
								>
									<span className={styles.timerPresetMiniRing} aria-hidden="true" />
									<span>{formatPreset(seconds)}</span>
								</button>
								{isCustom ? (
									<button className={styles.timerPresetDelete} type="button" aria-label="Delete preset" title="Delete" onClick={() => deletePreset(seconds)}>
										<X size={12} />
									</button>
								) : null}
							</div>
						);
					})}
					<button
						className={`${styles.timerPresetButton} ${styles.timerPresetAddButton} ${addingPreset ? styles.timerPresetAddButtonActive : ""}`}
						type="button"
						aria-label="Add timer preset"
						title="Add preset"
						onClick={() => setAddingPreset((current) => !current)}
					>
						{addingPreset ? <X size={20} /> : <Plus size={20} />}
					</button>
				</div>
				<div className={`${styles.timerPresetEditor} ${addingPreset ? styles.timerPresetEditorOpen : ""}`}>
					<div>
						<Timer size={17} aria-hidden="true" />
						<input
							value={presetDraft}
							inputMode="numeric"
							pattern="[0-9:]*"
							placeholder="00:00"
							aria-label="Custom timer preset"
							onChange={(event) => setPresetDraft(formatTimeInput(event.target.value))}
							onKeyDown={onPresetInputKeyDown}
						/>
						<button type="button" aria-label="Save preset" title="Save" onClick={addPreset}>
							<Check size={17} />
						</button>
					</div>
				</div>
			</div>

			<div className={`${styles.timerPopover} ${styles.timerSoundPopover} ${soundMenuOpen ? styles.timerPopoverOpen : ""}`} aria-hidden={!soundMenuOpen}>
				{alarmSounds.map((sound) => {
					const SoundIcon = sound.icon;
					return (
						<button
							key={sound.id}
							className={`${styles.timerSoundButton} ${timer.selectedSoundId === sound.id ? styles.timerSoundButtonActive : ""}`}
							type="button"
							aria-label={`Select ${sound.id} alarm sound`}
							title={sound.id}
							onClick={() => selectSound(sound.id)}
						>
							<SoundIcon size={20} />
							<span className={styles.timerSoundWave} aria-hidden="true">
								<i />
								<i />
								<i />
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
};

export { TimerWidget };
