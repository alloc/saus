import * as vite from 'vite'
import { SourceMap } from './sourceMap'

export const combineSourceMaps = vite.combineSourcemaps as (
  filename: string,
  maps: SourceMap[]
) => SourceMap
