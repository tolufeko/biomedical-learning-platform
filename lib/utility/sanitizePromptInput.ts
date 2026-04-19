// lib/utility/sanitizePromptInput.ts

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

export function untrusted(value: unknown, maxLength = 500): string {
  return `<untrusted>${sanitizePromptInput(value, maxLength)}</untrusted>`;
}