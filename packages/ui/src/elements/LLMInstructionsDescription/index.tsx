'use client'

import React from 'react'

import { useDocumentInfo } from '../../providers/DocumentInfo/index.js'
import './index.css'

export const LLMInstructionsDescription = ({ isSystem = false }: { isSystem?: boolean }) => {
  const { data } = useDocumentInfo()
  const entityType = data?.type === 'global' ? 'global' : 'collection'

  return (
    <p className="llm-instructions__description">
      {isSystem
        ? `These system instructions are provided by the ${entityType}’s config file and are always included.`
        : `Add custom instructions for the ${data?.title || ''} ${entityType} to help LLMs tailor better prompt responses.`}
    </p>
  )
}
