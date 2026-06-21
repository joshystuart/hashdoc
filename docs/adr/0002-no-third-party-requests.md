# No third-party requests

The Viewer makes **no third-party network requests** — no analytics, no error tracking, no CDN-hosted fonts or scripts. Everything is bundled and self-hosted.

## Why

The product guarantees a Document never leaves the client. The browser itself never transmits the URL fragment (not in requests, not in `Referer`), so the _only_ way a Document can leak is client-side JavaScript that reads `location.href` and sends it somewhere — exactly what analytics and error-tracking scripts do. Loading even one such script would silently POST every Document to a third party. So we load none.

## Consequences

- **No usage metrics by default.** If metrics are ever added, they must strip the fragment before recording anything, and should be self-hosted.
- **Fonts and assets are bundled**, never pulled from a CDN.
- **Author-embedded remote images are the one exception**, and an honest one: a Document containing `![](https://…)` will cause the viewer's browser to fetch that image, revealing its IP to the image host. That request is initiated by the _author's content_, not by Viewer infrastructure, and is surfaced to authors as a caveat. The Viewer itself still originates zero third-party requests.
