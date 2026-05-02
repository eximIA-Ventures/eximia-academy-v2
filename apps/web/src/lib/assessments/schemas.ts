import { z } from "zod"

export const bigFiveResultSchema = z
  .object({
    openness: z.number().min(0).max(100),
    conscientiousness: z.number().min(0).max(100),
    extraversion: z.number().min(0).max(100),
    agreeableness: z.number().min(0).max(100),
    neuroticism: z.number().min(0).max(100),
  })
  .passthrough()

export type BigFiveResult = z.infer<typeof bigFiveResultSchema>

export const discResultSchema = z
  .object({
    d: z.number().min(0),
    i: z.number().min(0),
    s: z.number().min(0),
    c: z.number().min(0),
  })
  .passthrough()

export type DiscResult = z.infer<typeof discResultSchema>
