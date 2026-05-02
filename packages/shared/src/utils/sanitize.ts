const PROMPT_DELIMITERS = [
  "<system>",
  "</system>",
  "<|im_start|>",
  "<|im_end|>",
  "[INST]",
  "[/INST]",
  "<<SYS>>",
  "<</SYS>>",
]

export function sanitizeStudentMessage(content: string): string {
  let sanitized = content
  // Strip HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, "")
  // Strip control characters (preserve newline \n and tab \t)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentional security sanitization to strip dangerous control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
  // Strip prompt delimiters
  for (const delimiter of PROMPT_DELIMITERS) {
    sanitized = sanitized.replaceAll(delimiter, "")
  }
  return sanitized.trim()
}
