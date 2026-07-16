import { describe, expect, it } from "vitest"
import {
  bandIndexForProgress,
  computeStreakDays,
  computeWeekCells,
  parseWeeklyPlan,
  pctToNextBand,
  progressToPct,
  relativeDayLabel,
} from "../journey"

// Wednesday 2026-07-15 15:00 Sao Paulo time (18:00 UTC)
const NOW = new Date("2026-07-15T18:00:00Z")

describe("progressToPct", () => {
  it("accepts plain numbers and clamps to 0-100", () => {
    expect(progressToPct(50)).toBe(50)
    expect(progressToPct(140)).toBe(100)
    expect(progressToPct(-5)).toBe(0)
  })

  it("accepts { percentage } objects and rejects garbage", () => {
    expect(progressToPct({ percentage: 72 })).toBe(72)
    expect(progressToPct("nope")).toBe(0)
    expect(progressToPct(null)).toBe(0)
  })
})

describe("bandIndexForProgress / pctToNextBand", () => {
  it("maps progress to the 5 journey bands", () => {
    expect(bandIndexForProgress(0)).toBe(0)
    expect(bandIndexForProgress(9)).toBe(0)
    expect(bandIndexForProgress(10)).toBe(1)
    expect(bandIndexForProgress(45)).toBe(2)
    expect(bandIndexForProgress(70)).toBe(3)
    expect(bandIndexForProgress(100)).toBe(4)
  })

  it("computes distance to next band, null at the last band", () => {
    expect(pctToNextBand(45)).toBe(25)
    expect(pctToNextBand(99)).toBe(1)
    expect(pctToNextBand(100)).toBeNull()
  })
})

describe("computeStreakDays", () => {
  it("counts consecutive days ending today", () => {
    const sessions = ["2026-07-15T12:00:00Z", "2026-07-14T12:00:00Z", "2026-07-13T12:00:00Z"]
    expect(computeStreakDays(sessions, NOW)).toBe(3)
  })

  it("still counts a streak ending yesterday (today without activity yet)", () => {
    const sessions = ["2026-07-14T12:00:00Z", "2026-07-13T12:00:00Z"]
    expect(computeStreakDays(sessions, NOW)).toBe(2)
  })

  it("returns 0 when the last activity is older than yesterday", () => {
    expect(computeStreakDays(["2026-07-10T12:00:00Z"], NOW)).toBe(0)
    expect(computeStreakDays([], NOW)).toBe(0)
  })
})

describe("computeWeekCells", () => {
  const plan = { goal: 3, days: [0, 1, 2, 4], reminder: { enabled: true, time: "08h" } }

  it("marks done, today, scheduled, missed and rest days", () => {
    const cells = computeWeekCells({
      plan,
      // Monday of this week had a session; Tuesday (planned) had none
      weekSessions: [{ createdAt: "2026-07-13T12:00:00Z", chapterTitle: "Analise de Causa" }],
      nextChapterTitle: "Diagrama de Ishikawa",
      now: NOW,
    })

    expect(cells).toHaveLength(7)
    expect(cells[0]).toMatchObject({ dow: "Seg", state: "done", task: "Analise de Causa" })
    expect(cells[1]).toMatchObject({ dow: "Ter", state: "missed" })
    expect(cells[2]).toMatchObject({ dow: "Qua", state: "today", task: "Diagrama de Ishikawa" })
    expect(cells[3]).toMatchObject({ dow: "Qui", state: "rest", task: "Descanso" })
    expect(cells[4]).toMatchObject({ dow: "Sex", state: "scheduled" })
    expect(cells[6]).toMatchObject({ dow: "Dom", state: "rest" })
  })

  it("marks a session done today even on a planned day", () => {
    const cells = computeWeekCells({
      plan,
      weekSessions: [{ createdAt: "2026-07-15T13:00:00Z", chapterTitle: "Feita hoje" }],
      nextChapterTitle: null,
      now: NOW,
    })

    expect(cells[2]).toMatchObject({ dow: "Qua", state: "done", task: "Feita hoje" })
  })
})

describe("relativeDayLabel", () => {
  it("labels hoje, ontem and older days", () => {
    expect(relativeDayLabel("2026-07-15T14:00:00Z", NOW)).toBe("hoje")
    expect(relativeDayLabel("2026-07-14T14:00:00Z", NOW)).toBe("ontem")
    expect(relativeDayLabel("2026-07-11T14:00:00Z", NOW)).toBe("há 4 dias")
  })
})

describe("parseWeeklyPlan", () => {
  it("parses a valid stored plan", () => {
    const plan = parseWeeklyPlan({
      goal: 4,
      days: [0, 2, 4],
      reminder: { enabled: true, time: "19h" },
    })
    expect(plan).toEqual({ goal: 4, days: [0, 2, 4], reminder: { enabled: true, time: "19h" } })
  })

  it("rejects malformed values", () => {
    expect(parseWeeklyPlan(null)).toBeNull()
    expect(parseWeeklyPlan({ goal: 0, days: [] })).toBeNull()
    expect(parseWeeklyPlan({ goal: 3, days: [9] })).toBeNull()
    expect(parseWeeklyPlan("x")).toBeNull()
  })

  it("defaults reminder when missing", () => {
    const plan = parseWeeklyPlan({ goal: 2, days: [1] })
    expect(plan?.reminder).toEqual({ enabled: false, time: "08h" })
  })
})
