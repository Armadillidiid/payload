import { assert, describe, expect, it, vi } from 'vitest'

import type { RichTextAdapter } from '../admin/RichText.js'
import type { Config } from '../config/types.js'

import { sanitizeConfig } from '../config/sanitize.js'
import { instructionsCollectionSlug } from './shared.js'

const createConfig = ({
  editor,
  llmInstructions,
}: {
  editor?: Config['editor']
  llmInstructions?: Config['llmInstructions']
} = {}) =>
  sanitizeConfig({
    collections: [{ slug: 'pages', fields: [], llmInstructions: 'Keep titles concise.' }],
    db: {
      defaultIDType: 'text',
      // @ts-expect-error Configuration tests do not connect to a database.
      init: () => undefined,
    },
    editor,
    globals: [{ slug: 'settings', fields: [], llmInstructions: 'Preserve navigation links.' }],
    llmInstructions,
    secret: 'test',
  })

describe('LLM instructions config', () => {
  it('should support projects without a rich-text editor or MCP plugin', () => {
    const config = createConfig()
    const collection = config.collections.find(({ slug }) => slug === instructionsCollectionSlug)
    const additionalInstructions = collection?.flattenedFields.find(
      ({ name }) => name === 'additionalInstructions',
    )

    expect(additionalInstructions?.type).toBe('textarea')
    expect(config.collections[0]?.admin.components?.listMenuItems).toContain(
      '@payloadcms/ui#LLMInstructionsMenuItem',
    )
    expect(config.globals[0]?.admin.components?.edit?.editMenuItems).toContain(
      '@payloadcms/ui#LLMInstructionsMenuItem',
    )
  })

  it('should allow disabling instruction management while retaining configured instructions', () => {
    const preset = vi.fn(() => createEditor())
    const config = createConfig({
      editor: () => createEditor({ presets: { llmInstructions: preset } }),
      llmInstructions: false,
    })

    expect(preset).not.toHaveBeenCalled()
    expect(config.collections.some(({ slug }) => slug === instructionsCollectionSlug)).toBe(false)
    expect(config.collections[0]?.admin.components?.listMenuItems ?? []).not.toContain(
      '@payloadcms/ui#LLMInstructionsMenuItem',
    )
    expect(config.collections[0]?.llmInstructions).toBe('Keep titles concise.')
  })

  it('should use the root editor instructions preset for both tabs', () => {
    const preset = vi.fn(() => createEditor({ FieldComponent: 'test#InstructionsEditor' }))
    const config = createConfig({
      editor: () => createEditor({ presets: { llmInstructions: preset } }),
    })
    const collection = config.collections.find(({ slug }) => slug === instructionsCollectionSlug)

    expect(preset).toHaveBeenCalledOnce()
    expect(preset).toHaveBeenCalledWith({ config, isRoot: false, parentIsLocalized: false })

    for (const name of ['additionalInstructions', 'systemInstructions']) {
      const field = collection?.flattenedFields.find((field) => field.name === name)

      assert(field?.type === 'richText')
      expect(field.editor).toMatchObject({ FieldComponent: 'test#InstructionsEditor' })
    }
  })

  it('should prefer an explicit instructions editor over the root preset', () => {
    const preset = vi.fn(() => createEditor())
    const config = createConfig({
      editor: () => createEditor({ presets: { llmInstructions: preset } }),
      llmInstructions: { editor: () => createEditor({ FieldComponent: 'test#CustomEditor' }) },
    })
    const collection = config.collections.find(({ slug }) => slug === instructionsCollectionSlug)
    const field = collection?.flattenedFields.find(({ name }) => name === 'additionalInstructions')

    assert(field?.type === 'richText')
    expect(field.editor).toMatchObject({ FieldComponent: 'test#CustomEditor' })
    expect(preset).not.toHaveBeenCalled()
  })

  it('should support an explicit instructions editor without a root editor', () => {
    const config = createConfig({ llmInstructions: { editor: () => createEditor() } })
    const collection = config.collections.find(({ slug }) => slug === instructionsCollectionSlug)

    expect(
      collection?.flattenedFields.find(({ name }) => name === 'additionalInstructions')?.type,
    ).toBe('richText')
  })

  it('should use a textarea when the root editor does not provide an instructions preset', () => {
    const config = createConfig({ editor: () => createEditor() })
    const collection = config.collections.find(({ slug }) => slug === instructionsCollectionSlug)

    expect(
      collection?.flattenedFields.find(({ name }) => name === 'additionalInstructions')?.type,
    ).toBe('textarea')
  })

  it.each(['fromMarkdown', 'toMarkdown'] as const)(
    'should use a textarea when the preset does not provide %s',
    (converter) => {
      const editor = createEditor()

      delete editor.converters![converter]

      const config = createConfig({
        editor: () => createEditor({ presets: { llmInstructions: () => editor } }),
      })
      const collection = config.collections.find(({ slug }) => slug === instructionsCollectionSlug)

      expect(
        collection?.flattenedFields.find(({ name }) => name === 'additionalInstructions')?.type,
      ).toBe('textarea')
    },
  )
})

const createEditor = (overrides: Partial<RichTextAdapter> = {}): RichTextAdapter => ({
  CellComponent: 'test#Cell',
  converters: {
    fromMarkdown: ({ markdown }) => ({ text: markdown }),
    toMarkdown: ({ data }) => data.text,
  },
  FieldComponent: 'test#Editor',
  validate: () => true,
  ...overrides,
})
