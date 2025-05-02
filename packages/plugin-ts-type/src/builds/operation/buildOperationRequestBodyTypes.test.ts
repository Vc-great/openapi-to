import { buildOperationRequestBodyTypes } from '@/builds/operation/buildOperationRequestBodyTypes'
import { describe, expect, it } from 'vitest'

describe('buildOperationRequestBodyTypes', () => {
  it('should return null when no request body is present', () => {
    const mockOperation = {
      accessor: {
        operationId: 'getUser',
        operationName: 'getUser',
        operation: {
          schema: {
            requestBody: undefined,
          },
          getRequestBody: () => undefined,
        },
      },
    }

    const result = buildOperationRequestBodyTypes(mockOperation as any)
    expect(result).toBeUndefined()
  })

  it('should build request body types from direct schema', () => {
    const mockOperation = {
      accessor: {
        operationId: 'createUser',
        operationName: 'createUser',
        operation: {
          schema: {
            requestBody: {},
          },
          getRequestBody: () => ({
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
              },
              required: ['name', 'email'],
            },
          }),
        },
      },
    }

    const result = buildOperationRequestBodyTypes(mockOperation as any)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('CreateUserMutationRequest')

    // TypeAliasDeclaration 或 InterfaceDeclaration 确保有正确的结构
    if ('properties' in result!) {
      // InterfaceDeclaration
      expect(result.properties?.length).toBeGreaterThan(0)
    } else if ('type' in result!) {
      // TypeAliasDeclaration
      expect(result.type).toBeDefined()
    }
  })

  it('should handle $ref in request body', () => {
    const mockOperation = {
      accessor: {
        operationId: 'updateUser',
        operationName: 'updateUser',
        operation: {
          schema: {
            requestBody: {
              $ref: '#/components/schemas/User',
            },
          },
          getRequestBody: () => undefined,
        },
      },
    }

    const result = buildOperationRequestBodyTypes(mockOperation as any)
    expect(result).not.toBeNull()
    expect(result?.name).toBe('UpdateUserMutationRequest')
  })

  it('should handle array response from getRequestBody', () => {
    const mockOperation = {
      accessor: {
        operationId: 'createBulkUsers',
        operationName: 'createBulkUsers',
        operation: {
          schema: {
            requestBody: {},
          },
          getRequestBody: () => [
            { contentType: 'application/json' },
            {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                  },
                },
              },
            },
          ],
        },
      },
    }

    const result = buildOperationRequestBodyTypes(mockOperation as any)
    expect(result).not.toBeNull()
    expect(result?.name).toBe('CreateBulkUsersMutationRequest')
  })
})
