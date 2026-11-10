// `#tags` in text. The rules match the core's parse_tags exactly.

export interface TagRange {
  /** Offset of the `#`. */
  from: number;
  /** Offset just after the tag's last character. */
  to: number;
  tag: string;
}

const OPENERS = "([{\"'";
const isWordChar = (c: string) => /[\p{L}\p{N}_-]/u.test(c);

/** Each tag in `text` with its position (UTF-16 offsets), in order. */
export function findTags(text: string): TagRange[] {
  const found: TagRange[] = [];
  const chars = Array.from(text);
  let offset = 0;
  let previous: string | null = null;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const atBoundary = previous === null || /\s/u.test(previous) || OPENERS.includes(previous);
    previous = c;
    if (c !== "#" || !atBoundary) {
      offset += c.length;
      continue;
    }
    const start = offset;
    offset += c.length;
    let body = "";
    while (i + 1 < chars.length && isWordChar(chars[i + 1])) {
      i++;
      body += chars[i];
      previous = chars[i];
      offset += chars[i].length;
    }
    const trimmed = body.replace(/[-_]+$/u, "");
    if (/\p{L}/u.test(trimmed)) {
      found.push({ from: start, to: start + 1 + trimmed.length, tag: trimmed.toLowerCase() });
    }
  }
  return found;
}

/** The tags in `text`, lowercased, each once, in order of first use. */
export function parseTags(text: string): string[] {
  return [...new Set(findTags(text).map((t) => t.tag))];
}
