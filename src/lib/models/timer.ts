type RunningState = {
	name: 'running';
	startTime: number;
	ogTime: number;
};

type PausedState = {
	name: 'paused';
};

export type TimeState = RunningState | PausedState;

export type TimerState = {
	resetTime: number;
	time: number;
	state: TimeState;
};

export type SpeechTimerState = {
	resetTimeIndex: number;
	time: number;
	state: TimeState;
};

export type TimerSpeech = {
	name: string;
	time: number;
	secondary: boolean;
};

import { writable } from 'svelte/store';

// The speech the speech timer is on, so panels can follow the round without their own selector.
export const currentSpeech = writable<{
	name: string;
	secondary: boolean;
	// This speech and the ones after it, so CX and prep can resolve to the speech they lead into.
	upcoming: string[];
} | null>(null);

// Read on demand (not a store) because it changes every frame while the timer runs.
export const speechClock = { name: '', time: 0, resetTime: 0, running: false };
export function speechElapsed(): number {
	return Math.max(0, speechClock.resetTime - speechClock.time);
}
