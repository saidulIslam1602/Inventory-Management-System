import * as React from "react";

const MOBILE_BREAKPOINT = 768;

const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * Mobile breakpoint hook safe for SSR + hydration.
 *
 * We intentionally start as `false` on server and on the client's first render so the
 * hydrated tree matches the server HTML. After mount we sync to `matchMedia`, which may
 * swap layout (e.g. sidebar Sheet vs desktop rail). Using `useSyncExternalStore` with a
 * server snapshot of `false` but a live `getSnapshot()` on mobile caused hydration to
 * render a different subtree than the server — React then threw
 * `removeChild` / NotFoundError during reconciliation.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  return isMobile;
}
