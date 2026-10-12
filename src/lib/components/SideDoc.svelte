<script lang="ts">
	import { settings } from '$lib/models/settings';
	import { sideDocText } from '$lib/models/store';
	export let editable = true;
</script>

<div class="document">
	<textarea class="text" placeholder={editable ? 'type notes here' : 'Notes are not editable when a flow is not open'} bind:value={$sideDocText} readonly={!editable} class:readonly={!editable} class:customScrollbar={settings.data.customScrollbar.value}/>
</div>

<style>
	.document {
		background: var(--background);
		width: 100%;
		height: 100%;
		border-radius: var(--border-radius);
		box-sizing: border-box;
	}
	.text {
		height: 100%;
		width: 100%;

		outline: none;
		margin: none;

		overflow-y: scroll;

		line-height: 1.5em;
		font-size: 0.9rem;

		background: none;
		border: none;
		color: inherit;
		text-decoration: inherit;
		box-sizing: border-box;

		resize: none;
		padding: var(--padding);
		padding-bottom: calc(var(--main-height) * 0.6);
	}

	.text::placeholder {
		color: var(--text-weak);
	}
	.text.readonly { color: var(--text-weak); cursor: default; }
</style>
