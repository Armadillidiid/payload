import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { devUser } from '../credentials.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfigWithDefaults({
  suite: 'llm-instructions',
  disableMCP: true,
  seed: async (payload) => {
    const { totalDocs } = await payload.count({ collection: 'users' })

    if (!totalDocs) {
      await payload.create({ collection: 'users', data: devUser })
    }
  },
  config: {
    admin: { importMap: { baseDir: dirname } },
    collections: [
      { slug: 'users', auth: true, fields: [] },
      {
        slug: 'pages',
        access: { read: () => true },
        fields: [{ name: 'title', type: 'text' }],
        llmInstructions:
          '## System LLM instructions for the Pages Collection\n\n### What to Include\n\n- Use clear headings and concise page content.\n- Use the configured layout blocks.\n\n### What to Avoid\n\n- Do not publish a page without a title.',
      },
    ],
    globals: [{ slug: 'site-settings', fields: [{ name: 'title', type: 'text' }] }],
    llmInstructions: {
      access: ({ req }) => req.user?.email === devUser.email,
    },
    typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
