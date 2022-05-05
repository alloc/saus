import { Node } from 'acorn';
import * as code_red from 'code-red';

export const parse = (source: string): Node => code_red.parse(source, {
	sourceType: 'module',
	ecmaVersion: 12,
	locations: true
});
