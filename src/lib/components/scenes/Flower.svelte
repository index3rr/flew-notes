<script lang="ts">
	export let hover = false;
</script>

<div class="top palette-accent-secondary" class:hover role="img">
	<svg viewBox="0 0 100 100" fill="none">
		<!-- hollow circle -->
		<circle cx="38" cy="50" r="20" stroke-width="8" />
		<!-- arrow shaft extending right from circle -->
		<line x1="58" y1="50" x2="82" y2="50" stroke-width="8" stroke-linecap="round" />
		<!-- arrowhead -->
		<path d="M70 70L92 50L70 30" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
	</svg>
</div>

<style>
	.top {
		width: 0;
		height: 0;
		/* circle center is at 38% x, 50% y in the viewBox */
		transform-origin: 38% 50%;
		position: absolute;
		z-index: -1;
		animation: rotate 8s linear infinite;
		pointer-events: none;
		transition: scale var(--transition-speed) ease-in-out;
	}
	@keyframes rotate {
		from {
			rotate: 0deg;
		}
		to {
			rotate: 360deg;
		}
	}
	.top.hover {
		scale: 1.1;
	}
	svg {
		--size: 32.4rem;
		width: var(--size);
		height: var(--size);
		margin-left: calc(-0.38 * var(--size));
		margin-top: calc(-0.5 * var(--size));
		stroke: var(--this-text);
	}
</style>
