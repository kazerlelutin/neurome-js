export function matchRoute(url, routes) {
  for (const route of routes) {
    const regex = new RegExp('^' + route.path.replace(/:\w+/g, '([^/]+)') + '$')
    const match = url.match(regex)
    if (match) {
      return route
    }
  }
  return null
}
