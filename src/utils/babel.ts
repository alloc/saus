import * as babel from '@babel/core'
import { NodePath, types as t } from '@babel/core'

export { Bundle as MagicBundle, default as MagicString } from 'magic-string'
export { getBabelProgram } from './babel/program'
export { NodePath, t, babel }
