// lib/utility/sanitizePromptInput.ts

/**
 * Sanitises a user-supplied string before interpolation into an LLM prompt.
 *
 * What it does:
 * 1. Strips ASCII control characters (including \r, null bytes, etc.)
 *    — newlines (\n) are replaced with a space so multi-line injection
 *    attempts ("Ignore above\nNew instruction:") collapse into one line.
 * 2. Escapes backticks so the value cannot break out of a markdown code fence.
 * 3. Escapes angle brackets so the value cannot spoof the <untrusted> /
 *    </untrusted> delimiters we wrap every user value in.
 * 4. Trims leading/trailing whitespace.
 * 5. Enforces a maximum length to prevent prompt-stuffing attacks.
 */
export function sanitizePromptInput(value: unknown, maxLength = 500): string {
  if (value === null || value === undefined) return '';

  return String(value)
    // Replace all control characters (0x00–0x1F except \n, \t) with a space
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    // Collapse newlines / carriage returns into a single space
    .replace(/[\r\n]+/g, ' ')
    // Escape backticks
    .replace(/`/g, '\\`')
    // Escape angle brackets to prevent delimiter spoofing
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim()
    .slice(0, maxLength);
}

/**
 * Wraps a sanitised user value in explicit "untrusted data" delimiters.
 * This tells the model — at the structural level — that the enclosed text
 * is data to be processed, not an instruction to be followed.
 */
export function untrusted(value: unknown, maxLength = 500): string {
  return `<untrusted>${sanitizePromptInput(value, maxLength)}</untrusted>`;
}