type RefGroup = {
  parameters: string[]
  requestBodies: string[]
  responses: string[]
  schemas: string[]
}

export function refGroupBy(refs: string[]) {
  return refs.reduce(
    (obj, ref) => {
      const str = ref.split('/')[2]
      obj[str as keyof RefGroup].push(ref)
      return obj
    },
    {
      parameters: [],
      requestBodies: [],
      responses: [],
      schemas: [],
    } as RefGroup,
  )
}
