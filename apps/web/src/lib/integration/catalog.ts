/** eximIA Academy integration catalog — defines exposed entities */

export const CATALOG = {
  app: "eximia-academy",
  version: "1.0.0",
  contract: "eximia-integration/v1",
  entities: {
    courses: {
      operations: ["list", "get"],
      schema: {
        id: { type: "string", readonly: true, description: "Course UUID" },
        title: { type: "string", required: true, description: "Course title" },
        description: { type: "string", description: "Course description" },
        type: { type: "string", description: "regular or onboarding" },
        status: { type: "string", readonly: true, description: "draft, published, archived" },
        cover_image_url: { type: "string", description: "Cover image URL" },
        chapter_count: { type: "number", readonly: true, description: "Number of chapters" },
        enrolled_count: { type: "number", readonly: true, description: "Number of enrollments" },
        created_at: { type: "datetime", readonly: true },
        updated_at: { type: "datetime", readonly: true },
      },
      description: "Courses available in the academy",
    },
    chapters: {
      operations: ["list", "get"],
      schema: {
        id: { type: "string", readonly: true, description: "Chapter UUID" },
        course_id: { type: "string", required: true, description: "Parent course UUID" },
        title: { type: "string", required: true, description: "Chapter title" },
        order: { type: "number", description: "Display order" },
        status: { type: "string", readonly: true, description: "draft or published" },
        interaction_type: { type: "string", description: "quiz, scenario, assignment, socratic_dialogue" },
        bloom_target: { type: "string", description: "Bloom taxonomy level" },
        created_at: { type: "datetime", readonly: true },
      },
      description: "Chapters within courses",
    },
    enrollments: {
      operations: ["list", "get", "create"],
      schema: {
        id: { type: "string", readonly: true, description: "Enrollment UUID" },
        student_id: { type: "string", required: true, description: "User UUID" },
        course_id: { type: "string", required: true, description: "Course UUID" },
        status: { type: "string", description: "active, completed, dropped" },
        progress: { type: "object", readonly: true, description: "Progress data" },
        created_at: { type: "datetime", readonly: true },
      },
      description: "Student enrollments in courses",
    },
    users: {
      operations: ["list", "get"],
      schema: {
        id: { type: "string", readonly: true, description: "User UUID" },
        full_name: { type: "string", description: "Full name" },
        email: { type: "string", description: "Email address" },
        role: { type: "string", description: "student, instructor, manager, admin" },
        status: { type: "string", readonly: true, description: "active or inactive" },
        created_at: { type: "datetime", readonly: true },
      },
      description: "Users in the tenant",
    },
  },
  webhooks: {
    available_events: [
      "enrollment.created",
      "enrollment.completed",
      "course.published",
      "quiz.completed",
    ],
  },
} as const
