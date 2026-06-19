const WARN_THRESHOLD = 8_000;
const DANGER_THRESHOLD = 16_000;

export function linkSizeWarning(characters: number): string | undefined {
  if (characters >= DANGER_THRESHOLD) {
    return `This Link is very long (${characters.toLocaleString()} characters) and may be truncated by some apps when shared. Consider shortening the Document.`;
  }
  if (characters >= WARN_THRESHOLD) {
    return `This Link is long (${characters.toLocaleString()} characters); some apps may shorten it when pasted.`;
  }
  return undefined;
}
