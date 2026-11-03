"use client"

import { useAttachmentSrc } from "@/components/use-attachment-src"

export function ClosetPhoto({ uri, className }: { uri?: string; className?: string }) {
  const src = useAttachmentSrc(uri)
  if (!src) return null
  return <img className={className} src={src} alt="" />
}
