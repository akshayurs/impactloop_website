import type { MetadataRoute } from 'next'
import { APPS } from '@/config/apps'
import { SITE_URL } from '@/config/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/pricing', '/faq', '/partners', '/terms', '/privacy', ...APPS.map((a) => `/apps/${a.id}`)]
  return routes.map((r) => ({ url: `${SITE_URL}${r}`, changeFrequency: 'weekly' }))
}
