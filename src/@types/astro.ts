import type * as babel from '@babel/core';
import type { AstroComponentFactory, Metadata } from '../runtime/server';

export interface AstroComponentMetadata {
	displayName: string;
	hydrate?: 'load' | 'idle' | 'visible' | 'media' | 'only';
	hydrateArgs?: any;
	componentUrl?: string;
	componentExport?: { value: string; namespace?: boolean };
}

/**
 * Astro global available in all contexts in .astro files
 *
 * [Astro reference](https://docs.astro.build/reference/api-reference/#astro-global)
 */
export interface AstroGlobal extends AstroGlobalPartial {
	/** Canonical URL of the current page. If the [site](https://docs.astro.build/en/reference/configuration-reference/#site) config option is set, its origin will be the origin of this URL.
	 *
	 * [Astro reference](https://docs.astro.build/en/reference/api-reference/#astrocanonicalurl)
	 */
	canonicalURL: URL;
	/** Parameters passed to a dynamic page generated using [getStaticPaths](https://docs.astro.build/en/reference/api-reference/#getstaticpaths)
	 *
	 * Example usage:
	 * ```astro
	 * ---
	 * export async function getStaticPaths() {
	 *    return [
	 *     { params: { id: '1' } },
	 *   ];
	 * }
	 *
	 * const { id } = Astro.params;
	 * ---
	 * <h1>{id}</h1>
	 * ```
	 *
	 * [Astro reference](https://docs.astro.build/en/reference/api-reference/#params)
	 */
	params: Params;
	/** List of props passed to this component
	 *
	 * A common way to get specific props is through [destructuring](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment), ex:
	 * ```typescript
	 * const { name } = Astro.props
	 * ```
	 *
	 * [Astro reference](https://docs.astro.build/en/core-concepts/astro-components/#component-props)
	 */
	props: Record<string, number | string | any>;
	/** Information about the current request. This is a standard [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) object
	 *
	 * For example, to get a URL object of the current URL, you can use:
	 * ```typescript
	 * const url = new URL(Astro.request.url);
	 * ```
	 *
	 * [Astro reference](https://docs.astro.build/en/reference/api-reference/#astrorequest)
	 */
	request: Request;
	/** Redirect to another page (**SSR Only**)
	 *
	 * Example usage:
	 * ```typescript
	 * if(!isLoggedIn) {
	 *   return Astro.redirect('/login');
	 * }
	 * ```
	 *
	 * [Astro reference](https://docs.astro.build/en/guides/server-side-rendering/#astroredirect)
	 */
	redirect(path: string): Response;
	/**
	 * The <Astro.self /> element allows a component to reference itself recursively.
	 *
	 * [Astro reference](https://docs.astro.build/en/guides/server-side-rendering/#astroself)
	 */
	self: AstroComponentFactory;
	/** Utility functions for modifying an Astro component’s slotted children
	 *
	 * [Astro reference](https://docs.astro.build/en/reference/api-reference/#astroslots)
	 */
	slots: Record<string, true | undefined> & {
		/**
		 * Check whether content for this slot name exists
		 *
		 * Example usage:
		 * ```typescript
		 *	if (Astro.slots.has('default')) {
		 *   // Do something...
		 *	}
		 * ```
		 *
		 * [Astro reference](https://docs.astro.build/en/reference/api-reference/#astroslots)
		 */
		has(slotName: string): boolean;
		/**
		 * Asychronously renders this slot and returns HTML
		 *
		 * Example usage:
		 * ```astro
		 * ---
		 * let html: string = '';
		 * if (Astro.slots.has('default')) {
		 *   html = await Astro.slots.render('default')
		 * }
		 * ---
		 * <Fragment set:html={html} />
		 * ```
		 *
		 * [Astro reference](https://docs.astro.build/en/reference/api-reference/#astroslots)
		 */
		render(slotName: string, args?: any[]): Promise<string>;
	};
}

export interface AstroGlobalPartial {
	/**
	 * @deprecated since version 0.24. See the {@link https://astro.build/deprecated/resolve upgrade guide} for more details.
	 */
	resolve(path: string): string;
	/** @deprecated since version 0.26. Use [Astro.glob()](https://docs.astro.build/en/reference/api-reference/#astroglob) instead. */
	fetchContent(globStr: string): Promise<any[]>;
	/**
	 * Fetch local files into your static site setup
	 *
	 * Example usage:
	 * ```typescript
	 * const posts = await Astro.glob('../pages/post/*.md');
	 * ```
	 *
	 * [Astro reference](https://docs.astro.build/en/reference/api-reference/#astroglob)
	 */
	glob(globStr: `${any}.astro`): Promise<ComponentInstance[]>;
	glob<T extends Record<string, any>>(globStr: `${any}.md`): Promise<MarkdownInstance<T>[]>;
	glob<T extends Record<string, any>>(globStr: string): Promise<T[]>;
	/**
	 * Returns a [URL](https://developer.mozilla.org/en-US/docs/Web/API/URL) object built from the [site](https://docs.astro.build/en/reference/configuration-reference/#site) config option
	 *
	 * If `site` is undefined, the URL object will instead be built from `localhost`
	 *
	 * [Astro reference](https://docs.astro.build/en/reference/api-reference/#astrosite)
	 */
	site: URL;
}

export type AsyncRendererComponentFn<U> = (
	Component: any,
	props: any,
	children: string | undefined,
	metadata?: AstroComponentMetadata
) => Promise<U>;

/** Generic interface for a component (Astro, Svelte, React, etc.) */
export interface ComponentInstance {
	$$metadata: Metadata;
	default: AstroComponentFactory;
	css?: string[];
	getStaticPaths?: (options: GetStaticPathsOptions) => GetStaticPathsResult;
}

export interface MarkdownInstance<T extends Record<string, any>> {
	frontmatter: T;
	file: string;
	url: string | undefined;
	Content: AstroComponentFactory;
	getHeaders(): Promise<MarkdownHeader[]>;
	default: () => Promise<{
		metadata: MarkdownMetadata;
		frontmatter: MarkdownContent;
		$$metadata: Metadata;
		default: AstroComponentFactory;
	}>;
}

/**
 * getStaticPaths() options
 * Docs: https://docs.astro.build/reference/api-reference/#getstaticpaths
 */ export interface GetStaticPathsOptions {
	paginate?: PaginateFunction;
	rss?: (...args: any[]) => any;
}

export type GetStaticPathsItem = { params: Params; props?: Props };
export type GetStaticPathsResult = GetStaticPathsItem[];

export interface JSXTransformConfig {
	/** Babel presets */
	presets?: babel.PluginItem[];
	/** Babel plugins */
	plugins?: babel.PluginItem[];
}

export type JSXTransformFn = (options: {
	mode: string;
	ssr: boolean;
}) => Promise<JSXTransformConfig>;

export interface MarkdownHeader {
	depth: number;
	slug: string;
	text: string;
}

export interface MarkdownMetadata {
	headers: MarkdownHeader[];
	source: string;
	html: string;
}

/**
 * The `content` prop given to a Layout
 * https://docs.astro.build/guides/markdown-content/#markdown-layouts
 */
export interface MarkdownContent {
	[key: string]: any;
	astro: MarkdownMetadata;
}

/**
 * paginate() Options
 * Docs: https://docs.astro.build/guides/pagination/#calling-the-paginate-function
 */
export interface PaginateOptions {
	/** the number of items per-page (default: `10`) */
	pageSize?: number;
	/** key: value object of page params (ex: `{ tag: 'javascript' }`) */
	params?: Params;
	/** object of props to forward to `page` result */
	props?: Props;
}

export type PaginateFunction = (data: [], args?: PaginateOptions) => GetStaticPathsResult;

export type Params = Record<string, string | number | undefined>;

export type Props = Record<string, unknown>;

type Body = string;

export interface EndpointOutput<Output extends Body = Body> {
	body: Output;
}

export interface EndpointHandler {
	[method: string]: (params: any, request: Request) => EndpointOutput | Response;
}

export interface AstroRenderer {
	/** Name of the renderer. */
	name: string;
	/** Import entrypoint for the client/browser renderer. */
	clientEntrypoint?: string;
	/** Import entrypoint for the server/build/ssr renderer. */
	serverEntrypoint: string;
	/** JSX identifier (e.g. 'react' or 'solid-js') */
	jsxImportSource?: string;
	/** Babel transform options */
	jsxTransformOptions?: JSXTransformFn;
}

export interface SSRLoadedRenderer extends AstroRenderer {
	ssr: {
		check: AsyncRendererComponentFn<boolean>;
		renderToStaticMarkup: AsyncRendererComponentFn<{
			html: string;
		}>;
	};
}

export interface SSRElement {
	props: Record<string, any>;
	children: string;
}

export interface SSRMetadata {
	renderers: SSRLoadedRenderer[];
	pathname: string;
}

export interface SSRResult {
	styles: Set<SSRElement>;
	scripts: Set<SSRElement>;
	links: Set<SSRElement>;
	createAstro(
		Astro: AstroGlobalPartial,
		props: Record<string, any>,
		slots: Record<string, any> | null
	): AstroGlobal;
	resolve: (s: string) => Promise<string>;
	_metadata: SSRMetadata;
}
