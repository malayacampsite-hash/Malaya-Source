# Malaya Campsite SEO deployment checklist

## Included in this release

- Search-friendly title and meta description on the public homepage.
- Canonical URL set to `https://www.malayacampsite.com/`.
- Open Graph and X/Twitter large-image metadata using `public/images/og-malaya.jpg` (1200 × 630).
- `LodgingBusiness` JSON-LD containing only known business facts and the stated location/contact details.
- `public/robots.txt` and `public/sitemap.xml`.
- Staff dashboard, review form, and not-found routes apply `noindex` metadata at runtime.
- High-priority preload of the main hero image.

## After deploying to Vercel

1. Open `https://www.malayacampsite.com/` and verify the homepage loads.
2. Open `https://www.malayacampsite.com/robots.txt` and confirm it includes the sitemap URL.
3. Open `https://www.malayacampsite.com/sitemap.xml` and confirm the XML has the canonical homepage URL.
4. In Google Search Console, verify the `www.malayacampsite.com` property (Domain property is preferred if you can add its DNS verification record), then submit `sitemap.xml` under **Indexing → Sitemaps**.
5. Use URL Inspection for the homepage and request indexing after the deployment is live.
6. Use the Facebook Sharing Debugger or another Open Graph preview checker to refresh the share cache after changing the social preview image.
7. Keep the business name, address, email, images, and booking details consistent across the site, Google Business Profile, and local listings.

## Notes

- Sitemap includes only the homepage because section IDs such as `#stay` and `#location` are parts of the same single-page URL, not separate pages.
- The `/review` page is deliberately noindex because it is intended for post-stay QR reviews, not search discovery.
- Technical SEO makes site information easier for crawlers to understand; it does not guarantee a particular rank or timeline.
- Canonical domain is `www`. Keep future absolute public URLs consistent with that host.
