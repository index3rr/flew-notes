export function words(text: string): string[] {
	return text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

// Compare short phrases rather than isolated common words. This is a review aid: transcription
// misspells names and jargon, so two-word phrases tolerate a misheard word better than three.
export function compareSpeech(
	text: string,
	document: string
): { matched: boolean; outside: boolean } {
	const tokens = words(text);
	if (tokens.length < 3 || !document.trim()) return { matched: false, outside: false };
	const doc = words(document);
	const pairs = new Set<string>();
	for (let i = 0; i < doc.length - 1; i++) pairs.add(`${doc[i]} ${doc[i + 1]}`);
	let matches = 0;
	for (let i = 0; i < tokens.length - 1; i++)
		if (pairs.has(`${tokens[i]} ${tokens[i + 1]}`)) matches++;
	const ratio = matches / (tokens.length - 1);
	return { matched: ratio >= 0.4, outside: ratio < 0.4 };
}

// Whisper fills silence and noise with stock phrases from its training subtitles.
const hallucinations = [
	/^(?:thank you|thanks)(?: (?:so much|very much|for watching|for listening))?[.!]?$/i,
	/^(?:please )?(?:like and )?subscribe.*$/i,
	/^(?:bye|you|okay|so|the end)[.!]?$/i,
	/^\.+$/
];

export function cleanTranscript(raw: string): string {
	let text = raw
		.replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|♪+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	// Collapse decoding loops ("the plan the plan the plan the plan") to one occurrence.
	text = text.replace(/\b((?:\S+\s+){0,7}?\S+?)(?:[\s,.]+\1\b){2,}/gi, '$1');
	if (hallucinations.some((pattern) => pattern.test(text))) return '';
	return text;
}

// Splits microphone audio into utterances at natural pauses, so Whisper never sees a word cut in
// half or a stretch of pure silence (which is what makes it invent text). Debaters who spread
// barely pause, so long stretches are cut at the quietest moment instead.
export type SegmenterOptions = {
	sampleRate: number;
	windowMs?: number;
	preRollMs?: number;
	pauseMs?: number;
	shortPauseMs?: number;
	softMaxMs?: number;
	hardMaxMs?: number;
	overlapMs?: number;
	minVoicedMs?: number;
};

export class Segmenter {
	private readonly window: number;
	private readonly options: Required<SegmenterOptions>;
	private pending: number[] = [];
	private preRoll: Float32Array[] = [];
	private segment: Float32Array[] = [];
	private energies: number[] = [];
	private silentWindows = 0;
	private voicedWindows = 0;
	private floor = 0.002;
	private active = false;

	constructor(options: SegmenterOptions) {
		this.options = {
			windowMs: 30,
			preRollMs: 300,
			pauseMs: 650,
			shortPauseMs: 200,
			softMaxMs: 7000,
			hardMaxMs: 18000,
			overlapMs: 500,
			minVoicedMs: 300,
			...options
		};
		this.window = Math.round((this.options.sampleRate * this.options.windowMs) / 1000);
	}

	private windows(ms: number) {
		return Math.max(1, Math.round(ms / this.options.windowMs));
	}

	private isVoiced(rms: number) {
		const voiced = rms > Math.max(0.006, this.floor * 3);
		// Track the room's noise floor: fall quickly toward quiet, rise slowly between words, and
		// barely at all during speech, so a debater who never pauses isn't mistaken for noise.
		const rise = voiced ? 0.0005 : 0.01;
		this.floor =
			rms < this.floor ? this.floor * 0.8 + rms * 0.2 : this.floor * (1 - rise) + rms * rise;
		return voiced;
	}

	push(samples: Float32Array): Float32Array[] {
		const done: Float32Array[] = [];
		for (const sample of samples) this.pending.push(sample);
		while (this.pending.length >= this.window) {
			const frame = Float32Array.from(this.pending.splice(0, this.window));
			const result = this.process(frame);
			if (result) done.push(result);
		}
		return done;
	}

	private process(frame: Float32Array): Float32Array | null {
		let sum = 0;
		for (const sample of frame) sum += sample * sample;
		const rms = Math.sqrt(sum / frame.length);
		const voiced = this.isVoiced(rms);
		if (!this.active) {
			this.preRoll.push(frame);
			if (this.preRoll.length > this.windows(this.options.preRollMs)) this.preRoll.shift();
			if (!voiced) return null;
			this.active = true;
			this.segment = [...this.preRoll];
			this.energies = this.preRoll.map(() => 0);
			this.preRoll = [];
			this.voicedWindows = 0;
			this.silentWindows = 0;
		} else this.segment.push(frame);
		this.energies.push(rms);
		if (voiced) {
			this.voicedWindows++;
			this.silentWindows = 0;
		} else this.silentWindows++;

		const length = this.segment.length;
		if (this.silentWindows >= this.windows(this.options.pauseMs)) return this.cut(length);
		if (
			length >= this.windows(this.options.softMaxMs) &&
			this.silentWindows >= this.windows(this.options.shortPauseMs)
		)
			return this.cut(length);
		if (length >= this.windows(this.options.hardMaxMs)) {
			// No pause: cut at the quietest window in the last few seconds, keep the rest.
			const searchFrom = length - this.windows(4000);
			let quietest = length - 1;
			for (let i = searchFrom; i < length; i++)
				if (this.energies[i] < this.energies[quietest]) quietest = i;
			return this.cut(quietest + 1);
		}
		return null;
	}

	private cut(at: number): Float32Array | null {
		const resumeAt =
			this.silentWindows < this.windows(this.options.shortPauseMs)
				? Math.max(0, at - this.windows(this.options.overlapMs))
				: at;
		const keep = this.segment.slice(resumeAt);
		const keepEnergies = this.energies.slice(resumeAt);
		// Drop most of the trailing silence; Whisper only needs a little.
		const trailing = Math.max(0, this.silentWindows - this.windows(200));
		const end = at === this.segment.length ? at - trailing : at;
		const audio = this.join(this.segment.slice(0, end));
		const voicedEnough = this.voicedWindows >= this.windows(this.options.minVoicedMs);
		if (keep.length) {
			this.segment = keep;
			this.energies = keepEnergies;
			this.voicedWindows = keep.length;
			this.silentWindows = 0;
		} else {
			this.active = false;
			this.segment = [];
			this.energies = [];
			this.preRoll = [];
		}
		return voicedEnough ? audio : null;
	}

	flush(): Float32Array | null {
		if (!this.active) return null;
		const voicedEnough = this.voicedWindows >= this.windows(this.options.minVoicedMs);
		const audio = this.join(this.segment);
		this.active = false;
		this.segment = [];
		this.energies = [];
		return voicedEnough ? audio : null;
	}

	private join(frames: Float32Array[]) {
		const audio = new Float32Array(frames.reduce((total, frame) => total + frame.length, 0));
		let offset = 0;
		for (const frame of frames) {
			audio.set(frame, offset);
			offset += frame.length;
		}
		return audio;
	}
}

export function formatClock(ms: number) {
	const seconds = Math.max(0, Math.round(ms / 1000));
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// Score short spans independently so a spoken analytic doesn't hide in a long passage of cards.
export function transcriptSpans(
	text: string,
	document: string
): { text: string; outside: boolean }[] {
	if (!document.trim() || words(text).length < 3) return [{ text, outside: false }];
	const common = new Set([
		'the',
		'a',
		'an',
		'and',
		'or',
		'of',
		'to',
		'in',
		'on',
		'is',
		'it',
		'that',
		'this',
		'as',
		'for',
		'by',
		'with',
		'be',
		'are',
		'we',
		'you'
	]);
	const doc = words(document),
		pairs = new Set<string>();
	for (let i = 0; i < doc.length - 1; i++)
		if (!common.has(doc[i]) || !common.has(doc[i + 1])) pairs.add(doc[i] + ' ' + doc[i + 1]);
	return (text.match(/[^.!?;]+[.!?;]*/g) ?? [text]).flatMap((part) => {
		const tokens = part.trim().split(/\s+/),
			supported = tokens.map(() => false);
		const normalized = tokens.flatMap((token, index) =>
			words(token).map((word) => ({ word, index }))
		);
		for (let i = 0; i < normalized.length - 1; i++)
			if (pairs.has(normalized[i].word + ' ' + normalized[i + 1].word)) {
				supported[normalized[i].index] = true;
				supported[normalized[i + 1].index] = true;
			}
		// Tolerate a misheard name inside a card; don't bridge a substantive new phrase.
		const smooth = (value: boolean) => {
			for (let i = 0; i < supported.length; ) {
				const start = i;
				while (i < supported.length && supported[i] === value) i++;
				if (i === start) {
					i++;
					continue;
				}
				if (
					i - start <= 2 &&
					start > 0 &&
					i < supported.length &&
					supported[start - 1] !== value &&
					supported[i] !== value
				)
					for (let j = start; j < i; j++) supported[j] = !value;
			}
		};
		smooth(false);
		smooth(true);
		const spans: { text: string; outside: boolean }[] = [];
		tokens.forEach((token, index) => {
			const outside = !supported[index],
				last = spans.at(-1);
			if (last?.outside === outside) last.text += ' ' + token;
			else spans.push({ text: token, outside });
		});
		return spans.map((span) => ({
			...span,
			outside: span.outside && words(span.text).length >= 3
		}));
	});
}

export function matchesStartPhrase(text: string, phrases: string): boolean {
	const heard = ' ' + words(text).join(' ') + ' ';
	return phrases.split(',').some((phrase) => {
		const normalized = words(phrase).join(' ');
		return !!normalized && heard.includes(' ' + normalized + ' ');
	});
}
export function pacingAllocation(
	remainingMs: number,
	texts: string[],
	fixed: number[],
	weighted: boolean
): number[] {
	const available = Math.max(0, remainingMs - fixed.reduce((a, b) => a + b, 0));
	const weights = texts.map((text, i) =>
		fixed[i] > 0 ? 0 : weighted ? Math.max(1, words(text).length) : 1
	);
	const total = weights.reduce((a, b) => a + b, 0);
	return texts.map(
		(_, i) => fixed[i] || (total ? Math.floor((available * weights[i]) / total) : 0)
	);
}

export function deduplicateTranscript(previous: string, next: string): string {
	const before = words(previous).slice(-20),
		tokens = next.trim().split(/\s+/);
	for (let length = Math.min(before.length, tokens.length, 20); length >= 2; length--) {
		if (before.slice(-length).join(' ') === words(tokens.slice(0, length).join(' ')).join(' '))
			return tokens.slice(length).join(' ');
	}
	return next;
}
