import { File } from '@babel/core'

export class MarkoFile extends File {
  constructor(code, filename, taglib) {
    const fileOpts = {}
    super(fileOpts, {
      code,
      ast: {
        type: 'File',
        program: {
          type: 'Program',
          sourceType: 'module',
          body: [],
          directives: [],
        },
      },
    })

    this.markoOpts = {
      htmlParseOptions: {
        preserveWhitespace: false,
      },
    }

    this.metadata = {
      marko: {
        watchFiles: [],
      },
    }

    this.___taglibLookup = {
      getTag(tagName) {
        const tagDef = taglib.locateTag(tagName)
        return new Proxy(tagDef, {
          get(self, key) {
            if (!self.hasOwnProperty(key)) {
              debugger
            }
            return self[key]
          },
        })
      },
    }
  }

  buildCodeFrameError({ loc }, message) {
    return Error(message)
  }
}
