
const pattern = /^\s*svelte-ignore\s+([\s\S]+)\s*$/m;

export function extract_svelte_ignore(text: string): string[] {
	const match = pattern.exec(text);
	return match ? match[1].split(/[^\S]/).map(x => x.trim()).filter(Boolean) : [];
}
