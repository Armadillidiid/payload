'use client'

import { formatAdminURL, instructionsCollectionSlug } from 'payload/shared'
import React from 'react'

import { useAuth } from '../../providers/Auth/index.js'
import { useConfig } from '../../providers/Config/index.js'
import { useDocumentInfo } from '../../providers/DocumentInfo/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import * as PopupList from '../Popup/PopupButtonList/index.js'

export const LLMInstructionsMenuItem = ({ collectionSlug }: { collectionSlug?: string }) => {
  const { permissions } = useAuth()
  const { config } = useConfig()
  const { globalSlug } = useDocumentInfo()
  const { t } = useTranslation()
  const targetPermissions = collectionSlug
    ? permissions?.collections?.[collectionSlug]
    : globalSlug
      ? permissions?.globals?.[globalSlug]
      : undefined

  if (
    !permissions?.collections?.[instructionsCollectionSlug]?.update ||
    !targetPermissions?.read ||
    !targetPermissions?.update
  ) {
    return null
  }

  const id = collectionSlug ? `collection:${collectionSlug}` : `global:${globalSlug}`

  return (
    <React.Fragment>
      <PopupList.Divider />
      <PopupList.Button
        href={formatAdminURL({
          adminRoute: config.routes.admin,
          path: `/collections/${instructionsCollectionSlug}/${encodeURIComponent(id)}`,
        })}
      >
        {t('llmInstructions:editInstructions')}
      </PopupList.Button>
    </React.Fragment>
  )
}
