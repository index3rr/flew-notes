export type PanelMenuAction = {
	label: string;
	run: () => void | Promise<unknown>;
	disabled?: boolean;
	keepOpen?: boolean;
};
