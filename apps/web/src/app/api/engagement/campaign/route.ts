// POST /api/engagement/campaign
// Engagement Center v2 (E3) — a COLLECTIVE campaign in two explicit modes
// (decision #8 of the epic: no campaign dispatches without a preview first):
//   • mode="preview"  → resolve the SCOPED recipient list + inclusion reason,
//                       send NOTHING. The manager reviews (and may remove ids).
//   • mode="confirm"  → dispatch to the explicitly-reviewed studentIds. The list
//                       is RE-SCOPED again server-side (a removed/foreign id can
//                       never slip back in), capped at MAX_RECIPIENTS.
//
// Security trava (AUTH → VALIDATE → RE-SCOPE → DISPATCH). RE-SCOPE uses
// resolveAudienceScoped (preview) / resolveEngagementScope (confirm) with the
// AUTHENTICATED client so a criteria/id set can never reach a foreign student.

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { resolveAudienceScoped } from "@/lib/notifications/audiences"
import { createCampaign } from "@/lib/notifications/campaigns"
import { readFocusParam, resolveEngagementScope } from "@/lib/notifications/engagement-scope"
import { computeEngagementTriage } from "@/lib/notifications/engagement-triage"
import {
  type CampaignRecipientVariation,
  NUDGE_TYPE_TEMPLATE_KEY,
  classifyNudgeCohorts,
  dispatchTeamNudge,
  firstNameOf,
  loadStudentSignals,
  renderTemplateString,
} from "@/lib/notifications/engine"
import { hasAnyRole } from "@/lib/role-helpers"
import { type StudentTriagem, computeStudentAction } from "@/lib/student-triage"
import { createServiceClient } from "@/lib/supabase/service"
import type { NotificationTemplateRow } from "@/types/notifications"
import type {
  CampaignSegment,
  NotificationAudienceCriteria,
  NudgeType,
  SenderIdentity,
} from "@/types/notifications"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_RECIPIENTS = 200 // same FinOps cap as api/analytics/manager/nudge

// E15 (E13 §4): the unified-semáforo segments a campaign can be launched from.
// Fatia 15: 'no_reflection' joins as a 4th, ORTHOGONAL segment — resolved via
// classifyNudgeCohorts/loadStudentSignals (engine.ts), not via StudentTriagem/
// computeEngagementTriage like the other 3 (see the branch below). Persisting
// it as campaigns.segment requires migration 20260716000000 (extends the DB
// CHECK) — that migration is NOT applied against any live database in this
// session, per Eng-Capataz decision 2026-07-16 (file ships now, apply later).
const CAMPAIGN_SEGMENTS: ReadonlySet<CampaignSegment> = new Set<CampaignSegment>([
  "atencao",
  "sem_acesso",
  "no_ritmo",
  "no_reflection",
])

const NUDGE_TYPES: ReadonlySet<NudgeType> = new Set<NudgeType>([
  "never_accessed",
  "inactive",
  "no_reflection",
  "top_performer",
  "announcement",
  "custom",
  "behind_teaching_plan",
])

type ServiceClient = ReturnType<typeof createServiceClient>

/**
 * Resolves the active-ish template for each derived nudgeType (via
 * NUDGE_TYPE_TEMPLATE_KEY), returning a key→row map. Only the distinct keys are
 * fetched (one query), so the segment preview renders every line without N reads.
 * A nudgeType with no seeded key or no active template is simply absent from the
 * map (that line renders empty text — the manager edits it in review).
 */
async function loadTemplatesForNudgeTypes(
  svc: ServiceClient,
  tenantId: string,
  nudgeTypes: NudgeType[],
): Promise<Map<string, NotificationTemplateRow>> {
  const keys = [
    ...new Set(nudgeTypes.map((t) => NUDGE_TYPE_TEMPLATE_KEY[t]).filter((k): k is string => !!k)),
  ]
  const byKey = new Map<string, NotificationTemplateRow>()
  if (keys.length === 0) return byKey
  const { data } = await svc
    .from("notification_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("key", keys)
  for (const row of (data ?? []) as NotificationTemplateRow[]) byKey.set(row.key, row)
  return byKey
}

/** Tenant's oldest non-archived course title, for the {{curso}} preview variable. */
async function resolveTenantCourseNameForPreview(
  svc: ServiceClient,
  tenantId: string,
): Promise<string | null> {
  const { data } = await svc
    .from("courses")
    .select("title")
    .eq("tenant_id", tenantId)
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(1)
  return ((data?.[0] as { title?: string } | undefined)?.title as string | undefined) ?? null
}

function sanitizeCriteria(raw: unknown): NotificationAudienceCriteria {
  const c: NotificationAudienceCriteria = {}
  if (!raw || typeof raw !== "object") return c
  const o = raw as Record<string, unknown>
  if (typeof o.risk === "string" && NUDGE_TYPES.has(o.risk as NudgeType))
    c.risk = o.risk as NudgeType
  if (typeof o.unit_id === "string" && UUID_RE.test(o.unit_id)) c.unit_id = o.unit_id
  if (typeof o.manager_group_id === "string" && UUID_RE.test(o.manager_group_id))
    c.manager_group_id = o.manager_group_id
  if (typeof o.course_id === "string" && UUID_RE.test(o.course_id)) c.course_id = o.course_id
  return c
}

export async function POST(request: Request) {
  // 1. AUTH
  const { user, profile, roles, supabase } = await getAuthProfile()
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!hasAnyRole({ roles }, ["admin", "manager", "instructor", "super_admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
  }

  // 2. VALIDATE
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const {
    mode,
    criteria,
    nudgeType,
    segment,
    studentIds,
    recipients: recipientsRaw,
    templateKey,
    message,
    senderIdentity,
    channel,
  } = body as {
    mode?: unknown
    criteria?: unknown
    nudgeType?: unknown
    segment?: unknown
    studentIds?: unknown
    recipients?: unknown
    templateKey?: unknown
    message?: unknown
    senderIdentity?: unknown
    channel?: unknown
  }
  if (mode !== "preview" && mode !== "confirm") {
    return NextResponse.json({ error: "mode must be preview|confirm" }, { status: 400 })
  }

  // E15: the NEW segment path (preview) and recipients path (confirm) derive the
  // nudgeType per aluno, so they do NOT require a top-level nudgeType. The LEGACY
  // E7 paths (criteria.risk preview + flat studentIds confirm) still require it —
  // retrocompat, so the E7 leak tests stay green.
  const hasSegment = mode === "preview" && typeof segment === "string"
  const hasRecipients = mode === "confirm" && Array.isArray(recipientsRaw)
  const nudgeTypeValid = typeof nudgeType === "string" && NUDGE_TYPES.has(nudgeType as NudgeType)
  if (!hasSegment && !hasRecipients && !nudgeTypeValid) {
    return NextResponse.json({ error: "Invalid nudgeType" }, { status: 400 })
  }
  if (hasSegment && !CAMPAIGN_SEGMENTS.has(segment as CampaignSegment)) {
    return NextResponse.json({ error: "Invalid segment" }, { status: 400 })
  }
  const identity: SenderIdentity =
    senderIdentity === "manager" || senderIdentity === "platform"
      ? (senderIdentity as SenderIdentity)
      : "platform"
  // Rodada 4 (E12): the channel the manager chose in the wizard. Only 'inapp'
  // and 'email' are meaningful; anything else (absent/malformed) falls back to
  // 'email' — the legacy behaviour where the email mirror rides whenever the
  // template supports it. An explicit 'inapp' SUPPRESSES the email mirror.
  const sendChannel: "inapp" | "email" = channel === "inapp" ? "inapp" : "email"

  // ----------------------------------------------------------------------
  // PREVIEW — resolve the SCOPED recipient set; send nothing. TWO paths:
  //   • NEW (E15 §4): `segment` = a semáforo state → resolveEngagementScope +
  //     computeEngagementTriage over the scoped set → the students in that state,
  //     each with a PER-ALUNO nudgeType (computeStudentAction) + pre-rendered text.
  //   • LEGACY (E7): `criteria.risk` → resolveAudienceScoped. Kept for retrocompat.
  // ----------------------------------------------------------------------
  if (mode === "preview") {
    const svc = createServiceClient()

    // NEW segment path (E15 AC1/AC2) — derive per-aluno nudgeType + template text.
    if (hasSegment) {
      const seg = segment as CampaignSegment
      // Re-scope with the AUTHENTICATED client, honouring ?focus= (same trava the
      // overview uses). A forged focus can only narrow (resolveEngagementScope).
      const allowed = await resolveEngagementScope(
        supabase,
        tenantId,
        user.id,
        roles,
        readFocusParam(request),
      )

      // Fatia 15: "no_reflection" is resolved from a DIFFERENT roster signal
      // (loadStudentSignals/classifyNudgeCohorts, engine.ts) than the other 3
      // segments (computeEngagementTriage/StudentTriagem) — it is an ORTHOGONAL
      // cohort (>=2 completed sessions, 0 reflections), not a semáforo state.
      // The per-aluno nudgeType is therefore FIXED to "no_reflection" for every
      // recipient here — computeStudentAction only understands the semáforo
      // taxonomy and would derive the wrong type (e.g. "inactive" by default)
      // for a student who is otherwise on pace.
      let segmentIds: string[]
      let triagemByStudent: Map<string, StudentTriagem> | undefined
      let sessionCountByStudent: Map<string, number> | undefined
      if (seg === "no_reflection") {
        const signals = await loadStudentSignals(svc, tenantId)
        const cohort = classifyNudgeCohorts(signals).find((c) => c.type === "no_reflection")
        const rawIds = cohort?.studentIds ?? []
        // RE-SCOPE (same discipline as every other segment/picker path — never
        // widen reach): intersect with the caller's allowed set.
        const allowedSet = allowed === null ? null : new Set(allowed)
        segmentIds = allowedSet === null ? rawIds : rawIds.filter((id) => allowedSet.has(id))
      } else {
        const triage = await computeEngagementTriage(svc, tenantId, allowed, Date.now())
        triagemByStudent = triage.triagemByStudent
        sessionCountByStudent = triage.sessionCountByStudent
        // Only the students in the requested segment (server-resolved — never a
        // client list). Order is stable (Map insertion = the triage read order).
        segmentIds = [...triagemByStudent.entries()]
          .filter(([, t]) => t === (seg as StudentTriagem))
          .map(([id]) => id)
      }
      const capped = segmentIds.slice(0, MAX_RECIPIENTS)

      // Derive the per-aluno nudgeType for the capped set only. "no_reflection"
      // is fixed for every recipient (see comment above); the 3 semáforo
      // segments go through computeStudentAction — single source of truth,
      // E13 §4.3, consumed never modified.
      const derivedByStudent = new Map<string, NudgeType>(
        capped.map((id) => {
          if (seg === "no_reflection") return [id, "no_reflection" as NudgeType]
          const action = computeStudentAction(
            triagemByStudent?.get(id),
            sessionCountByStudent?.get(id) ?? 0,
          )
          return [id, action && action.kind !== "none" ? action.nudgeType : "inactive"]
        }),
      )

      const nameRows = capped.length
        ? ((
            await svc
              .from("users")
              .select("id, full_name, report_name, email")
              .eq("tenant_id", tenantId)
              .in("id", capped)
          ).data ?? [])
        : []
      const nameById = new Map(
        (
          nameRows as {
            id: string
            full_name: string | null
            report_name: string | null
            email: string | null
          }[]
        ).map((r) => [r.id, r]),
      )
      // Resolve each distinct template ONCE (cache) + the tenant course name
      // ONCE, then render each line — unchanged for all 4 segments; only the
      // POPULATION + derivedNudgeType resolution above differs by segment.
      const templateByKey = await loadTemplatesForNudgeTypes(svc, tenantId, [
        ...new Set(derivedByStudent.values()),
      ])
      const needsCourse = [...templateByKey.values()].some((t) => t.variables.includes("curso"))
      const courseName = needsCourse ? await resolveTenantCourseNameForPreview(svc, tenantId) : null

      const detail = capped.map((id) => {
        const derivedNudgeType = derivedByStudent.get(id) ?? "inactive"
        const info = nameById.get(id)
        const key = NUDGE_TYPE_TEMPLATE_KEY[derivedNudgeType]
        const tpl = key ? templateByKey.get(key) : undefined
        const renderedText = tpl
          ? renderTemplateString(tpl.body_inapp, {
              // primeiro_nome vai NA mensagem que o aluno recebe → sempre o nome
              // real (full_name), nunca o report_name (rótulo do gestor).
              primeiro_nome: firstNameOf(info?.full_name),
              ...(courseName ? { curso: courseName } : {}),
            })
          : ""
        return {
          id,
          // fullName é o rótulo mostrado ao GESTOR na aba Campanhas → report_name.
          fullName: info?.report_name ?? info?.full_name ?? null,
          email: info?.email ?? null,
          reason: derivedNudgeType,
          nudgeType: derivedNudgeType,
          templateKey: key,
          renderedText,
        }
      })

      return NextResponse.json({
        mode: "preview",
        segment: seg,
        total: segmentIds.length,
        capped: segmentIds.length > MAX_RECIPIENTS,
        recipients: detail,
      })
    }

    // LEGACY criteria path (E7) — unchanged.
    const safeCriteria = sanitizeCriteria(criteria)
    const recipients = await resolveAudienceScoped(supabase, tenantId, user.id, roles, safeCriteria)
    const capped = recipients.slice(0, MAX_RECIPIENTS)
    const nameRows = capped.length
      ? ((
          await svc
            .from("users")
            .select("id, full_name, report_name, email")
            .eq("tenant_id", tenantId)
            .in("id", capped)
        ).data ?? [])
      : []
    const nameById = new Map(
      (
        nameRows as {
          id: string
          full_name: string | null
          report_name: string | null
          email: string | null
        }[]
      ).map((r) => [r.id, r]),
    )
    return NextResponse.json({
      mode: "preview",
      total: recipients.length,
      capped: recipients.length > MAX_RECIPIENTS,
      recipients: capped.map((id) => ({
        id,
        fullName: nameById.get(id)?.report_name ?? nameById.get(id)?.full_name ?? null,
        email: nameById.get(id)?.email ?? null,
        reason: typeof nudgeType === "string" ? nudgeType : "custom",
      })),
    })
  }

  // ----------------------------------------------------------------------
  // CONFIRM — dispatch to the explicitly-reviewed recipients, RE-SCOPED again.
  // TWO shapes accepted:
  //   • NEW (E15 AC3): `recipients: {studentId, message?, templateKey?}[]` — the
  //     per-line variation. The id set is recipients.map(studentId).
  //   • LEGACY (E7): flat `studentIds: string[]` + single `message`/`templateKey`.
  // Both re-scope + cap identically; the variation is applied AFTER the re-scope.
  // ----------------------------------------------------------------------

  // Normalise the request into a unified id list + per-id variation map.
  const variationByStudent = new Map<string, CampaignRecipientVariation>()
  let requestedIds: string[]
  if (hasRecipients) {
    const rows = recipientsRaw as unknown[]
    const parsed: { id: string; variation: CampaignRecipientVariation }[] = []
    for (const row of rows) {
      if (!row || typeof row !== "object") continue
      const r = row as Record<string, unknown>
      const sid = r.studentId
      if (typeof sid !== "string" || !UUID_RE.test(sid)) {
        return NextResponse.json({ error: "recipients[].studentId must be UUIDs" }, { status: 400 })
      }
      if (r.message !== undefined && r.message !== null && typeof r.message !== "string") {
        return NextResponse.json(
          { error: "recipients[].message must be a string" },
          { status: 400 },
        )
      }
      if (
        r.templateKey !== undefined &&
        r.templateKey !== null &&
        typeof r.templateKey !== "string"
      ) {
        return NextResponse.json(
          { error: "recipients[].templateKey must be a string" },
          { status: 400 },
        )
      }
      parsed.push({
        id: sid,
        variation: {
          studentId: sid,
          message: typeof r.message === "string" ? r.message : null,
          templateKey: typeof r.templateKey === "string" ? r.templateKey : null,
        },
      })
    }
    if (parsed.length === 0) {
      return NextResponse.json({ error: "recipients is required for confirm" }, { status: 400 })
    }
    for (const p of parsed) variationByStudent.set(p.id, p.variation)
    requestedIds = [...variationByStudent.keys()]
  } else {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: "studentIds is required for confirm" }, { status: 400 })
    }
    requestedIds = [...new Set(studentIds)]
    if (!requestedIds.every((id) => typeof id === "string" && UUID_RE.test(id))) {
      return NextResponse.json({ error: "studentIds must be UUIDs" }, { status: 400 })
    }
    if (templateKey !== undefined && templateKey !== null && typeof templateKey !== "string") {
      return NextResponse.json({ error: "templateKey must be a string" }, { status: 400 })
    }
    if (message !== undefined && message !== null && typeof message !== "string") {
      return NextResponse.json({ error: "message must be a string" }, { status: 400 })
    }
  }

  // Cap of 200 (E13 §6 inegociável 1 / AC5): on the SUBMITTED list, before scope.
  if (requestedIds.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `Too many recipients (max ${MAX_RECIPIENTS})` },
      { status: 400 },
    )
  }

  // 3. RE-SCOPE — the reviewed list is filtered to the caller's reach again
  // (E13 §6 inegociável 3, byte-for-byte with E7). This happens BEFORE any
  // variation is assembled, so an out-of-scope id (and its variation) is dropped.
  // Rodada 3: honour the drill-down `?focus=`.
  const allowedStudentIds = await resolveEngagementScope(
    supabase,
    tenantId,
    user.id,
    roles,
    readFocusParam(request),
  )
  const safeIds =
    allowedStudentIds === null
      ? (requestedIds as string[])
      : (requestedIds as string[]).filter((id) => new Set(allowedStudentIds).has(id))
  const droppedOutsideScope = requestedIds.length - safeIds.length
  if (safeIds.length === 0) {
    return NextResponse.json(
      { error: "No recipients within your scope", recipientsSkipped: droppedOutsideScope },
      { status: 400 },
    )
  }

  // The campaign header segment (E14): the semáforo state the batch was launched
  // from. Accepted on confirm; defaults to 'atencao' (the CHECK's default) when
  // the UI does not supply it. focus_node = the current drill-down node.
  const headerSegment: CampaignSegment =
    typeof segment === "string" && CAMPAIGN_SEGMENTS.has(segment as CampaignSegment)
      ? (segment as CampaignSegment)
      : "atencao"
  const focusNode = readFocusParam(request)

  // Build the per-line variation array restricted to the SAFE ids only (an out-of-
  // scope id never re-enters via its variation). nudgeType for the batch default:
  // the top-level one when valid, else 'inactive' (a safe generic for the header).
  const batchNudgeType: NudgeType = nudgeTypeValid ? (nudgeType as NudgeType) : "inactive"
  const scopedRecipients: CampaignRecipientVariation[] | null = hasRecipients
    ? safeIds.map((id) => variationByStudent.get(id) ?? { studentId: id })
    : null

  // 4. DISPATCH — senderName server-trusted when manager identity.
  const senderName =
    identity === "manager" ? ((profile as { full_name?: string | null }).full_name ?? null) : null
  try {
    // E15 AC6: create the campaign HEADER first (service client, stamped tenant +
    // created_by). If this fails, the dispatch does NOT happen (header before
    // messages — no orphan notifications without a campaign).
    const campaign = await createCampaign({
      tenantId,
      createdBy: user.id,
      segment: headerSegment,
      focusNode,
    })

    const result = await dispatchTeamNudge({
      tenantId,
      studentIds: safeIds,
      nudgeType: batchNudgeType,
      templateKey: typeof templateKey === "string" ? templateKey : null,
      message: typeof message === "string" ? message : null,
      courseId: null,
      originManagerId: user.id,
      senderIdentity: identity,
      senderName,
      channel: sendChannel,
      recipients: scopedRecipients,
      campaignId: campaign.id,
    })
    return NextResponse.json({
      mode: "confirm",
      campaignId: campaign.id,
      windowEnd: campaign.window_end,
      status: campaign.status,
      inAppCreated: result.inAppCreated,
      emailsSent: result.emailsSent,
      emailsFailed: result.emailsFailed,
      recipientsSkipped: droppedOutsideScope + result.recipientsSkipped,
      total: result.total,
    })
  } catch (err) {
    console.error("[engagement/campaign] dispatch error:", err)
    const messageText = err instanceof Error ? err.message : "Failed to dispatch campaign"
    return NextResponse.json({ error: messageText }, { status: 500 })
  }
}
