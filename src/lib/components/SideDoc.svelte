<script lang="ts">
	import { settings } from '$lib/models/settings';
	import { sideDocText } from '$lib/models/store';
</script>

<div class="document">
	<textarea
		class="text"
		placeholder="type notes here"
		aria-label="Notes"
		bind:value={$sideDocText}
		class:customScrollbar={settings.data.customScrollbar.value}
	/>
</div>

<style>
	.document {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
	}
	.text {
		height: 100%;
		width: 100%;
		outline: none;
		margin: 0;
		overflow-y: auto;
		line-height: 1.5em;
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		box-sizing: border-box;
		resize: none;
		padding: var(--padding);
		padding-bottom: calc(var(--main-height) * 0.6);
	}
	.text::placeholder {
		color: var(--text-weak);
	}
</style>
