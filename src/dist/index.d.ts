import { Promisable } from 'type-fest';
import { UserConfig, vite } from './core';
export * from './bundle/runtime/api';
export type { OutputBundle } from './bundle/types';
export { loadBundle, Plugin, setEnvData, UserConfig, vite } from './core';
export declare const build: Function & typeof import("./build/api").build, deploy: Function & typeof import("./deploy/api").deploy, generateBundle: Function & typeof import("./bundle/api").bundle, createServer: Function & typeof import("./dev/api").createServer;
export declare const defineConfig: (config: UserConfig | ((env: vite.ConfigEnv) => Promisable<UserConfig>)) => vite.UserConfigExport;
//# sourceMappingURL=index.d.ts.map