import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LabEntry } from '@/views/LabEntry'
import { buildMetadata } from '@/lib/seo'
import { getLabEntry, labSlugs } from '@/data/lab'
import { getDictionary } from '@/i18n/dictionary'

/**
 * A Lab entry. Prerendered from the registry, as species pages are: the
 * entries change with content releases, not per request.
 */

export function generateStaticParams() {
  return labSlugs().map((slug) => ({ slug }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const entry = getLabEntry(slug)
  if (!entry) return {}

  const copy = getDictionary('en').lab.entries[entry.slug]
  return buildMetadata({
    locale: 'en',
    path: `/lab/${entry.slug}`,
    title: copy.title,
    description: copy.summary,
    type: 'article',
  })
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const entry = getLabEntry(slug)
  if (!entry) notFound()

  return <LabEntry entry={entry} locale="en" />
}
