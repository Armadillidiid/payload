import type { ProtocolEra } from '@modelcontextprotocol/client'
import type { Payload } from 'payload'

import { buildEditorState } from '@payloadcms/richtext-lexical'
import { randomUUID } from 'node:crypto'
import { instructionsCollectionSlug } from 'payload/shared'
import { assert, expect, onTestFinished } from 'vitest'

import type { NextRESTClient } from '../__helpers/shared/NextRESTClient.js'
import type { PayloadLlmInstruction } from './payload-types.js'

import { test } from '../__helpers/int/vitest.js'
import { devUser } from '../credentials.js'
import { createMcpClient } from './helpers/mcpClient.js'

const additionalInstructions = buildEditorState<PayloadLlmInstruction['additionalInstructions']>({
  text: 'Keep page summaries under 100 words.',
})
const paragraph = additionalInstructions.root.children[0]

assert(paragraph?.type === 'paragraph')

const text = paragraph.children[0]

assert(text?.type === 'text')
text.format = 1

test.suite({ config: './config.ts' })('Shared LLM instructions', () => {
  for (const protocolEra of ['legacy', 'modern'] as const) {
    for (const { target, name, slug } of [
      { target: { collectionSlug: 'pages' }, name: 'getCollectionSchema', slug: 'pages' },
      { target: { globalSlug: 'site-settings' }, name: 'getGlobalSchema', slug: 'site-settings' },
    ]) {
      test(`should return the same instructions alongside the ${name} schema through MCP and CLI [${protocolEra}]`, async ({
        cli,
        payload,
        restClient,
      }) => {
        await saveAdditionalInstructions({ ...target, payload })

        const client = await connectMcp({ payload, protocolEra, restClient })
        const response = await client.callTool({ name, arguments: { slug } })
        const output = await cli(`${name} --slug ${slug} --json`)
        const cliResponse = JSON.parse(output.stdout)

        expect(response.isError).not.toBe(true)
        expect(cliResponse).toMatchObject({ result: { slug }, success: true })
        expect(cliResponse.result.instructions).toContain(
          '**Keep page summaries under 100 words.**',
        )
        expect(response.structuredContent).toMatchObject({
          slug,
          schema: expect.any(Object),
          instructions: cliResponse.result.instructions,
        })
        expect(response.content).toContainEqual({
          type: 'text',
          text: cliResponse.result.instructions,
        })
      })
    }

    test(`should omit MCP schema instructions when none are configured or saved [${protocolEra}]`, async ({
      payload,
      restClient,
    }) => {
      const client = await connectMcp({ payload, protocolEra, restClient })
      const response = await client.callTool({
        name: 'getGlobalSchema',
        arguments: { slug: 'site-settings' },
      })

      expect(response.isError).not.toBe(true)
      expect(response.structuredContent).toMatchObject({ slug: 'site-settings' })
      expect(response.structuredContent).not.toHaveProperty('instructions')
      expect(response.content).toHaveLength(1)
    })

    for (const { target, input, name } of [
      { target: { collectionSlug: 'pages' }, input: { slug: 'pages' }, name: 'countDocuments' },
      {
        target: { globalSlug: 'site-settings' },
        input: { slug: 'site-settings' },
        name: 'findGlobal',
      },
      {
        target: { collectionSlug: 'pages' },
        input: { slug: 'pages', documents: [{ data: { title: 'New page' } }] },
        name: 'createDocuments',
      },
      {
        target: { globalSlug: 'site-settings' },
        input: { slug: 'site-settings', data: { siteName: 'New site name' } },
        name: 'updateGlobal',
      },
    ]) {
      test(`should omit instructions from MCP ${name} responses [${protocolEra}]`, async ({
        payload,
        restClient,
      }) => {
        await saveAdditionalInstructions({ ...target, payload })

        const client = await connectMcp({ payload, protocolEra, restClient })
        const response = await client.callTool({ name, arguments: input })
        const text = JSON.stringify(response.content)

        expect(response.isError).not.toBe(true)
        expect(response.structuredContent ?? {}).not.toHaveProperty('instructions')
        expect(text).not.toContain('Use the configured layout blocks.')
        expect(text).not.toContain('Keep page summaries under 100 words.')
      })
    }
  }
})

const connectMcp = async ({
  payload,
  protocolEra,
  restClient,
}: {
  payload: Payload
  protocolEra: ProtocolEra
  restClient: NextRESTClient
}) => {
  const { user } = await payload.login({ collection: 'users', data: devUser })
  const apiKey = randomUUID()

  assert(user)

  await payload.update({
    id: user.id,
    collection: 'users',
    data: { apiKey },
    overrideAccess: false,
    user,
  })

  const mcp = createMcpClient({ protocolEra, restClient })

  onTestFinished(() => mcp.close())

  return mcp.connect(apiKey)
}

const saveAdditionalInstructions = async ({
  collectionSlug,
  globalSlug,
  payload,
}: {
  collectionSlug?: string
  globalSlug?: string
  payload: Payload
}) => {
  const { user } = await payload.login({ collection: 'users', data: devUser })
  const { docs } = await payload.find({
    collection: instructionsCollectionSlug,
    overrideAccess: false,
    user,
    where: collectionSlug
      ? { collectionSlug: { equals: collectionSlug } }
      : { globalSlug: { equals: globalSlug } },
  })
  const doc = docs[0]!

  return payload.update({
    id: doc.id,
    collection: instructionsCollectionSlug,
    data: { additionalInstructions },
    overrideAccess: false,
    user,
  })
}
