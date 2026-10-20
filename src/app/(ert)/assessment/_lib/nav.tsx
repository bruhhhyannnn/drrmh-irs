'use client';

// Moving between the hub, a draft (?draft=) and a submitted assessment (?view=). They're one
// route, so these use history.pushState / replaceState, which Next's router picks up (it
// updates useSearchParams) without asking the server for the page again. That keeps working
// offline after the router's cached copy of the route has expired; a <Link> or router.push to
// a new ?draft= would need the network then.

/** `query` is '' for the hub, or e.g. `?draft=…`. */
export function goToAssessment(query: string, mode: 'push' | 'replace' = 'push') {
  const url = `/assessment${query}`;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
  window.scrollTo({ top: 0 });
}

/** A real link (it opens in a new tab as usual) that moves within /assessment without a fetch. */
export function AssessmentLink({
  query,
  className,
  children,
}: {
  query: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`/assessment${query}`}
      className={className}
      onClick={(e) => {
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        e.preventDefault();
        goToAssessment(query);
      }}
    >
      {children}
    </a>
  );
}
