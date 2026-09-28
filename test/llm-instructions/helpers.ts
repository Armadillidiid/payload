import type { Payload, PayloadRequest } from 'payload'

import { instructionsCollectionSlug } from 'payload/shared'
import { expect } from 'vitest'

import type { PayloadLlmInstruction } from './payload-types.js'

import { devUser } from '../credentials.js'

export const additionalInstructions: NonNullable<PayloadLlmInstruction['additionalInstructions']> =
  {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text: 'Keep page summaries under 100 words.',
              version: 1,
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          textFormat: 0,
          textStyle: '',
          version: 1,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  }

export const saveAdditionalInstructions = async ({
  collectionSlug,
  globalSlug,
  payload,
}: {
  collectionSlug?: string
  globalSlug?: string
  payload: Payload
}) => {
  const { user } = await payload.login({ collection: 'users', data: devUser })
  const doc = await findInstructions({ collectionSlug, globalSlug, payload, user })

  return payload.update({
    id: doc.id,
    collection: instructionsCollectionSlug,
    data: { additionalInstructions },
    overrideAccess: false,
    user,
  })
}

export const findInstructions = async ({
  collectionSlug,
  globalSlug,
  payload,
  user,
}: {
  collectionSlug?: string
  globalSlug?: string
  payload: Payload
  user: PayloadRequest['user']
}) => {
  const { docs } = await payload.find({
    collection: instructionsCollectionSlug,
    overrideAccess: false,
    user,
    where: collectionSlug
      ? { collectionSlug: { equals: collectionSlug } }
      : { globalSlug: { equals: globalSlug } },
  })

  expect(docs).toHaveLength(1)

  return docs[0]!
}
