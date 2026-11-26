type Rect = {
	left: number;
	right: number;
	top: number;
	bottom: number;
	width: number;
	height: number;
};
export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';
export function tooltipPosition(
	anchor: Rect,
	size: { width: number; height: number },
	viewport: { width: number; height: number },
	preferred: string,
	gap: number
) {
	const space = {
		top: anchor.top - gap * 2,
		bottom: viewport.height - anchor.bottom - gap * 2,
		left: anchor.left - gap * 2,
		right: viewport.width - anchor.right - gap * 2
	};
	const order: TooltipSide[] =
		preferred === 'top'
			? ['top', 'bottom', 'right', 'left']
			: preferred === 'left'
			? ['left', 'right', 'top', 'bottom']
			: preferred === 'right'
			? ['right', 'left', 'top', 'bottom']
			: ['bottom', 'top', 'right', 'left'];
	const fits = (side: TooltipSide) =>
		space[side] >= (side === 'left' || side === 'right' ? size.width : size.height);
	const side = order.find(fits) ?? (space.top > space.bottom ? 'top' : 'bottom');
	const maxHeight = Math.max(
		0,
		side === 'top' || side === 'bottom' ? space[side] : viewport.height - gap * 2
	);
	const height = Math.min(size.height, maxHeight);
	const x =
		side === 'left'
			? anchor.left - size.width - gap
			: side === 'right'
			? anchor.right + gap
			: anchor.left + (anchor.width - size.width) / 2;
	const y =
		side === 'top'
			? anchor.top - height - gap
			: side === 'bottom'
			? anchor.bottom + gap
			: anchor.top + (anchor.height - height) / 2;
	return {
		x: Math.max(gap, Math.min(x, viewport.width - size.width - gap)),
		y: Math.max(gap, Math.min(y, viewport.height - height - gap)),
		maxHeight
	};
}
