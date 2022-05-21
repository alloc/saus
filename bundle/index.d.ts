import { URLSearchParams } from 'url';
import { AbortSignal } from 'node-abort-controller';
import * as vite from 'vite';
import { types } from '@babel/core';
import { RouteParams as RouteParams$1 } from 'regexparam';

declare type ImportDescriptorMap = {
    [source: string]: string | (string | [name: string, alias: string])[];
};

declare class Buffer$1 {
    readonly buffer: ArrayBuffer;
    protected constructor(buffer: ArrayBuffer);
    static from(data: ArrayBuffer): Buffer$1;
    toString(encoding?: string): string;
}

interface CommonHeaders {
    'Cache-Control'?: string;
    'Content-Length'?: string;
    'Content-Type'?: string;
}
declare type Headers = CommonHeaders & Record<string, string | string[] | undefined>;
declare class Response {
    readonly data: Buffer$1;
    readonly status: number;
    readonly headers: Headers;
    constructor(data: Buffer$1, status: number, headers: Headers);
    toString(encoding?: string): string;
    toJSON<T = any>(): T;
}

declare const httpMethods: readonly ["get", "post", "put", "patch", "delete", "head"];

declare class HttpRedirect {
    readonly location: string;
    constructor(location: string);
}

declare type Promisable$7<T> = T | PromiseLike<T>;
declare type Falsy = false | null | undefined;
declare type OneOrMany<T> = T | readonly T[];

declare class ParsedUrl<RouteParams extends {} = Record<string, string>> {
    searchParams: URLSearchParams;
    routeParams: Readonly<RouteParams>;
    readonly path: string;
    constructor(path: string, searchParams: URLSearchParams, routeParams?: Readonly<RouteParams>);
    get search(): string;
    toString(): string;
    startsWith(prefix: string): boolean;
    slice(start: number, end?: number): ParsedUrl<Record<string, string>>;
}

interface Endpoint<Params extends {} = {}> extends Endpoint.Function<Params> {
    /** This function responds to this HTTP method. */
    method: string;
    /** This function responds to these MIME type requests. */
    contentTypes: Endpoint.ContentType[];
}
declare namespace Endpoint {
    export type Generated = Function<RouteParams> & Partial<Endpoint>;
    export type Generator = (method: string, route: Route) => Generated | (Generated | Falsy)[] | Falsy;
    export type ContentType = `${string}/${string}`;
    export type ContentTypes = [ContentType, ...ContentType[]];
    export type Declarators<Self, Params extends {} = {}> = {
        [T in typeof httpMethods[number]]: {
            /** Declare an endpoint that responds to any `Accept` header */
            (fn: Function<Params>): Self;
            /** Declare an endpoint that responds to specific `Accept` headers */
            (contentTypes: ContentTypes, fn: Function<Params>): Self;
            /** Declare a JSON endpoint */
            <RoutePath extends string>(nestedPath: `${RoutePath}.json`, fn: JsonFunction<Params & RouteParams$1<RoutePath>>): Self;
            <RoutePath extends string>(nestedPath: RoutePath, contentTypes: ContentTypes, fn: Function<Params & RouteParams$1<RoutePath>>): Self;
        };
    };
    export type Result = Response | HttpRedirect | null | void;
    /**
     * Endpoints ending in `.json` don't have to wrap their
     * response data. Just return a JSON-compatible value
     * or a promise that resolves with one. If the result
     * is undefined, the next endpoint handler is tried.
     */
    export type JsonFunction<Params extends {} = {}> = (request: Request<Params>) => Promisable$7<any>;
    export type Function<Params extends {} = {}> = (request: Request<Params>) => Promisable$7<Result>;
    export type Request<RouteParams extends {} = {}> = unknown & RequestUrl<RouteParams> & RequestMethods & Omit<RouteParams, keyof RequestMethods | keyof RequestUrl>;
    interface RequestMethods {
        respondWith(...response: ResponseTuple): void;
    }
    export interface RequestUrl<RouteParams extends {} = Record<string, string>> extends ParsedUrl<RouteParams> {
        readonly method: string;
        readonly headers: Headers;
    }
    export type ResponseHook = (request: Request, response: ResponseTuple) => Promisable$7<void>;
    export type ResponseTuple = [
        status?: number,
        headers?: Headers | null,
        body?: Endpoint.ResponseBody
    ];
    export type ResponseBody = {
        buffer: Buffer$1;
    } | {
        stream: NodeJS.ReadableStream;
    } | {
        text: string;
    } | {
        json: any;
    } | {};
    export {};
}

/** Define the default route */
declare function route(load: RouteLoader): void;
/** Define a catch route */
declare function route<Module extends object>(path: 'error', load: RouteLoader<Module>, config?: RouteConfig<Module, {
    error: any;
}>): void;
/** Define a route */
declare function route<RoutePath extends string, Module extends object>(path: RoutePath, load?: RouteLoader<Module>, config?: RouteConfig<Module, RouteParams$1<RoutePath>>): Route.API<RouteParams$1<RoutePath>>;

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
interface StateOptions {
    /**
     * When this state is accessed in a SSR environment,
     * it will be deep-copied so it can be mutated in preparation
     * for page rendering without mutating the serialized data
     * that goes in the client module.
     */
    deepCopy?: boolean;
}

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

declare type Promisable$6<T> = T | PromiseLike<T>;
/** Load state if missing from the global cache */
declare const getCachedState: {
    <State = any>(cacheKey: string, loader: (cacheControl: CacheControl) => Promisable$6<State>, options?: StateOptions | undefined): Promise<State>;
    <State_1 = any>(cacheKey: string, loader?: ((cacheControl: CacheControl) => Promisable$6<State_1>) | undefined, options?: StateOptions | undefined): Promise<State_1 | undefined> | undefined;
};

declare type FileMappings = Record<string, string> & {
    path: string;
};

/**
 * For caching compiled files on disk by the hash of their
 * original contents. The cache cleans up unused files before
 * the process exits cleanly. The cache can be locked to
 * prevent clean up in the case of unexpected errors.
 */
declare class CompileCache {
    readonly name: string;
    private root;
    protected fileMappings: FileMappings;
    constructor(name: string, root: string);
    get path(): string;
    key(content: string, name?: string): string;
    get(key: string, sourcePath?: string): string | undefined;
    set(key: string, content: string): string;
}

declare type Deferred<T> = PromiseLike<T> & {
    resolve: undefined extends T ? (value?: T | PromiseLike<T>) => void : (value: T | PromiseLike<T>) => void;
    reject: (error?: any) => void;
    promise: Promise<T>;
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

interface TestFramework {
    /** Dev server plugins */
    plugins?: Plugin[];
    /** A file was changed. */
    onFileChange?: () => void;
    /** The dev server was restarted. */
    onRestart?: () => void;
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
    /**
     * Define which modules should never be bundled.
     */
    external?: string[];
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
declare module 'rollup' {
    interface PartialResolvedId {
        /**
         * Use `false` to prevent this module from being reloaded.
         *
         * Perfect for singleton modules that should be shared between
         * modules inside and outside the SSR module graph.
         */
        reload?: boolean;
    }
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
    interface ViteDevServer extends Omit<App, 'config'> {
        /** Files emitted by a renderer are cached here. */
        servedFiles: Record<string, RenderedFile$1>;
        moduleMap: ModuleMap;
        linkedModules: LinkedModuleMap;
        externalExports: Map<string, any>;
        require: RequireAsync;
        ssrRequire: RequireAsync;
        ssrForceReload?: (id: string) => boolean;
    }
    interface Plugin {
        /**
         * Provide plugin hooks specific to Saus.
         *
         * If a function is given, it gets called whenever the Saus context
         * is created or replaced. When `saus dev` is used, it's also called
         * when the routes/renderers are updated.
         */
        saus?: SausPlugin | ((context: SausContext) => Promisable$5<SausPlugin | void>);
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
    /** Used to stop rendering the remaining pages. */
    abortSignal?: AbortSignal;
    /** Include `sourcesContent` is cached bundle sourcemap. */
    sourcesContent?: boolean;
}
declare type Promisable$5<T> = T | Promise<T>;
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
    transformPublicFile?: (file: PublicFile) => Promisable$5<void>;
    /**
     * Define virtual modules and/or return an array of side-effectful module
     * identifiers to be imported by the SSR bundle.
     */
    fetchBundleImports?: (modules: ModuleProvider) => Promisable$5<string[] | null | void>;
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
    onWritePages?: (pages: RenderedPage[]) => void;
    /**
     * In development only, SSR errors can be sent to the browser
     * for a better developer experience. The default behavior is
     * minimal but overridable via this plugin hook.
     */
    renderErrorReport?: (req: Endpoint.Request, error: any) => Promisable$5<string>;
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
    /** Get all cached pages. Loading pages are waited for. */
    getCachedPages: () => Promise<Map<string, RenderPageResult>>;
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

declare type RuntimeHook = (config: RuntimeConfig) => void;

interface RouteModule extends Record<string, any> {
}
declare type RouteLoader<T extends object = RouteModule> = () => Promise<T>;
declare type RouteParams = Record<string, string>;
declare type HasOneKey<T> = [string & keyof T] extends infer Keys ? Keys extends [infer Key] ? Key extends any ? [string & keyof T] extends [Key] ? 1 : 0 : never : never : never;
declare type StaticPageParams<Params extends object> = 1 extends HasOneKey<Params> ? string | number : readonly (string | number)[];
declare type Promisable$4<T> = T | PromiseLike<T>;
interface RouteConfig<Module extends object = RouteModule, Params extends object = RouteParams> extends RouteStateConfig<Module, Params> {
    /**
     * Define which pages should be statically generated by providing
     * their path params.
     */
    paths?: () => Promisable$4<readonly StaticPageParams<Params>[]>;
    /**
     * If intermediate state is shared between the `state`, `include`, and/or
     * `headProps` options, define a `config` function to avoid work duplication.
     */
    config?: PageSpecificOption<RouteStateConfig<Module, Params>, Module, Params>;
}
declare type PageSpecificOption<T = any, Module extends object = RouteModule, Params extends object = RouteParams> = (request: Endpoint.Request<Params>, route: BareRoute<Module>) => Promisable$4<T>;
declare type RoutePropsOption<Module extends object = any, Params extends object = any> = Record<string, any> | PageSpecificOption<Record<string, any>, Module, Params>;
declare type RouteIncludedState = readonly OneOrMany<StateModule<any, []>>[];
/** A value that defines which state modules are needed by a route. */
declare type RouteIncludeOption<Module extends object = any, Params extends object = any> = RouteIncludedState | PageSpecificOption<RouteIncludedState, Module, Params>;
interface RouteStateConfig<Module extends object = RouteModule, Params extends object = RouteParams> {
    /**
     * Load the page props for this route. These props exist during hydration
     * and are usually provided to the root component on the page.
     */
    props?: RoutePropsOption<Module, Params>;
    /**
     * Declare which state modules are required by this route.
     *
     * For state modules whose `load` method expects one or more arguments,
     * you should define those arguments with the `bind` method. If no arguments
     * are expected, pass the state module without calling any method.
     */
    include?: RouteIncludeOption<Module, Params>;
    /**
     * Similar to the `include` option, but the state modules' data is declared
     * inside the "page state module" so no extra HTTP requests are needed.
     */
    inline?: RouteIncludeOption<Module, Params>;
    /**
     * Load or generate state used only when rendering the `<head>` element.
     * This state is never sent to the client.
     */
    headProps?: Record<string, any> | ((request: Endpoint.Request<Params>, state: any) => Promisable$4<Record<string, any>>);
}
interface ParsedRoute {
    pattern: RegExp;
    keys: string[];
}
interface BareRoute<T extends object = RouteModule> extends ParsedRoute {
    path: string;
    load: RouteLoader<T>;
    moduleId: string | null;
    generated?: boolean;
    endpoints?: Endpoint[];
    /**
     * This is generated on-demand when the route is matched.
     */
    methods?: {
        [method: string]: RouteEndpointMap;
    };
}
declare type RouteEndpointMap = Record<Endpoint.ContentType, Endpoint[]>;
interface Route extends BareRoute, RouteConfig {
}
declare namespace Route {
    interface API<Params extends {} = {}> extends Endpoint.Declarators<API<Params>, Params> {
        /**
         * In the given callback, you can add routes that have this
         * route's path automatically prepended to theirs.
         */
        extend: (cb: (route: typeof route) => Promisable$4<void>) => API<Params>;
    }
}
/**
 * Values configurable from the `saus.routes` module defined
 * in your Vite config.
 */
interface RoutesModule extends HtmlContext {
    /** State modules that are loaded by default */
    defaultState: RouteIncludeOption[];
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
    requestHooks?: Endpoint.Function[];
    responseHooks?: Endpoint.ResponseHook[];
}

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
declare type AnyClientProps = CommonClientProps & Record<string, any>;
/** JSON state provided by the renderer and made available to the client */
interface CommonClientProps<Params extends {} = RouteParams> {
    rootId?: string;
    routePath: string;
    routeParams: Params;
    error?: any;
}
interface WrappedNode<T extends types.Node> {
    node: T & {
        start: number;
        end: number;
    };
    toString(): string;
}
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
interface RenderRequest<Props extends {} = Record<string, any>, Params extends {} = RouteParams> {
    /** The pathname from the URL (eg: `/a?b=1` → `"/a"`) */
    path: string;
    /** The `.html` file associated with this page */
    file: string;
    /** The search query from the URL (eg: `/a?b=1` → `"b=1"`) */
    query?: string;
    /** The entry module imported by the route */
    module: RouteModule;
    /** Page props provided by the route */
    props: Props & CommonClientProps;
    /** Named strings extracted with a route pattern */
    params: Params;
}
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
    renderDocument(request: RenderRequest, headProps?: any): Promise<string | null>;
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
    head<Props extends {} = Record<string, any>>(getHead: (request: RenderRequest<Props>) => T | Promise<T>): this;
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

declare function ssrImport<T = ModuleExports>(id: string, isRequire?: boolean): Promise<T>;
declare type Promisable$1<T> = T | PromiseLike<T>;
declare type ModuleExports = Record<string, any>;
declare type ModuleLoader<T = ModuleExports> = (exports: T, module?: {
    exports: T;
}) => Promisable$1<void>;
/** Define a SSR module with async loading capability */
declare const __d: <T = ModuleExports>(id: string, loader: ModuleLoader<T>) => ModuleLoader<T>;

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

interface AppContext extends RoutesModule, RenderModule {
    config: RuntimeConfig;
    functions: ClientFunctions;
    getCachedPage: SausContext['getCachedPage'];
    onError: (e: any) => void;
    profile?: ProfiledEventHandler;
}
declare type BufferLike = string | Buffer$1 | globalThis.Buffer;
declare type RenderedFile$1 = {
    id: string;
    data: BufferLike;
    mime: string;
};
declare type RenderedPage$1 = {
    path: string;
    html: string;
    head: ParsedHead;
    files: RenderedFile$1[];
    props: AnyClientProps;
    routeModuleId: string;
    stateModules: string[];
    client?: Client;
};
declare type ProfiledEvent = {
    url: string;
    timestamp: number;
    duration: number;
};
declare type ProfiledEventType = 'load state' | 'render html' | 'process html' | 'render client';
declare type ProfiledEventHandlerArgs = [type: ProfiledEventType, event: ProfiledEvent] | [type: 'error', error: any];
interface ProfiledEventHandler {
    (...args: ProfiledEventHandlerArgs): void;
}
interface PageContext extends RenderModule {
}
declare type RenderPageFn = (url: ParsedUrl, route: Route, options?: RenderPageOptions$1) => Promise<RenderPageResult>;
declare type RenderPageResult = [page: RenderedPage$1 | null, error?: any];
declare type RenderPageOptions$1 = {
    props?: AnyClientProps;
    request?: Endpoint.Request;
    resolved?: ResolvedRoute;
    timeout?: number;
    defaultRoute?: Route | Falsy;
    onError?: (error: Error & {
        url: string;
    }) => void;
    renderStart?: (url: ParsedUrl) => void;
    renderFinish?: (url: ParsedUrl, error: Error | null, page?: RenderedPage$1 | null) => void;
    /**
     * The setup hook can manipulate the render hooks,
     * allowing for rendered pages to be isolated from
     * each other if desired.
     */
    setup?: (context: PageContext, route: Route, url: ParsedUrl) => any;
};
declare type BundledFunction = {
    function: string;
    referenced: string[];
    transformResult?: undefined;
};
declare type DevFunction = {
    referenced: WrappedNode<any>[];
    transformResult?: BundledFunction;
};
declare type ClientFunction = (BundledFunction | DevFunction) & {
    start: number;
    route?: string;
    function: string;
};
declare type RenderFunction = ClientFunction & {
    didRender?: ClientFunction;
};
interface ClientFunctions {
    filename: string;
    beforeRender: ClientFunction[];
    render: RenderFunction[];
}
declare type ResolvedRoute = [endpoints: readonly Endpoint[], route: Route] | [endpoints: readonly Endpoint[], route?: undefined];
declare type RouteResolver = (url: Endpoint.RequestUrl) => ResolvedRoute;
declare type ClientPropsLoader = (url: ParsedUrl, route: Route) => Promise<AnyClientProps>;

declare type HtmlContext = {
    htmlProcessors?: HtmlProcessorMap;
    processHtml?: MergedHtmlProcessor;
};
declare type HtmlProcessorState = {
    page: RenderedPage$1;
    config: RuntimeConfig;
    /**
     * Only exists in SSR bundle environment.
     *
     * By adding an asset URL to this `Set`, it will be loaded
     * or pre-fetched by the rendered page.
     */
    assets?: Set<string>;
};
declare type Promisable<T> = T | PromiseLike<T>;
declare type HtmlPlugin<State = HtmlProcessorState> = {
    name: string;
    process: HtmlProcessor<State>;
};
declare type HtmlProcessor<State = HtmlProcessorState> = (html: string, state: State) => Promisable<string | null | void>;
declare type HtmlProcessorArray<State = HtmlProcessorState> = Array<HtmlPlugin<State> | HtmlProcessor<State>>;
declare type HtmlProcessorMap<State = HtmlProcessorState> = {
    pre: HtmlProcessorArray<State>;
    default: HtmlProcessorArray<State>;
    post: HtmlProcessorArray<State>;
};
declare type MergedHtmlProcessor = (html: string, page: RenderedPage$1, timeout?: number) => Promise<string>;

declare type App = ReturnType<typeof createApp$1>;
declare namespace App {
    type Plugin = (app: App) => Omit<Partial<App>, 'config'>;
}
/**
 * Create a Saus application that can run anywhere. It can render pages
 * and find matching routes/endpoints. Only loaded state modules are cached.
 *
 * Note: This function does not use Vite for anything.
 */
declare function createApp$1(context: AppContext, plugins?: App.Plugin[]): {
    config: RuntimeConfig;
    resolveRoute: RouteResolver;
    getEndpoints: Endpoint.Generator | null;
    callEndpoints: (url: Endpoint.RequestUrl, endpoints?: readonly Endpoint.Function[]) => Promise<Endpoint.ResponseTuple>;
    loadClientProps: ClientPropsLoader;
    renderPage: RenderPageFn;
    preProcessHtml: MergedHtmlProcessor | undefined;
    postProcessHtml: ((page: RenderedPage$1, timeout?: number | undefined) => Promise<string>) | undefined;
};

interface BundledApp extends Omit<App, 'renderPage'> {
    renderPage: (url: ParsedUrl, route: Route, options?: RenderPageOptions) => Promise<RenderedPage | null>;
}
declare namespace BundledApp {
    type Plugin = (app: BundledApp) => Omit<Partial<BundledApp>, 'config'>;
}
declare type RenderPageOptions = {
    timeout?: number;
    onError?: (error: Error & {
        url: string;
    }) => null;
    renderStart?: (url: ParsedUrl) => void;
    renderFinish?: (url: ParsedUrl, error: Error | null, page?: RenderedPage | null) => void;
};
declare type RenderedFile = {
    id: string;
    data: any;
    mime: string;
};
interface RenderedPage {
    id: string;
    html: string;
    /** Files generated whilst rendering. */
    files: RenderedFile[];
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

/**
 * Write an array of rendered pages to disk. Shared modules are deduplicated.
 *
 * Returns a map of file names to their size in kilobytes. This object can be
 * passed to the `printFiles` function.
 */
declare function writePages(pages: ReadonlyArray<RenderedPage | null>, outDir: string, inlinedAssets?: Record<string, string>): Record<string, number>;
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

declare function createApp(plugins?: BundledApp.Plugin[]): Promise<BundledApp>;

declare const config: RuntimeConfig;

/**
 * Update the bundle's runtime config.
 */
declare function configureBundle(update: Partial<MutableRuntimeConfig>): void;

/**
 * If you want to cache modules in-memory and serve them, this function
 * will be helpful. It returns the URL pathname that your server should
 * respond to for each module.
 */
declare function getModuleUrl(mod: string | ClientModule, base?: string | number): string;

/**
 * Inlined assets are encoded with Base64.
 */
declare const inlinedAssets: Record<string, string>;

declare function getKnownPaths(options?: {
    noDebug?: boolean;
}): Promise<string[]>;

export { BundledApp, ClientAsset, ClientModule, ClientModuleMap, RenderPageOptions, RenderedFile, RenderedPage, config, configureBundle, createApp as default, getKnownPaths, getModuleUrl, inlinedAssets, printFiles, setResponseCache, __d as ssrDefine, ssrImport, writePages };
