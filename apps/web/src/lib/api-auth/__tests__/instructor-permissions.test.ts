import { beforeEach, describe, expect, it, vi } from "vitest"

// Build a chainable mock: from().select().eq().eq().single()
const mockSingle = vi.fn()
const mockEq2 = vi.fn(() => ({ single: mockSingle }))
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }))
const mockSelect = vi.fn(() => ({ eq: mockEq1 }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

// Import after mocking
const { checkInstructorPermission, getInstructorAreaIds } = await import(
  "../instructor-permissions"
)

describe("checkInstructorPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns true when instructor has permission", async () => {
    mockSingle.mockResolvedValue({
      data: {
        can_create_courses: true,
        can_create_quizzes: true,
        can_manage_trails: false,
        can_view_analytics: true,
        can_manage_enrollments: true,
        assigned_area_ids: [],
      },
    })

    const result = await checkInstructorPermission("user-1", "tenant-1", "can_create_courses")
    expect(result).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith("instructor_permissions")
    expect(mockEq1).toHaveBeenCalledWith("user_id", "user-1")
    expect(mockEq2).toHaveBeenCalledWith("tenant_id", "tenant-1")
  })

  it("returns false when instructor lacks permission", async () => {
    mockSingle.mockResolvedValue({
      data: {
        can_create_courses: true,
        can_create_quizzes: true,
        can_manage_trails: false,
        can_view_analytics: true,
        can_manage_enrollments: true,
        assigned_area_ids: [],
      },
    })

    const result = await checkInstructorPermission("user-2", "tenant-1", "can_manage_trails")
    expect(result).toBe(false)
  })

  it("returns false when user has no instructor_permissions row", async () => {
    mockSingle.mockResolvedValue({ data: null })

    const result = await checkInstructorPermission("user-3", "tenant-1", "can_create_courses")
    expect(result).toBe(false)
  })
})

describe("getInstructorAreaIds", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns assigned area IDs for instructor", async () => {
    const areaIds = ["area-1", "area-2"]
    mockSingle.mockResolvedValue({
      data: {
        can_create_courses: true,
        can_create_quizzes: true,
        can_manage_trails: false,
        can_view_analytics: true,
        can_manage_enrollments: true,
        assigned_area_ids: areaIds,
      },
    })

    const result = await getInstructorAreaIds("user-4", "tenant-1")
    expect(result).toEqual(areaIds)
  })

  it("returns empty array when user has no permissions", async () => {
    mockSingle.mockResolvedValue({ data: null })

    const result = await getInstructorAreaIds("user-5", "tenant-1")
    expect(result).toEqual([])
  })
})
