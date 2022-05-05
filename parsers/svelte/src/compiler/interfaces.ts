import { AssignmentExpression, Node, Program } from 'estree';

interface BaseNode {
	start: number;
	end: number;
	type: string;
	children?: TemplateNode[];
	[prop_name: string]: any;
}

export interface Fragment extends BaseNode {
	type: 'Fragment';
	children: TemplateNode[];
}

export interface Text extends BaseNode {
	type: 'Text';
	data: string;
}

export interface MustacheTag extends BaseNode {
	type: 'MustacheTag' | 'RawMustacheTag';
	expression: Node;
}

export interface Comment extends BaseNode {
	type: 'Comment';
	data: string;
	ignores: string[];
}

export interface ConstTag extends BaseNode {
	type: 'ConstTag';
	expression: AssignmentExpression;
}

interface DebugTag extends BaseNode {
	type: 'DebugTag';
	identifiers: Node[]
}

export type DirectiveType = 'Action'
| 'Animation'
| 'Binding'
| 'Class'
| 'StyleDirective'
| 'EventHandler'
| 'Let'
| 'Ref'
| 'Transition';

interface BaseDirective extends BaseNode {
	type: DirectiveType;
	name: string;
}

interface BaseExpressionDirective extends BaseDirective {
	type: DirectiveType;
	expression: null | Node;
	name: string;
	modifiers: string[];
}

export interface Element extends BaseNode {
	type: 'InlineComponent' | 'SlotTemplate' | 'Title' | 'Slot' | 'Element' | 'Head' | 'Options' | 'Window' | 'Body';
	attributes: Array<BaseDirective | Attribute | SpreadAttribute>;
	name: string;
}

export interface Attribute extends BaseNode {
	type: 'Attribute';
	name: string;
	value: any[];
}

export interface SpreadAttribute extends BaseNode {
	type: 'Spread';
	expression: Node;
}

export interface Transition extends BaseExpressionDirective {
	type: 'Transition';
	intro: boolean;
	outro: boolean;
}

export type Directive = BaseDirective | BaseExpressionDirective | Transition;

export type TemplateNode = Text
| ConstTag
| DebugTag
| MustacheTag
| BaseNode
| Element
| Attribute
| SpreadAttribute
| Directive
| Transition
| Comment;

export interface Script extends BaseNode {
	type: 'Script';
	context: string;
	content: Program;
}

export interface Style extends BaseNode {
	type: 'Style';
	attributes: any[]; // TODO
	children: any[]; // TODO add CSS node types
	content: {
		start: number;
		end: number;
		styles: string;
	};
}

export interface Ast {
	html: TemplateNode;
	css?: Style;
	instance?: Script;
	module?: Script;
}

export interface ParserOptions {
	filename?: string;
	customElement?: boolean;
}
