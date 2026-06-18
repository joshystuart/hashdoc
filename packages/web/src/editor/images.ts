/**
 * Pure helpers for detecting images embedded in markdown source. A UI concern
 * (the Editor warns the Author about them), so it lives in the web package
 * rather than core. Parsing the markdown *source* keeps detection deterministic
 * and testable — independent of the rendered DOM.
 *
 * Two sharp edges motivate the warning (issue-11):
 *  1. Payload bloat — every image inflates the Link; data-URI images especially,
 *     because the bytes ride inside the Link itself.
 *  2. IP leak — a remote `http(s)://` image is the one honest exception to "no
 *     third-party requests" (ADR 0002): the Viewer's browser fetches it, which
 *     reveals the Reader's IP address to the image host.
 */

/**
 * Matches a markdown image: `![alt](url ...)`. The url runs up to the first
 * whitespace or closing paren so an optional `"title"` is ignored. Global so a
 * single document with several images yields every match.
 */
const IMAGE_RE = /!\[[^\]]*\]\(\s*(\S+?)\s*(?:"[^"]*")?\s*\)/g;

/** Distinguishes the two kinds of embedded image we warn about differently. */
export interface ImagePresence {
  /** Any markdown image at all. */
  readonly any: boolean;
  /** A remote `http(s)://` image — the IP-leak case (ADR 0002). */
  readonly remote: boolean;
  /** An inline `data:` URI image — the worst payload-bloat case. */
  readonly data: boolean;
}

/** Returns true when the markdown source contains at least one image. */
export function hasImages(markdown: string): boolean {
  IMAGE_RE.lastIndex = 0;
  return IMAGE_RE.test(markdown);
}

/**
 * Classifies the images present in the markdown source: whether any exist, and
 * whether remote and/or data-URI images are among them. Used to tailor the
 * Editor's advisory warning copy.
 */
export function classifyImages(markdown: string): ImagePresence {
  let any = false;
  let remote = false;
  let data = false;
  IMAGE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMAGE_RE.exec(markdown)) !== null) {
    any = true;
    const url = match[1] ?? '';
    if (/^https?:\/\//i.test(url)) {
      remote = true;
    } else if (/^data:/i.test(url)) {
      data = true;
    }
  }
  return { any, remote, data };
}
