import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface Route {
  path: string
  segments: string[]
  query: URLSearchParams
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [pathname, search] = raw.split('?')
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  return {
    path: `/${segments.join('/')}`,
    segments,
    query: new URLSearchParams(search ?? ''),
  }
}

interface RouterValue {
  route: Route
  navigate: (to: string, opts?: { replace?: boolean }) => void
  back: () => void
}

const RouterContext = createContext<RouterValue | null>(null)

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parseHash())

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.history.replaceState(null, '', `${window.location.pathname}#/`)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const value = useMemo<RouterValue>(
    () => ({
      route,
      navigate: (to, opts) => {
        const target = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : `/${to}`}`
        if (window.location.hash === target) return
        if (opts?.replace) {
          window.history.replaceState(null, '', target)
          setRoute(parseHash())
        } else {
          window.location.hash = target
        }
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      },
      back: () => window.history.back(),
    }),
    [route],
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider')
  return ctx
}
