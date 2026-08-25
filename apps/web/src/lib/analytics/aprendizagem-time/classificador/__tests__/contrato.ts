import type {
  CapabilityCriterio,
  EvidenciaBruta,
  EvidenciaClassificada,
  SinaisEstruturados,
} from "../tipos"

const CAPABILITY_ID = "cap-uso-de-evidencia"

export function evidenciaClassificada(
  overrides: Partial<EvidenciaClassificada> = {},
): EvidenciaClassificada {
  return {
    id: overrides.id ?? `ev-${Math.random().toString(36).slice(2, 8)}`,
    studentId: "aluno-1",
    capabilityId: CAPABILITY_ID,
    evidenceCategory: "cognitive",
    sourceType: "reflection",
    comprehension: "evidenced",
    depthLevel: 4,
    applicationLevel: "not_evidenced",
    criteriaMet: [],
    occurredAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  }
}

const SINAIS_VAZIOS = {
  depthReached: null,
  bloomTarget: null,
  quizScorePct: null,
  overallScore: null,
  wordCount: null,
} as const

export function evidenciaBruta(
  overrides: Partial<Omit<EvidenciaBruta, "sinais">> & {
    sinais?: Partial<SinaisEstruturados>
  } = {},
): EvidenciaBruta {
  const { sinais, ...resto } = overrides
  return {
    studentId: "aluno-1",
    courseId: "curso-1",
    tenantId: "tenant-1",
    conceptId: null,
    capabilityId: CAPABILITY_ID,
    evidenceCategory: "cognitive",
    sourceType: "reflection",
    sourceTable: "slide_reflections",
    sourceId: "sr-1",
    occurredAt: "2026-08-01T00:00:00.000Z",
    textoBruto: null,
    ...resto,
    sinais: { ...SINAIS_VAZIOS, ...sinais },
  }
}

export const CRITERIOS_USO_DE_EVIDENCIA: CapabilityCriterio[] = [
  {
    id: "c1",
    capabilityId: CAPABILITY_ID,
    code: "UE-1",
    description: "Diferencia fato de opinião",
  },
  {
    id: "c2",
    capabilityId: CAPABILITY_ID,
    code: "UE-2",
    description: "Sustenta hipótese com dados",
  },
  { id: "c3", capabilityId: CAPABILITY_ID, code: "UE-3", description: "Referencia observação" },
  { id: "c4", capabilityId: CAPABILITY_ID, code: "UE-4", description: "Valida conclusão" },
  {
    id: "c5",
    capabilityId: CAPABILITY_ID,
    code: "UE-5",
    description: "Evita inferência sem evidência",
  },
]
