import { createLocalReq } from 'payload'
import { getLLMInstructions } from 'payload/internal'
import { instructionsCollectionSlug } from 'payload/shared'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { devUser } from '../credentials.js'
import { additionalInstructions, findInstructions, saveAdditionalInstructions } from './helpers.js'

test.suite({ config: './config.ts' })('LLM instructions', () => {
  for (const target of [
    { slug: 'pages', type: 'collection', collectionSlug: 'pages' },
    { slug: 'site-settings', type: 'global', globalSlug: 'site-settings' },
  ] as const) {
    test(`should combine configured and saved ${target.type} instructions as Markdown`, async ({
      payload,
    }) => {
      const { user } = await payload.login({ collection: 'users', data: devUser })

      await saveAdditionalInstructions({ ...target, payload })

      const req = await createLocalReq({ user }, payload)
      const instructions = await getLLMInstructions({ slug: target.slug, type: target.type, req })
      const configured =
        target.type === 'collection'
          ? payload.collections[target.slug].config.llmInstructions
          : payload.config.globals.find(({ slug }) => slug === target.slug)?.llmInstructions

      expect(instructions).toBe(
        [configured, 'Keep page summaries under 100 words.'].filter(Boolean).join('\n\n'),
      )
    })
  }

  test('should initialize one instruction document per collection and global without duplicates', async ({
    payload,
  }) => {
    const { user } = await payload.login({ collection: 'users', data: devUser })
    const findInstructions = () =>
      payload.find({
        collection: instructionsCollectionSlug,
        overrideAccess: false,
        pagination: false,
        user,
      })
    const [first, second] = await Promise.all([findInstructions(), findInstructions()])

    expect(first.docs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ collectionSlug: 'pages', type: 'collection', title: 'Pages' }),
        expect.objectContaining({
          globalSlug: 'site-settings',
          type: 'global',
          title: 'Site Settings',
        }),
      ]),
    )
    expect(second.totalDocs).toBe(first.totalDocs)
    expect(new Set(second.docs.map(({ id }) => id)).size).toBe(second.totalDocs)
    expect(payload.collections[instructionsCollectionSlug].config.admin.group).toBe(false)
    expect(
      (payload.config.plugins ?? []).some((plugin) => plugin.slug === '@payloadcms/plugin-mcp'),
    ).toBe(false)
  })

  test('should resolve target metadata when only list columns are selected', async ({
    payload,
  }) => {
    const { user } = await payload.login({ collection: 'users', data: devUser })
    const { docs } = await payload.find({
      collection: instructionsCollectionSlug,
      overrideAccess: false,
      select: { title: true, type: true, additionalInstructions: true },
      user,
      where: { collectionSlug: { equals: 'pages' } },
    })

    expect(docs).toEqual([expect.objectContaining({ title: 'Pages', type: 'collection' })])
  })

  test('should allow a null unused slug for multiple targets', async ({ payload }) => {
    const pages = await payload.create({
      collection: instructionsCollectionSlug,
      data: { collectionSlug: 'pages', globalSlug: null },
    })
    const users = await payload.create({
      collection: instructionsCollectionSlug,
      data: { collectionSlug: 'users', globalSlug: null },
    })

    expect(pages.collectionSlug).toBe('pages')
    expect(users.collectionSlug).toBe('users')
  })

  test('should prevent changing a configuration-owned target', async ({ payload }) => {
    const { user } = await payload.login({ collection: 'users', data: devUser })
    const doc = await findInstructions({ collectionSlug: 'pages', payload, user })

    await expect(
      payload.update({
        id: doc.id,
        collection: instructionsCollectionSlug,
        data: { collectionSlug: null, globalSlug: 'site-settings' },
        overrideAccess: false,
        user,
      }),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      data: {
        errors: [expect.objectContaining({ message: 'The instruction target cannot be changed.' })],
      },
    })
  })

  for (const { name, data } of [
    { name: 'neither target', data: {} },
    { name: 'null targets', data: { collectionSlug: null, globalSlug: null } },
    { name: 'both targets', data: { collectionSlug: 'pages', globalSlug: 'site-settings' } },
  ] as const) {
    test(`should reject creating instructions with ${name}`, async ({ payload }) => {
      await expect(
        payload.create({ collection: instructionsCollectionSlug, data }),
      ).rejects.toMatchObject({
        name: 'ValidationError',
        data: {
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: 'Provide exactly one of collectionSlug or globalSlug.',
            }),
          ]),
        },
      })
    })
  }

  for (const { name, data } of [
    { name: 'neither target', data: { collectionSlug: null } },
    { name: 'an empty target', data: { collectionSlug: '' } },
    { name: 'both targets', data: { globalSlug: 'site-settings' } },
  ] as const) {
    test(`should reject updating instructions to ${name}`, async ({ payload }) => {
      const { user } = await payload.login({ collection: 'users', data: devUser })
      const doc = await findInstructions({ collectionSlug: 'pages', payload, user })

      await expect(
        payload.update({
          id: doc.id,
          collection: instructionsCollectionSlug,
          data,
          overrideAccess: false,
          user,
        }),
      ).rejects.toMatchObject({
        name: 'ValidationError',
        data: {
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: 'Provide exactly one of collectionSlug or globalSlug.',
            }),
          ]),
        },
      })
    })
  }

  for (const target of [{ collectionSlug: 'pages' }, { globalSlug: 'site-settings' }] as const) {
    test(`should reject duplicate instructions for ${JSON.stringify(target)}`, async ({
      payload,
    }) => {
      await payload.create({ collection: instructionsCollectionSlug, data: target })

      await expect(
        payload.create({ collection: instructionsCollectionSlug, data: target }),
      ).rejects.toThrow()
    })

    test(`should preserve the target on a partial update for ${JSON.stringify(target)}`, async ({
      payload,
    }) => {
      const updated = await saveAdditionalInstructions({ ...target, payload })

      expect(updated).toMatchObject({ ...target, additionalInstructions })
    })
  }

  test('should keep system instructions read-only through the API', async ({ payload }) => {
    const { user } = await payload.login({ collection: 'users', data: devUser })
    const original = await findInstructions({
      payload,
      collectionSlug: 'pages',
      user,
    })
    const updated = await payload.update({
      id: original.id,
      collection: instructionsCollectionSlug,
      data: { type: 'global', systemInstructions: additionalInstructions, title: 'Changed title' },
      overrideAccess: false,
      user,
    })

    expect(updated.systemInstructions).toEqual(original.systemInstructions)
    expect(updated.title).toBe('Pages')
    expect(updated.type).toBe('collection')
  })

  test('should leave system instructions empty when none are configured', async ({ payload }) => {
    const { user } = await payload.login({ collection: 'users', data: devUser })
    const doc = await findInstructions({
      payload,
      globalSlug: 'site-settings',
      user,
    })

    expect(doc.systemInstructions).toBeNull()
  })

  test('should reject anonymous reads and edits', async ({ payload }) => {
    const doc = await saveAdditionalInstructions({ collectionSlug: 'pages', payload })

    await expect(
      payload.find({ collection: instructionsCollectionSlug, overrideAccess: false, user: null }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        id: doc.id,
        collection: instructionsCollectionSlug,
        data: { additionalInstructions },
        overrideAccess: false,
        user: null,
      }),
    ).rejects.toThrow()
  })

  test('should respect configured access when an authenticated user edits instructions', async ({
    payload,
  }) => {
    const viewer = await payload.create({
      collection: 'users',
      data: { email: 'instructions-viewer@payloadcms.com', password: 'test' },
    })
    const user = { ...viewer, collection: 'users' as const }
    const doc = await findInstructions({
      payload,
      collectionSlug: 'pages',
      user,
    })

    expect(doc.title).toBe('Pages')
    await expect(
      payload.update({
        id: doc.id,
        collection: instructionsCollectionSlug,
        data: { additionalInstructions },
        overrideAccess: false,
        user,
      }),
    ).rejects.toThrow()
  })

  test('should prevent users from creating and deleting configuration-owned entries', async ({
    payload,
  }) => {
    const { user } = await payload.login({ collection: 'users', data: devUser })

    await expect(
      payload.create({
        collection: instructionsCollectionSlug,
        data: { collectionSlug: 'pages', title: 'Invented' },
        overrideAccess: false,
        user,
      }),
    ).rejects.toThrow()
    const doc = await findInstructions({ collectionSlug: 'pages', payload, user })

    await expect(
      payload.delete({
        id: doc.id,
        collection: instructionsCollectionSlug,
        overrideAccess: false,
        user,
      }),
    ).rejects.toThrow()
  })
})
