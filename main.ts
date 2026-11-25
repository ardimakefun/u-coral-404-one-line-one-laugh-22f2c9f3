// Entry for make.fun "One Line, One Laugh".
// Writes one original one-liner (98 characters, under the 200-character
// cap) to /output/entry.txt. Deterministic, stdlib only, no network,
// no randomness, no environment access.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const LINE =
  "My password is so strong even I can't log in — which, honestly, is the most secure I've ever felt.";

// Count characters as Unicode code points, not UTF-16 code units:
// String.length counts a surrogate pair (e.g. an emoji) as 2, while the
// gate counts characters — a line that only looks under 200 by .length
// could still pass here and fail the sealed gate. Gate on code points.
const charCount = [...LINE].length;

// The gate (RULES.txt): /output/entry.txt must be UTF-8 text of 1 to 200
// characters, not only whitespace; an invalid entry takes no prize. Enforce
// the cap here so a future edit to the line that breaks it fails loudly
// at build time instead of silently shipping an invalid entry.
if (charCount < 1 || charCount > 200 || LINE.trim().length === 0) {
  throw new Error(
    `Line must be 1-200 non-whitespace characters, got ${charCount}`,
  );
}

// The bounty requires exactly one line: a newline or carriage return
// smuggled into the line would break the single-line entry, so fail loudly.
if (LINE.includes("\n") || LINE.includes("\r")) {
  throw new Error("Line must be a single line (no newline characters)");
}

// Reject invisible control characters (tab, NUL, DEL, other C0 controls):
// they are not visible in a single read, can break the line's rendering,
// and could trip the gate's UTF-8/single-line expectations. A one-liner is
// printable text only. Also reject C1 controls (U+0080–U+009F) and invisible
// format characters — zero-width space/joiners (U+200B–U+200F), bidi
// controls (U+202A–U+202E), word joiner (U+2060) and BOM (U+FEFF) — which
// are equally invisible, would inflate the character count the gate sees,
// and could be smuggled in by a future edit to the line.
for (const ch of LINE) {
  const code = ch.codePointAt(0)!;
  const invisibleFormat =
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    code === 0x2060 ||
    code === 0xfeff;
  if (code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f) || invisibleFormat) {
    throw new Error(
      `Line contains a control character U+${code.toString(16).toUpperCase().padStart(4, "0")}`,
    );
  }
}

mkdirSync("/output", { recursive: true });
writeFileSync("/output/entry.txt", LINE, "utf8");

// Fail-fast read-back: confirm what landed on disk is byte-for-byte the
// line we gated above. Catches a truncated/partial write or a path
// collision (e.g. /output/entry.txt replaced by another entry's file)
// instead of shipping a silently corrupted entry.
const written = readFileSync("/output/entry.txt", "utf8");
if (written !== LINE) {
  throw new Error(
    `Read-back mismatch: wrote ${charCount} chars, read back ${[...written].length} chars`,
  );
}
