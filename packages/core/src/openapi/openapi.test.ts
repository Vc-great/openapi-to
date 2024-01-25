import Oas from 'oas'

import petStore from '../../mock/petstore.json'
import { OpenAPI } from './OpenAPI.ts'

describe('openapi get requestName', () => {
  const oas = new Oas(petStore)
  const openapi = new OpenAPI({}, oas)

  test('request crud name :create', () => {
    openapi.setCurrentOperation('/pet', 'post', 'pet')
    const requestName = openapi.requestName
    expect(requestName).toBe('create')
  })

  test('request crud name:findAll', () => {
    openapi.setCurrentOperation('/pet', 'get', 'pet')
    const requestName = openapi.requestName
    expect(requestName).toBe('findAll')
  })

  test('request crud name:remove', () => {
    openapi.setCurrentOperation('/pet', 'delete', 'pet')
    const requestName = openapi.requestName
    expect(requestName).toBe('remove')
  })

  test('request crud name:update', () => {
    openapi.setCurrentOperation('/pet', 'put', 'pet')
    const requestName = openapi.requestName
    expect(requestName).toBe('update')
  })

  test('request crud name:findById', () => {
    openapi.setCurrentOperation('/pet/{id}', 'get', 'pet')
    const requestName = openapi.requestName
    expect(requestName).toBe('findById')
  })

  test('request name:{name}Get', () => {
    openapi.setCurrentOperation('/pet/findByStatus', 'get', 'pet')
    const requestName = openapi.requestName
    expect(requestName).toBe('findByStatusGet')
  })
})

describe('openapi get pathGroupByTag', () => {
  const oas = new Oas(petStore)
  const openapi = new OpenAPI({}, oas)
  test('get pathGroupByTag', () => {
    const pathGroup = openapi.pathGroupByTag
    expect(pathGroup).toMatchSnapshot()
  })
})
