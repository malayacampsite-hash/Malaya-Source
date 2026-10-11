/** Apply noindex metadata to private/utility routes and restore the previous head on unmount. */
export function setNoIndexPageMetadata(title: string): () => void {
  const previousTitle = document.title
  let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
  const createdRobotsTag = !robots
  if (!robots) {
    robots = document.createElement('meta')
    robots.name = 'robots'
    document.head.appendChild(robots)
  }
  const previousRobotsContent = robots.content

  document.title = title
  robots.content = 'noindex, nofollow, noarchive'

  return () => {
    document.title = previousTitle
    if (!robots) return
    if (createdRobotsTag) robots.remove()
    else robots.content = previousRobotsContent
  }
}
