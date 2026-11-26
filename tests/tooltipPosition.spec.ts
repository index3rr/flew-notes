import { test, expect } from '@playwright/test';
import { tooltipPosition } from '../src/lib/models/tooltipPosition';
const anchor = { left: 100, right: 140, top: 550, bottom: 590, width: 40, height: 40 };
test('a bottom tooltip flips above its anchor instead of covering it', () => {
	const position = tooltipPosition(
		anchor,
		{ width: 180, height: 70 },
		{ width: 800, height: 600 },
		'bottom',
		8
	);
	expect(position.y + 70).toBeLessThan(anchor.top);
});
test('a top tooltip flips below at the viewport edge', () => {
	const position = tooltipPosition(
		{ ...anchor, top: 5, bottom: 45 },
		{ width: 180, height: 70 },
		{ width: 800, height: 600 },
		'top',
		8
	);
	expect(position.y).toBeGreaterThan(45);
});
test('oversized help uses available space without overlapping its anchor', () => {
	const position = tooltipPosition(
		anchor,
		{ width: 790, height: 900 },
		{ width: 800, height: 600 },
		'bottom',
		8
	);
	expect(position.y + position.maxHeight).toBeLessThan(anchor.top);
});
