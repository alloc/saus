import { App } from '@runtime/app/types';
export { App, RenderPageOptions, RenderPageResult, RenderedFile, RenderedPage, ResolvedRoute } from '@runtime/app/types';
import { PageBundle } from '@runtime/bundleTypes';
export * from '@runtime/bundleTypes';
export { setResponseCache } from '@runtime/http/responseCache';
export { __d as ssrDefine, ssrImport } from '@runtime/ssrModules';
export { printFiles } from '@utils/node/printFiles';
import { RuntimeConfig, MutableRuntimeConfig } from '@runtime/config';
import { Promisable } from '@utils/types';
import http from 'http';
import { BufferLike, RenderedFile, App as App$1 } from '@runtime/app';
import { Http } from '@runtime/http';
import QuickLRU, { Options as Options$1 } from 'quick-lru';

declare function createApp(plugins?: App.Plugin[]): Promise<App>;

declare function loadModule(id: string): Promise<string>;
declare function loadAsset(id: string): Promise<Buffer>;

/**
 * Configures the runtime behavior of the SSR bundle.
 *
 * Can be extended by Saus plugins.
 */
declare const config: RuntimeConfig;

/**
 * Update the bundle's runtime config.
 */
declare function configureBundle(update: Partial<MutableRuntimeConfig>): void;

declare function getKnownPaths(options?: {
    noDebug?: boolean;
}): Promise<string[]>;

/**
 * A tiny implementation of the `connect` package.
 */
declare function connect<RequestProps extends object = {}>(extendRequest?: (req: http.IncomingMessage) => Promisable<RequestProps | void>): connect.App<RequestProps>;
declare namespace connect {
    type Request<Props extends object = {}> = Props & http.IncomingMessage & {
        url: string;
    };
    type Response = http.ServerResponse;
    type NextFunction = (error?: any) => void;
    type ErrorListener<RequestProps extends object = {}> = (e: any, req: Request<RequestProps>, res: Response, next: NextFunction) => void;
    type Middleware<RequestProps extends object = {}> = (req: Request<RequestProps>, res: Response, next: NextFunction) => void | Promise<void>;
    interface App<RequestProps extends object = {}> {
        (req: http.IncomingMessage, res: http.ServerResponse, next?: connect.NextFunction): Promise<void>;
        use(handler: connect.Middleware<RequestProps>): this;
        on(name: 'error', listener: connect.ErrorListener<RequestProps>): this;
    }
}

declare type BoundHeadersFn = () => Http.Headers | null | undefined;
declare type HeadersParam = Http.Headers | null | ((url: string) => Http.Headers | null | undefined);
interface FileCache extends QuickLRU<string, FileCacheEntry> {
    addFile(id: string, content: BufferLike, headers?: Http.Headers | null): void;
    addFiles(files: RenderedFile[], headers?: HeadersParam): void;
}
declare type FileCacheOptions = Options$1<string, FileCacheEntry>;
declare type FileCacheEntry = [
    data: string | Buffer | Http.Redirect,
    headers: BoundHeadersFn | null | undefined
];
declare function createFileCache(base: string, options?: FileCacheOptions): FileCache;

declare const serveCachedFiles: (cache: FileCache) => connect.Middleware;

interface RequestProps {
    app: App$1;
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

/**
 * Write an array of rendered pages to disk. Shared modules are deduplicated.
 *
 * Returns a map of file names to their size in kilobytes. This object can be
 * passed to the `printFiles` function.
 */
declare function writePages(pages: ReadonlyArray<PageBundle | null>, outDir: string): Promise<Record<string, number>>;

export { FileCache, FileCacheEntry, FileCacheOptions, config, configureBundle, connect, createFileCache, createApp as default, getKnownPaths, loadAsset, loadModule, serveCachedFiles, servePages, servePublicDir, writePages };
