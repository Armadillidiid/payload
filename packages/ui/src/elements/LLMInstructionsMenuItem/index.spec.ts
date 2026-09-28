import type { SanitizedPermissions } from 'payload'
import type { ReactNode } from 'react'

import { instructionsCollectionSlug } from 'payload/shared'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LLMInstructionsMenuItem } from './index.js'

const mocks = vi.hoisted(() => ({
  globalSlug: undefined as string | undefined,
  permissions: {} as SanitizedPermissions,
}))

vi.mock('../../providers/Auth/index.js', () => ({
  useAuth: () => ({ permissions: mocks.permissions }),
}))

vi.mock('../../providers/Config/index.js', () => ({
  useConfig: () => ({ config: { routes: { admin: '/admin' } } }),
}))

vi.mock('../../providers/DocumentInfo/index.js', () => ({
  useDocumentInfo: () => ({ globalSlug: mocks.globalSlug }),
}))

vi.mock('../Popup/PopupButtonList/index.js', () => ({
  Button: ({ children, href }: { children: ReactNode; href: string }) =>
    createElement('a', { href }, children),
  Divider: () => createElement('hr'),
}))

describe('LLM instructions menu item', () => {
  beforeEach(() => {
    mocks.globalSlug = undefined
    mocks.permissions = {
      collections: { [instructionsCollectionSlug]: { fields: true, update: true } },
    }
  })

  for (const type of ['collection', 'global'] as const) {
    const render = () => {
      mocks.globalSlug = type === 'global' ? 'settings' : undefined

      return renderToStaticMarkup(
        createElement(LLMInstructionsMenuItem, {
          collectionSlug: type === 'collection' ? 'pages' : undefined,
        }),
      )
    }
    const setTargetPermissions = ({ read, update }: { read?: true; update?: true }) => {
      const permissions = { fields: true as const, read, update }

      if (type === 'collection') {
        mocks.permissions.collections!.pages = permissions
      } else {
        mocks.permissions.globals = { settings: permissions }
      }
    }

    it(`should link directly to ${type} instructions when read and update are allowed`, () => {
      setTargetPermissions({ read: true, update: true })

      expect(render()).toContain(
        `/admin/collections/${instructionsCollectionSlug}/${type}%3A${type === 'collection' ? 'pages' : 'settings'}`,
      )
    })

    it(`should hide the menu item without ${type} read access`, () => {
      setTargetPermissions({ update: true })

      expect(render()).toBe('')
    })

    it(`should hide the menu item without ${type} update access`, () => {
      setTargetPermissions({ read: true })

      expect(render()).toBe('')
    })

    it(`should hide the menu item without ${type} permissions`, () => {
      expect(render()).toBe('')
    })

    it(`should hide the menu item without instructions update access for a ${type}`, () => {
      setTargetPermissions({ read: true, update: true })
      delete mocks.permissions.collections![instructionsCollectionSlug].update

      expect(render()).toBe('')
    })
  }
})
