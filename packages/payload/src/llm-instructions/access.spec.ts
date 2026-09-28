import type { Access, Config } from '../config/types.js'
import type { PayloadRequest } from '../types/index.js'

import { describe, expect, it, vi } from 'vitest'

import { sanitizeConfig } from '../config/sanitize.js'
import { instructionsCollectionSlug } from './shared.js'

describe('LLM instruction access', () => {
  it('should intersect custom instruction access filters with target permissions', async () => {
    const manageWhere = { collectionSlug: { equals: 'pages' } }
    const { collection, req } = createConfig({ access: () => manageWhere })
    const result = await collection.access.update({ req, slug: instructionsCollectionSlug })

    expect(result).toEqual({
      and: [
        manageWhere,
        {
          or: [{ collectionSlug: { equals: 'pages' } }, { collectionSlug: { equals: 'users' } }],
        },
      ],
    })
  })

  it('should deny access when no targets are accessible', async () => {
    const { collection, req } = createConfig({
      baseAccess: { collections: { read: ({ slug }) => slug === instructionsCollectionSlug } },
    })

    expect(await collection.access.read({ req, slug: instructionsCollectionSlug })).toBe(false)
    expect(await collection.access.update({ req, slug: instructionsCollectionSlug })).toBe(false)
  })

  it('should respect base update access on the target collection', async () => {
    const { collection, req } = createConfig({
      baseAccess: { collections: { update: ({ slug }) => slug !== 'pages' } },
    })

    expect(await collection.access.update({ req, slug: instructionsCollectionSlug })).toEqual({
      or: [{ collectionSlug: { equals: 'users' } }],
    })
  })

  it('should deny edits before checking targets when instructions access is denied', async () => {
    const read = vi.fn(() => true)
    const { collection, req } = createConfig({
      access: () => false,
      baseAccess: { collections: { read } },
    })

    expect(await collection.access.update({ req, slug: instructionsCollectionSlug })).toBe(false)
    expect(read).not.toHaveBeenCalled()
  })

  it('should deny anonymous edits even when custom instructions access allows them', async () => {
    const { collection, req } = createConfig({ access: () => true })

    req.user = null

    expect(await collection.access.update({ req, slug: instructionsCollectionSlug })).toBe(false)
  })
})

const createConfig = ({
  access,
  baseAccess,
}: {
  access?: Access
  baseAccess?: Config['baseAccess']
} = {}) => {
  const config = sanitizeConfig({
    baseAccess,
    collections: [{ slug: 'pages', fields: [] }],
    db: {
      defaultIDType: 'text',
      // @ts-expect-error Access tests do not connect to a database.
      init: () => undefined,
    },
    llmInstructions: { access },
    secret: 'test',
  })
  const collection = config.collections.find(({ slug }) => slug === instructionsCollectionSlug)!
  const req = {
    context: {},
    payload: {
      collections: Object.fromEntries(
        config.collections.map((collection) => [collection.slug, { config: collection }]),
      ),
      config,
    },
    user: { id: 'admin', collection: config.admin.user },
  } as PayloadRequest

  return { collection, req }
}
