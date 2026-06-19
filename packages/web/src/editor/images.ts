const IMAGE_RE = /!\[[^\]]*\]\(\s*(\S+?)\s*(?:"[^"]*")?\s*\)/g;

export interface ImagePresence {
  readonly any: boolean;
  readonly remote: boolean;
  readonly data: boolean;
}

export function hasImages(markdown: string): boolean {
  IMAGE_RE.lastIndex = 0;
  return IMAGE_RE.test(markdown);
}

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
