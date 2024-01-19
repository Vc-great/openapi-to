import fs from 'fs-extra'

export function pathExistsSync(path: string){
  return fs.pathExistsSync(path)
}
