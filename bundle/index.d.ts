export { setResponseCache } from '@/http/responseCache';
export { printFiles } from '@/node/printFiles';
export { __d as ssrDefine, ssrImport } from '@/runtime/ssrModules';
import { RenderPageOptions, RenderedPage, App } from '@/app/types';
import { HttpRedirect } from '@/http/redirect';
import { ParsedUrl } from '@/node/url';
import { RuntimeConfig, MutableRuntimeConfig } from '@/runtime/config';
import { Headers } from '@/http';
import QuickLRU, { Options as Options$1 } from 'quick-lru';
import { Promisable } from '@/utils/types';
import http from 'http';

interface PageBundleOptions extends Pick<RenderPageOptions, 'timeout' | 'onError'> {
    renderStart?: (url: ParsedUrl) => void;
    renderFinish?: (url: ParsedUrl, error: Error | null, page?: PageBundle | null) => void;
    /** @internal */
    receivePage?: (page: RenderedPage | null, error: any) => void;
}
interface PageBundle {
    id: string;
    html: string;
    /** Files generated whilst rendering. */
    files: RenderedFile[];
    /** Modules required by the client. */
    modules: Set<ClientModule>;
    /** Assets required by the client. */
    assets: Map<string, ClientAsset>;
}
interface RenderedFile {
    id: string;
    data: any;
    mime: string;
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
declare function writePages(pages: ReadonlyArray<PageBundle | null>, outDir: string, inlinedAssets?: Record<string, string>): Record<string, number>;

declare function createApp(plugins?: App.Plugin[]): Promise<App>;

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

declare type BoundHeadersFn = () => Headers | null | undefined;
declare type HeadersParam = Headers | null | ((url: string) => Headers | null | undefined);
interface FileCache extends QuickLRU<string, FileCacheEntry> {
    addModules(module: Set<ClientModule>, headers?: HeadersParam): void;
    addAssets(assets: Map<string, ClientAsset>, headers?: HeadersParam): void;
}
declare type FileCacheOptions = Options$1<string, FileCacheEntry>;
declare type FileCacheEntry = [
    data: string | ClientAsset,
    headers: BoundHeadersFn | null | undefined
];
declare function createFileCache(base: string, options?: FileCacheOptions): FileCache;

/**
 * In addition to the returned `App` plugin, this function also adds
 * a response hook with a priority of `1,000`. You should avoid mutating
 * response headers from a response hook with a higher priority.
 */
declare const cachePageAssets: (cache: FileCache) => App.Plugin;

/**
 * A tiny implementation of the `connect` package.
 */
declare function connect<RequestProps extends object = {}>(extendRequest?: (req: http.IncomingMessage) => Promisable<RequestProps>): connect.App<RequestProps>;
declare namespace connect {
    type Request<Props extends object = {}> = Props & http.IncomingMessage & {
        url: string;
    };
    type Response = http.ServerResponse;
    type NextFunction = (error?: any) => void;
    type ErrorListener = (e: any, req: Request, res: Response, next: NextFunction) => void;
    type Middleware<RequestProps extends object = {}> = (req: Request<RequestProps>, res: Response, next: NextFunction) => void | Promise<void>;
    interface App<RequestProps extends object = {}> {
        (req: http.IncomingMessage, res: http.ServerResponse, next?: connect.NextFunction): Promise<void>;
        use(handler: connect.Middleware<RequestProps>): this;
        on(name: 'error', listener: connect.ErrorListener): this;
    }
}

declare const serveCachedFiles: (cache: FileCache) => connect.Middleware;

interface RequestProps {
    app: App;
}
declare const servePages: connect.Middleware<RequestProps>;

interface Options {
    /** @default runtimeConfig.publicDir */
    root?: string;
    /**
     * When defined, only files matching this can be served
     * by this middleware.
     */
    include?: RegExp;
    /**
     * When defined, files matching this cannot be served
     * by this middleware.
     */
    ignore?: RegExp;
    /**
     * Set the `max-age` Cache-Control directive. \
     * Set to `Infinity` to use the `immutable` directive.
     */
    maxAge?: number;
    /** Use the `stale-while-revalidate` cache strategy */
    swr?: boolean | number;
}
declare function servePublicDir(options?: Options): connect.Middleware;

export { ClientAsset, ClientModule, ClientModuleMap, FileCache, FileCacheEntry, FileCacheOptions, PageBundle, PageBundleOptions, RenderedFile, cachePageAssets, config, configureBundle, connect, createFileCache, createApp as default, getKnownPaths, getModuleUrl, inlinedAssets, serveCachedFiles, servePages, servePublicDir, writePages };
