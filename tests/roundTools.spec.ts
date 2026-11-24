import { test, expect } from '@playwright/test';
import {
	computeCoverage,
	documentSpeeches,
	nextSpeech,
	speechForTimer
} from '../src/lib/models/coverage';
import {
	blocksFromHtml,
	matchPage,
	pageName,
	shortenTag,
	speechDocActions,
	speechFromFileName
} from '../src/lib/models/speechDoc';
import {
	cleanTranscript,
	Segmenter,
	matchesStartPhrase,
	pacingAllocation,
	transcriptSpans
} from '../src/lib/models/transcript';
import type { Nodes } from '../src/lib/models/node';

const aff = ['1AC', '1NC', '2AC', '2NC/1NR', '1AR', '2NR', '2AR'];
const neg = ['1NC', '2AC', '2NC/1NR', '1AR', '2NR', '2AR'];

// Build a flow from nested [content, children] pairs; '>' marks an extension, '' an empty spacer.
type Spec = [string, Spec[]?];
function build(pages: { name: string; invert: boolean; boxes: Spec[] }[]): Nodes {
	const nodes: Record<string, unknown> = {
		root: { value: { tag: 'root' }, level: -1, parent: 'root', children: [] as string[] }
	};
	let next = 0;
	const add = (spec: Spec, parent: string, flowId: string, level: number): string => {
		const id = `box${next++}`;
		const [content, children = []] = spec;
		const value: Record<string, unknown> = { tag: 'box', content, flowId };
		if (content === '>') Object.assign(value, { content: '', isExtension: true });
		if (content === '_') Object.assign(value, { content: '', empty: true });
		nodes[id] = { value, level, parent, children: [] };
		(nodes[id] as { children: string[] }).children = children.map((child) =>
			add(child, id, flowId, level + 1)
		);
		return id;
	};
	for (const page of pages) {
		const id = `flow${next++}`;
		nodes[id] = {
			value: {
				tag: 'flow',
				content: page.name,
				invert: page.invert,
				columns: page.invert ? neg : aff
			},
			level: 0,
			parent: 'root',
			children: []
		};
		(nodes.root as { children: string[] }).children.push(id);
		(nodes[id] as { children: string[] }).children = page.boxes.map((box) => add(box, id, id, 1));
	}
	return nodes as unknown as Nodes;
}

test.describe('coverage', () => {
	// Mirrors a real 2AC: three hospital DA arguments went unanswered.
	const nodes = build([
		{
			name: 'Hospitals',
			invert: true,
			boxes: [
				['mitigating shortages now', [['already dead', [['priced in']]]]],
				['rural hospitals k2 ag'],
				['farmers feed the world'],
				['private insurance saves money', [['>']]]
			]
		},
		{
			name: 'Health',
			invert: false,
			boxes: [
				['private insurance detrimental'],
				['plan saves money', [['rationing', [['ext'], ['UK sees these issues']]]]]
			]
		}
	]);

	test('lists what the next speech must answer, including skipped extensions', () => {
		const coverage = computeCoverage(nodes, '2AC');
		const hospitals = coverage.pages.find((page) => page.name === 'Hospitals')!;
		expect(hospitals.toAnswer.map((item) => item.content)).toEqual([
			'rural hospitals k2 ag',
			'farmers feed the world',
			'private insurance saves money'
		]);
		expect(hospitals.answered).toBe(1);
	});

	test('finds arguments the other side dropped and stops listing them once extended', () => {
		const coverage = computeCoverage(nodes, '2AC');
		const health = coverage.pages.find((page) => page.name === 'Health')!;
		expect(health.dropped.map((item) => item.content)).toEqual(['private insurance detrimental']);
		expect(health.dropped[0].extended).toBe(false);

		const extended = build([
			{
				name: 'Health',
				invert: false,
				boxes: [['private insurance detrimental', [['>', [['ext']]]]]]
			}
		]);
		const page = computeCoverage(extended, '2AC').pages[0];
		expect(page.dropped[0].extended).toBe(true);
	});

	test('a grouped reply answers every card it groups', () => {
		const grouped = build([
			{
				name: 'Hospitals',
				invert: true,
				boxes: [['k2 ag', [['no link']]], ['farmers feed the world']]
			}
		]);
		const [first, second] = grouped.root.children.flatMap((id) => grouped[id]!.children);
		const reply = grouped[first]!.children[0];
		(grouped[reply]!.value as { respondsTo?: string[] }).respondsTo = [second];
		const page = computeCoverage(grouped, '2AC').pages[0];
		expect(page.toAnswer).toEqual([]);
		expect(page.answered).toBe(2);
	});

	test('short lines carry the argument they answer as context', () => {
		const coverage = computeCoverage(nodes, '2NC');
		const health = coverage.pages.find((page) => page.name === 'Health')!;
		const ext = health.toAnswer.find((item) => item.content === 'ext')!;
		expect(ext.root).toBe('plan saves money');
	});

	test('speech order and timer mapping', () => {
		expect(documentSpeeches(nodes)).toEqual(aff);
		expect(nextSpeech(nodes)).toBe('1AR');
		expect(speechForTimer(['CX', '1NC', 'CX', '2AC'], aff)).toBe('1NC');
		expect(speechForTimer(['2NC', 'CX', '1NR'], aff)).toBe('2NC/1NR');
	});
});

test.describe('speech documents', () => {
	const html = `<h1>Speech 2AC</h1><h3>Cyber DA — 2AC</h3><h4>1. Medical equipment is at low risk for cyberattacks.</h4><p>card</p><h4>2. No catastrophic cyber attacks.</h4>
<h3>AT: Pharma — 2AC</h3><h4>We have to pay twice for drugs now — even right leaning sources agree &amp; more</h4>
<h2>Framing — 2AC</h2><h3>Watson EXT — 2AC</h3><p>analytics</p>`;

	test('reads blocks and tags from headings without rendering HTML', () => {
		const blocks = blocksFromHtml(html);
		expect(blocks.map((block) => block.title)).toEqual([
			'Cyber DA — 2AC',
			'AT: Pharma — 2AC',
			'Watson EXT — 2AC'
		]);
		expect(blocks[1].tags[0]).toContain('right leaning sources agree & more');
		expect(blocks[2]).toMatchObject({ group: 'Framing — 2AC', tags: ['Watson EXT — 2AC'] });
	});

	test('matches blocks to pages and names new ones', () => {
		const pages = [
			{ id: 'a', name: 'Cyber' },
			{ id: 'b', name: 'Pharma' },
			{ id: 'c', name: 'Framing' }
		] as { id: never; name: string }[];
		const [cyber, pharma, watson] = blocksFromHtml(html);
		expect(matchPage(cyber, pages)).toBe('a');
		expect(matchPage(pharma, pages)).toBe('b');
		expect(matchPage(watson, pages)).toBe('c');
		expect(matchPage({ title: 'AT: Doctors — 2AC', group: '', tags: [] }, pages)).toBeNull();
		expect(pageName({ title: 'AT: Doctors DA — 2AC', group: '', tags: [] })).toBe('Doctors DA');
		expect(speechFromFileName('Speech 2ac 10-31 10-00AM.docx', aff)).toBe('2AC');
		expect(
			shortenTag('We have to pay twice for drugs now — even right leaning sources agree')
		).toBe('We have to pay twice for drugs now');
	});

	test('puts tags in the speech column on existing and new pages', () => {
		const nodes = build([{ name: 'Cyber', invert: true, boxes: [['healthcare vulnerable']] }]);
		const flowId = nodes.root.children[0];
		const [cyber, pharma] = blocksFromHtml(html);
		const { actions, pages } = speechDocActions(
			nodes,
			'2AC',
			[
				{ block: cyber, target: flowId, newName: 'Cyber' },
				{ block: pharma, target: 'new', newName: 'Pharma' }
			],
			[
				{ name: 'aff', columns: aff, invert: false },
				{ name: 'neg', columns: neg, invert: true }
			],
			true
		);
		expect(pages).toBe(1);
		const added = actions.filter((action) => action.tag === 'add') as {
			value: { tag: string; content: string; empty?: boolean; invert?: boolean };
		}[];
		// One spacer for column 1 of the existing neg page, then both tags.
		expect(added.slice(0, 3).map((action) => [action.value.content, !!action.value.empty])).toEqual(
			[
				['', true],
				['1. Medical equipment is at low risk for cyberattacks.', false],
				['2. No catastrophic cyber attacks.', false]
			]
		);
		const newPage = added.find((action) => action.value.tag === 'flow')!;
		expect(newPage.value).toMatchObject({ content: 'Pharma', invert: true });
		expect(added.at(-1)!.value.content).toBe('We have to pay twice for drugs now');
	});
});

test.describe('transcript', () => {
	test('drops stock hallucinations and collapses decoding loops', () => {
		expect(cleanTranscript(' Thank you. ')).toBe('');
		expect(cleanTranscript('[BLANK_AUDIO]')).toBe('');
		expect(cleanTranscript('the plan solves the plan solves the plan solves the plan solves')).toBe(
			'the plan solves'
		);
		expect(cleanTranscript('No no, extinction outweighs (music) on probability')).toBe(
			'No no, extinction outweighs on probability'
		);
	});

	test('cuts audio at pauses and never emits silence', () => {
		const rate = 16000;
		const segmenter = new Segmenter({ sampleRate: rate });
		const tone = (seconds: number) =>
			Float32Array.from({ length: seconds * rate }, (_, i) => 0.3 * Math.sin(i / 5));
		const silence = (seconds: number) => new Float32Array(seconds * rate);
		const out = [
			...segmenter.push(silence(2)),
			...segmenter.push(tone(1.5)),
			...segmenter.push(silence(1)),
			...segmenter.push(tone(2)),
			...segmenter.push(silence(1))
		];
		expect(out).toHaveLength(2);
		for (const segment of out) {
			expect(segment.length / rate).toBeGreaterThan(1.4);
			expect(segment.length / rate).toBeLessThan(2.8);
		}
		expect(segmenter.flush()).toBeNull();
	});

	test('cuts a long run without pauses before Whisper’s 30 second window', () => {
		const rate = 16000;
		const segmenter = new Segmenter({ sampleRate: rate });
		const out = segmenter.push(
			Float32Array.from({ length: 40 * rate }, (_, i) => 0.3 * Math.sin(i / 5))
		);
		expect(out.length).toBeGreaterThanOrEqual(2);
		for (const segment of out) expect(segment.length / rate).toBeLessThanOrEqual(18.1);
	});
});

test('timer phrases match complete customized words and pacing respects fixed allocations', () => {
	expect(matchesStartPhrase('Ready? Let us begin.', 'start, let us begin')).toBe(true);
	expect(matchesStartPhrase('The beginning of the argument', 'begin')).toBe(false);
	expect(matchesStartPhrase('start', ', ,')).toBe(false);
	expect(pacingAllocation(60000, ['one', 'one two three', ':10'], [0, 0, 10000], true)).toEqual([
		12500, 37500, 10000
	]);
	expect(pacingAllocation(5000, ['one', ':10'], [0, 10000], false)).toEqual([0, 10000]);
});

test('analytics are classified separately from adjoining read evidence', () => {
	const spans = transcriptSpans(
		'Economic growth solves poverty. Also their evidence was written before the latest crash.',
		'Economic growth solves poverty.'
	);
	expect(spans).toEqual([
		{ text: 'Economic growth solves poverty.', outside: false },
		{ text: 'Also their evidence was written before the latest crash.', outside: true }
	]);
});

test('overlapping recognition windows do not duplicate a repeated prefix', async () => {
	const { deduplicateTranscript } = await import('../src/lib/models/transcript');
	expect(
		deduplicateTranscript(
			'The plan solves food insecurity.',
			'food insecurity. Now their evidence is outdated.'
		)
	).toBe('Now their evidence is outdated.');
	expect(deduplicateTranscript('No, this is new.', 'No, this is a different argument.')).toBe(
		'No, this is a different argument.'
	);
});

test('document alignment separates an analytic without punctuation and tolerates a misheard card word', () => {
	const spans = transcriptSpans(
		'Economic growth solves poverty and their evidence was written before the crash',
		'Economic growth solves poverty'
	);
	expect(spans).toEqual([
		{ text: 'Economic growth solves poverty', outside: false },
		{ text: 'and their evidence was written before the crash', outside: true }
	]);
	expect(
		transcriptSpans(
			'Economic growth completely solves poverty',
			'Economic growth solves poverty'
		).every((span) => !span.outside)
	).toBe(true);
});
