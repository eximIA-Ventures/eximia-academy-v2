import { z } from "zod"

// --- Input Schema ---

export const editorInputSchema = z.object({
  orientador_response: z.string().min(30),
  context: z
    .object({
      session_id: z.string().optional(),
      chapter_title: z.string().optional(),
      student_message: z.string().optional(),
      interaction_number: z.number().int().min(1).max(3).optional(),
    })
    .optional(),
  preferences: z
    .object({
      max_words: z.number().int().default(200),
      min_words: z.number().int().default(80),
      tone: z.enum(["acolhedor", "neutro", "provocativo"]).default("acolhedor"),
    })
    .optional(),
})

export type EditorInput = z.infer<typeof editorInputSchema>

// --- Output Schema ---

export const editorOutputSchema = z.object({
  edited_response: z.object({
    content: z.string().min(80).max(1500),
    paragraph_1: z.string().nullable(),
    paragraph_2: z.string().nullable(),
    paragraph_count: z.literal(2),
    word_count: z.number().int().min(80).max(200).nullable(),
    ends_with_question: z.literal(true),
  }),
  changes_made: z
    .object({
      labels_removed: z.array(z.string()).nullable(),
      formatting_removed: z.array(z.string()).nullable(),
      paragraphs_restructured: z.boolean().nullable(),
      content_condensed: z.boolean().nullable(),
      words_removed: z.number().int().nullable(),
    })
    .nullable(),
  quality_checks: z
    .object({
      no_labels: z.boolean(),
      two_paragraphs: z.boolean(),
      ends_with_question: z.boolean(),
      within_word_limit: z.boolean(),
      meaning_preserved: z.boolean(),
    })
    .nullable(),
})

export type EditorOutput = z.infer<typeof editorOutputSchema>
