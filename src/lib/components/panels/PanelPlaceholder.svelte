<script lang="ts">
	import PanelHeader from './PanelHeader.svelte';
	import { createDocument } from '$lib/models/autoSave';
	export let name: string;
</script>

<div class="panel-placeholder">
	<PanelHeader
		{name}
		tooltip="No flow is open."
		actions={[{ label: 'New flow', run: () => createDocument() }]}
	/>
</div>
