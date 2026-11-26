<script lang="ts">
	// The standard panel text field (AGENTS.md "Form fields"), so panels stop restyling inputs.
	export let value = '';
	export let placeholder = '';
	export let ariaLabel: string;
	export let multiline = false;
	export let rows = 3;
	export let readonly = false;
	export let disabled = false;
	export let fill = false;
	export let maxlength: number | undefined = undefined;
	export let spellcheck = true;
</script>

{#if multiline}
	<textarea
		class="panel-field"
		class:fill
		{disabled}
		bind:value
		{placeholder}
		{rows}
		{readonly}
		{maxlength}
		{spellcheck}
		aria-label={ariaLabel}
		on:input
		on:keydown
		on:focus
	/>
{:else}
	<input
		class="panel-field"
		class:fill
		{disabled}
		bind:value
		{placeholder}
		{readonly}
		{maxlength}
		{spellcheck}
		aria-label={ariaLabel}
		on:input
		on:keydown
		on:focus
	/>
{/if}

<style>
	.panel-field {
		display: block;
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		padding: var(--padding);
		border: none;
		border-radius: var(--border-radius);
		outline: none;
		background: var(--background-indent);
		color: var(--text);
		font: inherit;
		line-height: 1.5em;
		transition: background var(--transition-speed);
	}
	.panel-field:focus {
		background: var(--background-active);
	}
	.panel-field::placeholder {
		color: var(--text-weak);
	}
	.panel-field.fill {
		flex: 1;
		height: 100%;
		min-height: 0;
		resize: none;
	}
	textarea.panel-field {
		resize: vertical;
	}
</style>
