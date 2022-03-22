import { URLSearchParams } from 'url';
import { ComponentType } from 'react';
import * as vite from 'vite';
import { AbortSignal } from 'node-abort-controller';

declare class HttpRedirect {
    readonly location: string;
    constructor(location: string);
}

declare type RenderedFile$1 = {
    id: string;
    data: any;
    mime: string;
};
interface RenderedPage$1 {
    id: string;
    html: string;
    /** Files generated whilst rendering. */
    files: RenderedFile$1[];
    /** Modules required by the client. */
    modules: Set<ClientModule>;
    /** Assets required by the client. */
    assets: Map<string, ClientAsset>;
}
declare type ClientAsset = ArrayBufferLike | HttpRedirect;
interface ClientModule {
    id: string;
    text: string;
    debugText?: string;
    imports?: string[];
    exports?: string[];
}
/**
 * For entry chunks, keys are import statements.
 * For vendor chunks, keys are generated file names.
 * For route chunks, keys are dev URLs.
 */
interface ClientModuleMap {
    [key: string]: ClientModule;
}
declare type RenderPageOptions$1 = {
    timeout?: number;
    renderStart?: (url: string) => void;
    renderFinish?: (url: string, error: Error | null, page?: RenderedPage$1 | null) => void;
};

/**
 * Write an array of rendered pages to disk. Shared modules are deduplicated.
 *
 * Returns a map of file names to their size in kilobytes. This object can be
 * passed to the `printFiles` function.
 */
declare function writePages(pages: ReadonlyArray<RenderedPage$1 | null>, outDir: string, inlinedAssets?: Record<string, string>): Record<string, number>;
/**
 * Print a bunch of files kind of like Vite does.
 *
 * @param logger The object responsible for printing
 * @param files File names (relative to the `outDir`) mapped to their size in kilobytes
 * @param outDir The directory (relative to your project root) where all given files reside
 * @param sizeLimit Highlight files larger than the given number of kilobytes (default: `500`)
 */
declare function printFiles(logger: {
    info(arg: string): void;
}, files: Record<string, number>, outDir: string, chunkLimit?: number, debugBase?: string | undefined): void;

/**
 * If you want to cache modules in-memory and serve them, this function
 * will be helpful. It returns the URL pathname that your server should
 * respond to for each module.
 */
declare function getModuleUrl(mod: string | ClientModule, base?: string | number): string;

declare class ParsedUrl {
    readonly searchParams: URLSearchParams;
    readonly path: string;
    constructor(path: string, searchParams: URLSearchParams);
    get search(): string;
    toString(): string;
    startsWith(prefix: string): boolean;
    slice(start: number, end?: number): ParsedUrl;
}

declare function renderPage(pageUrl: string | ParsedUrl, { timeout, renderStart, renderFinish }?: RenderPageOptions$1): Promise<RenderedPage$1 | null>;

declare function getKnownPaths(options?: {
    noDebug?: boolean;
}): Promise<string[]>;

declare function ssrImport<T = ModuleExports>(id: string, isRequire?: boolean): Promise<T>;
declare type Promisable$6<T> = T | PromiseLike<T>;
declare type ModuleExports = Record<string, any>;
declare type ModuleLoader<T = ModuleExports> = (exports: T, module?: {
    exports: T;
}) => Promisable$6<void>;
/** Define a SSR module with async loading capability */
declare const __d: <T = ModuleExports>(id: string, loader: ModuleLoader<T>) => ModuleLoader<T>;

/**
 * Inlined assets are encoded with Base64.
 */
declare const inlinedAssets: Record<string, string>;

declare type CacheControl = {
    /** The string used to identify this entry */
    readonly key: string;
    /**
     * The last loaded value that is now expired.
     */
    oldValue?: any;
    /**
     * Number of seconds until this entry is reloaded on next request.
     * Once expired, the loaded value remains in the cache until another
     * value is loaded.
     */
    maxAge: number;
    /**
     * Set a timeout that aborts the loading of this entry unless its
     * promise resolves first.
     */
    setTimeout: (secs: number) => AbortSignal;
};

declare type Promisable$5<T> = T | PromiseLike<T>;
/** Load state if missing from the global cache */
declare const getCachedState: {
    <State = any>(cacheKey: string): Promise<State | undefined> | undefined;
    <State_1 = any>(cacheKey: string, loader: (cacheControl: CacheControl) => Promisable$5<State_1>): Promise<State_1>;
};

interface StateModule<T = any, Args extends any[] = any[]> {
    id: string;
    load(...args: Args): Promise<T>;
    bind(...args: Args): StateModule<T, []>;
    get(...args: Args): T;
}

interface SourceMap {
    version: number;
    file?: string;
    sources: string[];
    sourcesContent?: string[];
    names: string[];
    mappings: string;
}

declare class ImporterSet extends Set<CompiledModule> {
    private _dynamics?;
    add(importer: CompiledModule, isDynamic?: boolean): this;
    delete(importer: CompiledModule): boolean;
    hasDynamic(importer: CompiledModule): boolean;
}

declare type Script = {
    code: string;
    map?: SourceMap;
};
/** This property exists on linked Node.js module instances */
declare const kLinkedModule: unique symbol;
/**
 * A Node.js-compatible module that's been linked into the
 * `node_modules` of the project.
 */
interface LinkedModule {
    id: string;
    imports: Set<LinkedModule>;
    importers: Set<CompiledModule | LinkedModule>;
    [kLinkedModule]: true;
}
interface CompiledModule extends Script {
    id: string;
    env: Record<string, any>;
    imports: Set<CompiledModule | LinkedModule>;
    importers: ImporterSet;
    exports?: Promise<any>;
    /**
     * Compiled modules referenced by a relative import are included
     * in the same `package` as their importer.
     *
     * If undefined, this package never imported a module (or was imported
     * by another module) using a relative path.
     */
    package?: Set<CompiledModule>;
    [kLinkedModule]?: undefined;
}
declare type ModuleMap = Record<string, CompiledModule | undefined> & {
    __compileQueue?: Promise<void>;
};
declare type LinkedModuleMap = Record<string, LinkedModule | undefined>;
declare type RequireAsync = (id: string, importer?: string | null, isDynamic?: boolean) => Promise<any>;

/**
 * For caching compiled files on disk by the hash of their
 * original contents. The cache cleans up unused files before
 * the process exits cleanly. The cache can be locked to
 * prevent clean up in the case of unexpected errors.
 */
declare class CompileCache {
    readonly name: string;
    private root;
    used: Set<string>;
    constructor(name: string, root: string);
    /** When true, the cache won't delete unused files on process exit. */
    locked: boolean;
    get path(): string;
    key(code: string, name?: string): string;
    get(key: string): string | null;
    set(key: string, code: string): string;
}

declare type Deferred<T> = PromiseLike<T> & {
    resolve: undefined extends T ? (value?: T | PromiseLike<T>) => void : (value: T | PromiseLike<T>) => void;
    reject: (error?: any) => void;
    promise: Promise<T>;
};

declare type HtmlContext = {
    htmlProcessors?: HtmlProcessorMap;
    processHtml?: MergedHtmlProcessor;
};
declare type HtmlProcessorState = {
    page: RenderedPage;
    config: RuntimeConfig;
    /**
     * Only exists in SSR bundle environment.
     *
     * By adding an asset URL to this `Set`, it will be loaded
     * or pre-fetched by the rendered page.
     */
    assets?: Set<string>;
};
declare type Promisable$4<T> = T | PromiseLike<T>;
declare type HtmlPlugin<State = HtmlProcessorState> = {
    name: string;
    process: HtmlProcessor<State>;
};
declare type HtmlProcessor<State = HtmlProcessorState> = (html: string, state: State) => Promisable$4<string | null | void>;
declare type HtmlProcessorArray<State = HtmlProcessorState> = Array<HtmlPlugin<State> | HtmlProcessor<State>>;
declare type HtmlProcessorMap<State = HtmlProcessorState> = {
    pre: HtmlProcessorArray<State>;
    default: HtmlProcessorArray<State>;
    post: HtmlProcessorArray<State>;
};
declare type MergedHtmlProcessor = (html: string, page: RenderedPage, timeout?: number) => Promise<string>;

declare type ImportDescriptorMap = {
    [source: string]: string | (string | [name: string, alias: string])[];
};

/** A generated client module */
interface Client {
    id: string;
    code: string;
    map?: ExistingRawSourceMap | null;
}
interface ExistingRawSourceMap {
    file?: string;
    mappings: string;
    names: string[];
    sourceRoot?: string;
    sources: string[];
    sourcesContent?: string[];
    version: number;
}
/** JSON state provided by the renderer and made available to the client */
declare type ClientState = Record<string, any> & {
    rootId?: string;
    routePath: string;
    routeParams: RouteParams;
    error?: any;
};
interface ClientDescription {
    /**
     * Define `import` statements to be included.
     *
     * The keys are modules to import from, and the values are either the
     * identifier used for the default export or an array of identifiers
     * used for named exports.
     */
    imports: ImportDescriptorMap;
    /**
     * Hydration code to run on the client.
     *
     * Executed inside a function with this type signature:
     *
     *     async (content: unknown, request: RenderRequest) => void
     *
     * Custom imports are available as well.
     */
    onHydrate: string;
}

declare type Promisable$3<T> = T | PromiseLike<T>;
declare type RenderRequest<State extends object = ClientState, Params extends RouteParams = RouteParams> = {
    path: string;
    file: string;
    query?: string;
    module: RouteModule;
    state: State;
    params: Params;
};
declare type DocumentHook = (this: RenderApi, html: string, request: RenderRequest, config: RuntimeConfig) => Promisable$3<void>;
declare type RenderApi = {
    emitFile(id: string, mime: string, data: BufferLike): void;
};
declare class Renderer<T = any> {
    readonly getBody: (module: RouteModule, request: RenderRequest) => Promisable$3<T | null | void>;
    readonly stringifyBody: (body: T) => Promisable$3<string>;
    readonly stringifyHead: (head: T) => Promisable$3<string>;
    readonly onDocument: DocumentHook;
    readonly client?: ClientDescription | undefined;
    readonly start?: number | undefined;
    api: RenderCall<T>;
    test: (path: string) => boolean;
    getHead?: (request: RenderRequest) => Promisable$3<T>;
    didRender?: (request: RenderRequest) => Promisable$3<void>;
    constructor(route: string, getBody: (module: RouteModule, request: RenderRequest) => Promisable$3<T | null | void>, stringifyBody: (body: T) => Promisable$3<string>, stringifyHead: (head: T) => Promisable$3<string>, onDocument?: DocumentHook, client?: ClientDescription | undefined, start?: number | undefined);
    renderDocument(request: RenderRequest): Promise<string | null>;
}
/**
 * The public API returned by `render` call.
 *
 * It lets the user define an optional `<head>` element
 * and/or post-render isomorphic side effect.
 */
declare class RenderCall<T = string | null | void> {
    protected _renderer: Renderer<T>;
    constructor(_renderer: Renderer<T>);
    /**
     * Render the `<head>` subtree of the HTML document. The given render
     * function only runs in an SSR environment, and it's invoked after
     * the `<body>` is pre-rendered.
     */
    head(getHead: (request: RenderRequest) => T | Promise<T>): this;
    /**
     * Run an isomorphic function after render. In SSR, it runs after the
     * HTML string is rendered. On the client, it runs post-hydration.
     */
    then(didRender: (request: RenderRequest) => Promisable$3<void>): void;
}

declare type Promisable$2<T> = T | PromiseLike<T>;
/**
 * Values configurable from the `saus.render` module defined in
 * your Vite config.
 */
declare type RenderModule = {
    /** Hooks that run before the renderer */
    beforeRenderHooks: BeforeRenderHook[];
    /** The renderers for specific routes */
    renderers: Renderer[];
    /** The renderer used when no route is matched */
    defaultRenderer?: Renderer;
};
declare type BeforeRenderHook = {
    (request: RenderRequest<any, any>): Promisable$2<void>;
    match?: (path: string) => RouteParams | undefined;
    start?: number;
};

declare type RuntimeHook = (config: RuntimeConfig) => void;

interface TestFramework {
    /** Dev server plugins */
    plugins?: Plugin[];
    /** A file was changed. */
    onFileChange?: () => void;
    /** The dev server was restarted. */
    onRestart?: () => void;
}

declare type RenderPageFn = (url: string | ParsedUrl, options?: RenderPageOptions) => Promise<RenderedPage | null>;

declare type ServePageFn = (url: string) => Promise<ServedPage | undefined>;
declare type ServedPage = {
    error?: any;
    body?: any;
    headers?: [string, string | number][];
};

interface VirtualModule {
    id: string;
    code: string | PromiseLike<string>;
    moduleSideEffects?: boolean | 'no-treeshake';
    map?: SourceMap;
}
interface ModuleProvider {
    modules: ReadonlyMap<string, VirtualModule>;
    addModule(module: VirtualModule): VirtualModule;
}

declare class PublicFile {
    name: string;
    private bufferPath;
    constructor(name: string, bufferPath: string);
    get buffer(): Buffer;
    set buffer(buffer: Buffer);
    /** The `buffer` with UTF-8 encoding */
    get text(): string;
    set text(text: string);
    /** The file extension taken from `this.name` but without a leading dot */
    get suffix(): string;
    set suffix(suffix: string);
    /** Skip copying this file. */
    skip(): void;
}

declare type Plugin = vite.Plugin;
declare type ResolvedConfig = Omit<vite.ResolvedConfig, 'saus'> & {
    readonly saus: Readonly<SausConfig>;
};
interface SausBundleConfig {
    /**
     * Path to the module bundled by the `saus bundle` command.
     * It should import `saus/bundle` (and optionally `saus/paths`)
     * to render pages on-demand and/or ahead-of-time.
     * @default null
     */
    entry?: string | false | null;
    /**
     * For serverless functions, you'll want to set this to `"worker"`.
     * @default "script"
     */
    type?: 'script' | 'worker';
    /**
     * Set `build.target` for the SSR bundle.
     * @default "node14"
     */
    target?: vite.BuildOptions['target'];
    /**
     * The module format of the generated SSR bundle.
     * @default "cjs"
     */
    format?: 'esm' | 'cjs';
    /**
     * Expose a debug version of your site, with sourcemaps and unminified
     * production files.
     */
    debugBase?: string;
    /**
     * Minify the SSR bundle.
     * @default false
     */
    minify?: boolean;
    /**
     * Force certain imports to be isolated such that every page rendered
     * will use a separate instance of the resolved module. This option is
     * useful when a dependency has global state, but you still want to
     * use parallel rendering. Your project's local modules are isolated
     * by default.
     */
    isolate?: (string | RegExp)[];
    /**
     * Control how the map of client modules is stored by the server.
     *
     * For the `"inline"` setting, client modules are inlined into the bundle
     * and encoded with Base64 if needed. This increases the bundle size
     * considerably.
     *
     * For the `"external"` setting, client modules are written to their own files
     * and loaded with `fs.readFileSync` on-demand.
     *
     * @default "inline"
     */
    moduleMap?: 'external' | 'inline';
}
interface SausConfig {
    /**
     * Path to the module containing `route` calls.
     */
    routes: string;
    /**
     * Path to the module containing `render` calls.
     */
    render: string;
    /**
     * How many pages can be rendered at once.
     * @default os.cpus().length
     */
    renderConcurrency?: number;
    /**
     * Any `<link>` tags produced by renderers are stripped in favor of injecting
     * them through the page's state module via the `applyHead` client API. This
     * can drastically reduce the elapsed time before `<script>` tags are executed.
     * Always measure performance with and without this option, to see if you
     * actually need it.
     * @experimental
     */
    stripLinkTags?: boolean;
    /**
     * Improve the TTFP (time to first paint) of each page by injecting `modulepreload`
     * tags after the first paint. The default behavior includes these tags in the
     * pre-rendered HTML.
     * @experimental
     */
    delayModulePreload?: boolean;
    /**
     * Assume this page path when using the default route in build mode
     * and SSR mode.
     * @default "/404"
     */
    defaultPath?: string;
    /**
     * The number of seconds each HTML processor has before a timeout
     * error is thrown.
     *
     * Set to `0` to disable timeouts.
     * @default 10
     */
    htmlTimeout?: number;
    /**
     * Options for the SSR bundle generated by `saus bundle`.
     */
    bundle?: SausBundleConfig;
    /**
     * Renderer packages need to add their `defineClient` object
     * to this array, so the SSR bundler can prepare build artifacts
     * used by the SSR bundle to generate client modules.
     */
    clients?: ClientDescription[];
}
declare module 'vite' {
    interface UserConfig {
        saus?: Partial<SausConfig>;
        /**
         * You can't use `saus test` command until this is defined.
         */
        testFramework?: (config: UserConfig) => Promise<TestFramework | {
            default: TestFramework;
        }>;
        /**
         * Filter the stack trace from an SSR error so there's
         * less noise from files you don't care about.
         */
        filterStack?: (source: string) => boolean;
    }
    interface ViteDevServer {
        /** Produce an HTML document for a given URL. */
        renderPage: RenderPageFn;
        /** Like `renderPage` but with a result tuned for an HTTP response. */
        servePage: ServePageFn;
        /** Files produced by a renderer and cached by a `servePage` call. */
        servedFiles: Record<string, RenderedFile>;
        moduleMap: ModuleMap;
        linkedModules: LinkedModuleMap;
        require: RequireAsync;
        ssrRequire: RequireAsync;
    }
    interface Plugin {
        /**
         * Provide plugin hooks specific to Saus.
         *
         * If a function is given, it gets called whenever the Saus context
         * is created or replaced. When `saus dev` is used, it's also called
         * when the routes/renderers are updated.
         */
        saus?: SausPlugin | ((context: SausContext) => Promisable$1<SausPlugin | void>);
    }
}
interface UserConfig extends Omit<vite.UserConfig, 'build'> {
    saus: SausConfig;
    build?: BuildOptions;
}
interface BuildOptions extends vite.BuildOptions {
    /** Skip certain pages when pre-rendering. */
    skip?: (pagePath: string) => boolean;
    /** Use the bundle from last `saus build` run. */
    cached?: boolean;
    /** The bundle's mode (usually `development` or `production`) */
    mode?: string;
    /**
     * Limit the number of worker threads.  \
     * Use `0` to run on the main thread only.
     */
    maxWorkers?: number;
    /** Use this bundle instead of generating one. */
    bundlePath?: string;
    /** Include `sourcesContent` is cached bundle sourcemap. */
    sourcesContent?: boolean;
}
declare type Promisable$1<T> = T | Promise<T>;
/**
 * Saus plugins are returned by the `saus` hook of a Vite plugin.
 */
interface SausPlugin {
    /** Used for debugging. If undefined, the Vite plugin name is used. */
    name?: string;
    /**
     * Transform files from the `publicDir` when the `copyPublicDir`
     * plugin is active in the project.
     */
    transformPublicFile?: (file: PublicFile) => Promisable$1<void>;
    /**
     * Define virtual modules and/or return an array of side-effectful module
     * identifiers to be imported by the SSR bundle.
     */
    fetchBundleImports?: (modules: ModuleProvider) => Promisable$1<string[] | null | void>;
    /**
     * Called before the SSR bundle is written to disk.
     * This is only called when `saus bundle` is used.
     */
    onWriteBundle?: (bundle: {
        path: string;
        code: string;
        map?: SourceMap;
    }) => void;
    /**
     * Called before rendered pages are written to disk.
     * This is only called when `saus build` is used.
     */
    onWritePages?: (pages: RenderedPage$1[]) => void;
}

interface SausContext extends RenderModule, RoutesModule, HtmlContext {
    root: string;
    plugins: readonly SausPlugin[];
    logger: vite.Logger;
    config: ResolvedConfig;
    configPath: string | undefined;
    configHooks: ConfigHookRef[];
    userConfig: vite.UserConfig;
    /**
     * Use this instead of `this.config` when an extra Vite build is needed,
     * or else you risk corrupting the Vite plugin state.
     */
    resolveConfig: (command: 'build' | 'serve', inlineConfig?: vite.UserConfig) => Promise<ResolvedConfig>;
    /** The cache for compiled SSR modules */
    compileCache: CompileCache;
    /** The URL prefix for all pages */
    basePath: string;
    /** The `saus.defaultPath` option from Vite config */
    defaultPath: string;
    /** Path to the routes module */
    routesPath: string;
    /** Track which files are responsible for state modules */
    stateModulesByFile: Record<string, string[]>;
    /** Load a page if not cached */
    getCachedPage: typeof getCachedState;
    getCachedPages: () => Promise<RenderedPage[]>;
    /** Clear any matching pages (loading or loaded) */
    clearCachedPages: (filter?: string | ((key: string) => boolean)) => void;
    /** Path to the render module */
    renderPath: string;
    /** For checking if a page is outdated since rendering began */
    reloadId: number;
    /** Wait to serve pages until hot reloading completes */
    reloading?: Deferred<void>;
    /** Exists in dev mode only */
    server?: vite.ViteDevServer;
    /** Used by the `generateRoute` function in dev mode */
    ssrRequire?: RequireAsync;
}

interface RouteModule extends Record<string, any> {
}
declare type RouteLoader<T extends object = RouteModule> = () => Promise<T>;
declare type RouteParams = Record<string, string>;
declare type HasOneKey<T> = [string & keyof T] extends infer Keys ? Keys extends [infer Key] ? Key extends any ? [string & keyof T] extends [Key] ? 1 : 0 : never : never : never;
declare type StaticPageParams<Params extends object> = 1 extends HasOneKey<Params> ? string | number : readonly (string | number)[];
declare type InferRouteProps<T extends object> = T extends ComponentType<infer Props> ? Props : Record<string, any>;
declare type Promisable<T> = T | PromiseLike<T>;
/** A value that defines which state modules are needed by a route. */
declare type RouteInclude = StateModule<any, []>[] | ((url: ParsedUrl, params: RouteParams) => StateModule<any, []>[]);
interface RouteConfig<Module extends object = RouteModule, Params extends object = RouteParams> {
    /**
     * Define which pages should be statically generated by providing
     * their path params.
     */
    paths?: () => Promisable<readonly StaticPageParams<Params>[]>;
    /**
     * Load the page state for this route. This state exists during hydration
     * and is usually provided to the root component on the page.
     */
    state?: (pathParams: string[], searchParams: URLSearchParams) => Promisable<InferRouteProps<Module>>;
    /**
     * Declare which state modules are required by this route.
     *
     * For state modules whose `load` method expects one or more arguments,
     * you should define those arguments with the `bind` method. If no arguments
     * are expected, pass the state module without calling any method.
     */
    include?: RouteInclude;
}
interface ParsedRoute {
    pattern: RegExp;
    keys: string[];
}
interface Route extends RouteConfig, ParsedRoute {
    path: string;
    load: RouteLoader;
    moduleId: string;
    generated?: boolean;
}
/**
 * Values configurable from the `saus.routes` module defined
 * in your Vite config.
 */
interface RoutesModule extends HtmlContext {
    /** State fragments that are loaded by default */
    defaultState: RouteInclude[];
    /** These hooks are called after the routes module is loaded */
    runtimeHooks: RuntimeHook[];
    /** Routes defined with the `route` function */
    routes: Route[];
    /** The route used when no route is matched */
    defaultRoute?: Route;
    /** The route used when an error is thrown while rendering */
    catchRoute?: Route;
    /** Used by generated routes to import their route module */
    ssrRequire?: RequireAsync;
}

declare class Buffer$1 {
    readonly buffer: ArrayBuffer;
    protected constructor(buffer: ArrayBuffer);
    static from(data: ArrayBuffer): Buffer$1;
    toString(encoding?: string): string;
}

declare type Headers = Record<string, string | string[] | undefined>;
declare class Response {
    readonly data: Buffer$1;
    readonly status: number;
    readonly headers: Headers;
    constructor(data: Buffer$1, status: number, headers: Headers);
    toString(encoding?: string): string;
    toJSON<T = any>(): T;
}

declare type ParsedHeadTag<T = any> = {
    value: T;
    start: number;
    end: number;
};
declare type ParsedHead = {
    title?: ParsedHeadTag<string>;
    stylesheet: ParsedHeadTag<string>[];
    prefetch: ParsedHeadTag<string>[];
    preload: {
        [as: string]: ParsedHeadTag<string>[];
    };
};

declare type BufferLike = string | Buffer$1 | globalThis.Buffer;
declare type RenderedFile = {
    id: string;
    data: BufferLike;
    mime: string;
};
declare type RenderedPage = {
    path: string;
    html: string;
    head: ParsedHead;
    state: ClientState;
    files: RenderedFile[];
    stateModules: string[];
    routeModuleId: string;
    client?: Client;
};
declare type ProfiledEvent = {
    url: ParsedUrl;
    timestamp: number;
    duration: number;
};
declare type ProfiledEventType = 'load state' | 'render html' | 'process html' | 'render client';
declare type ProfiledEventHandler = (type: ProfiledEventType, event: ProfiledEvent) => void;
interface PageContext extends RenderModule {
}
declare type RenderPageOptions = {
    timeout?: number;
    renderStart?: (url: string) => void;
    renderFinish?: (url: string, error: Error | null, page?: RenderedPage | null) => void;
    /**
     * The setup hook can manipulate the render hooks,
     * allowing for rendered pages to be isolated from
     * each other if desired.
     */
    setup?: (context: PageContext, url: ParsedUrl) => any;
};

declare type ConfigHookRef = {
    path: string;
    source: string;
};
interface RuntimeConfig {
    assetsDir: string;
    base: string;
    bundleType?: 'script' | 'worker';
    command: 'dev' | 'bundle';
    debugBase?: string;
    defaultPath: string;
    delayModulePreload?: boolean;
    htmlTimeout?: number;
    minify: boolean;
    mode: string;
    publicDir: string;
    renderConcurrency?: number;
    ssrRoutesId: string;
    stateCacheId: string;
    stripLinkTags?: boolean;
}
declare type RuntimeConstants = 'base' | 'command' | 'debugBase' | 'defaultPath' | 'mode' | 'ssrRoutesId' | 'stateCacheId';
interface MutableRuntimeConfig extends Omit<RuntimeConfig, RuntimeConstants> {
    profile?: ProfiledEventHandler;
}

declare const config: RuntimeConfig;

/**
 * Update the bundle's runtime config.
 */
declare function configureBundle(update: Partial<MutableRuntimeConfig>): void;

interface ResponseCache extends ReturnType<typeof loadResponseCache> {
}
declare const setResponseCache: (cache: ResponseCache | null) => ResponseCache | null;
declare function loadResponseCache(root: string): {
    read(cacheKey: string): {
        expired: boolean;
        readonly object: Response;
    } | null;
    write(cacheKey: string, resp: Response, maxAge: number): void;
};

export { ClientAsset, ClientModule, ClientModuleMap, RenderPageOptions$1 as RenderPageOptions, RenderedFile$1 as RenderedFile, RenderedPage$1 as RenderedPage, config, configureBundle, renderPage as default, getKnownPaths, getModuleUrl, inlinedAssets, printFiles, setResponseCache, __d as ssrDefine, ssrImport, writePages };
