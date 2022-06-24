export namespace Rollup {
  export interface RenderedModule {
    code: string | null
    originalLength: number
    removedExports: string[]
    renderedExports: string[]
    renderedLength: number
  }

  export interface PreRenderedChunk {
    exports: string[]
    facadeModuleId: string | null
    isDynamicEntry: boolean
    isEntry: boolean
    isImplicitEntry: boolean
    modules: {
      [id: string]: RenderedModule
    }
    name: string
    type: 'chunk'
  }

  export interface RenderedChunk extends PreRenderedChunk {
    code?: string
    dynamicImports: string[]
    fileName: string
    implicitlyLoadedBefore: string[]
    importedBindings: {
      [imported: string]: string[]
    }
    imports: string[]
    map?: any
    referencedFiles: string[]
  }

  export interface OutputChunk extends RenderedChunk {
    code: string
  }
}
