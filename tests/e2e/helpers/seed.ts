import { createClient } from "@supabase/supabase-js"

const TEST_TENANT = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Test Tenant",
  slug: "test",
  branding: {},
  settings: {},
}

const TEST_USERS = [
  {
    email: "student@test.com",
    password: "Test123!@#",
    role: "student",
    full_name: "Test Student",
    onboarding_completed: true,
  },
  {
    email: "manager@test.com",
    password: "Test123!@#",
    role: "manager",
    full_name: "Test Manager",
    onboarding_completed: true,
  },
  {
    email: "admin@test.com",
    password: "Test123!@#",
    role: "admin",
    full_name: "Test Admin",
    onboarding_completed: true,
  },
]

export async function seedTestData() {
  const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:54321"
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for E2E seed")
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Create tenant
  await supabase.from("tenants").upsert(TEST_TENANT, { onConflict: "id" })

  // 2. Create auth users and profiles (handles re-runs where users already exist)
  for (const user of TEST_USERS) {
    let userId: string | undefined

    const { data: createData } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.full_name },
    })

    if (createData.user) {
      userId = createData.user.id
    } else {
      // User already exists — find by email
      const { data: listData } = await supabase.auth.admin.listUsers()
      const existing = listData.users.find(
        (u: { email?: string; id: string }) => u.email === user.email,
      )
      userId = existing?.id
    }

    if (userId) {
      const { error: upsertError } = await supabase.from("users").upsert(
        {
          id: userId,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          tenant_id: TEST_TENANT.id,
          status: "active",
          onboarding_completed: user.onboarding_completed,
        },
        { onConflict: "id" },
      )
      if (upsertError) {
        console.error(`[e2e] Failed to upsert ${user.email}:`, upsertError.message)
      } else {
        console.log(`[e2e] Upserted user ${user.email} (id: ${userId}) with tenant ${TEST_TENANT.id}`)
      }
    } else {
      console.error(`[e2e] Could not find or create user ${user.email}`)
    }
  }

  // 3. Resolve manager user id for created_by
  const { data: listData } = await supabase.auth.admin.listUsers()
  const managerAuth = listData.users.find(
    (u: { email?: string; id: string }) => u.email === "manager@test.com",
  )
  if (!managerAuth) {
    throw new Error("[e2e] Manager user not found — cannot seed courses")
  }

  // 4. Create course
  const courseId = "00000000-0000-0000-0000-000000000010"
  const { error: courseError } = await supabase.from("courses").upsert(
    {
      id: courseId,
      title: "Curso de Teste",
      description: "Descricao do curso de teste para E2E",
      status: "published",
      tenant_id: TEST_TENANT.id,
      created_by: managerAuth.id,
    },
    { onConflict: "id" },
  )
  if (courseError) {
    console.error("[e2e] Failed to upsert course:", courseError.message)
  } else {
    console.log(`[e2e] Upserted course ${courseId}`)
  }

  // 5. Create chapter
  const chapterId = "00000000-0000-0000-0000-000000000020"
  const { error: chapterError } = await supabase.from("chapters").upsert(
    {
      id: chapterId,
      course_id: courseId,
      title: "Capitulo 1",
      content: "Conteudo do capitulo para teste E2E. Este capitulo aborda conceitos fundamentais.",
      status: "published",
      order: 1,
      tenant_id: TEST_TENANT.id,
    },
    { onConflict: "id" },
  )
  if (chapterError) {
    console.error("[e2e] Failed to upsert chapter:", chapterError.message)
  } else {
    console.log(`[e2e] Upserted chapter ${chapterId}`)
  }

  // 6. Create questions
  for (let i = 1; i <= 3; i++) {
    const qId = `00000000-0000-0000-0000-00000000003${i}`
    const { error: qError } = await supabase.from("questions").upsert(
      {
        id: qId,
        chapter_id: chapterId,
        text: `Pergunta de teste ${i}: Como voce aplicaria este conceito?`,
        skill: "analysis",
        intention: "evaluate understanding",
        expected_depth: "intermediate",
        status: "active",
        tenant_id: TEST_TENANT.id,
      },
      { onConflict: "id" },
    )
    if (qError) {
      console.error(`[e2e] Failed to upsert question ${qId}:`, qError.message)
    }
  }
  console.log("[e2e] Upserted 3 questions")

  // 7. Clean up stale sessions and messages from previous test runs
  const { error: sessCleanError } = await supabase
    .from("sessions")
    .delete()
    .eq("tenant_id", TEST_TENANT.id)
  if (sessCleanError) {
    console.error("[e2e] Failed to clean sessions:", sessCleanError.message)
  } else {
    console.log("[e2e] Cleaned up stale sessions")
  }

  // 8. Enroll student in course
  const studentAuth = listData.users.find(
    (u: { email?: string; id: string }) => u.email === "student@test.com",
  )
  if (studentAuth) {
    const { error: enrollError } = await supabase.from("enrollments").upsert(
      {
        student_id: studentAuth.id,
        course_id: courseId,
        tenant_id: TEST_TENANT.id,
      },
      { onConflict: "student_id,course_id" },
    )
    if (enrollError) {
      console.error("[e2e] Failed to enroll student:", enrollError.message)
    } else {
      console.log(`[e2e] Enrolled student ${studentAuth.id} in course ${courseId}`)
    }
  }
}
