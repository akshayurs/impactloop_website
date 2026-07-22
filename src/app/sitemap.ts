import type { MetadataRoute } from 'next'
import { APPS } from '@/config/apps'
import { SITE_URL } from '@/config/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/apps', '/pricing', '/faq', '/partners', '/about', '/changelog', '/terms', '/privacy', '/refund', '/contact', ...APPS.map((a) => `/apps/${a.id}`)]
  return routes.map((r) => ({ url: `${SITE_URL}${r}`, changeFrequency: 'weekly' }))
}
