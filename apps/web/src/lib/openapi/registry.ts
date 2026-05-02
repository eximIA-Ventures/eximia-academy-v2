import { OpenAPIRegistry, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi"
import { z } from "zod"

extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

// --- Schemas ---

const PaginationMeta = z.object({
  limit: z.number(),
  next_cursor: z.string().nullable(),
})

const CourseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  type: z.enum(["regular", "onboarding"]),
  status: z.string(),
  area_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

const ChapterSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  order: z.number(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

const BlueprintSchema = z.object({
  id: z.string().uuid(),
  course_id: z.string().uuid(),
  status: z.string(),
  primary_framework: z.string().nullable(),
  quality_score: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

const EnrollmentSchema = z.object({
  id: z.string().uuid(),
  student_id: z.string().uuid(),
  course_id: z.string().uuid(),
  status: z.enum(["active", "completed", "dropped"]),
  progress: z.record(z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
})

const ErrorSchema = z.object({
  error: z.string(),
})

// --- Register schemas ---

registry.register("Course", CourseSchema)
registry.register("Chapter", ChapterSchema)
registry.register("Blueprint", BlueprintSchema)
registry.register("Enrollment", EnrollmentSchema)
registry.register("Error", ErrorSchema)
registry.register("PaginationMeta", PaginationMeta)

// --- Security ---

registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  description: "API key authentication. Use your API key as the bearer token: exa_live_...",
})

// --- Paths ---

const paginationParams = [
  {
    name: "limit",
    in: "query" as const,
    schema: { type: "integer" as const, default: 20, minimum: 1, maximum: 100 },
  },
  {
    name: "cursor",
    in: "query" as const,
    schema: { type: "string" as const, format: "uuid" },
    required: false,
  },
]

registry.registerPath({
  method: "get",
  path: "/api/v1/courses",
  summary: "List courses",
  description: "Returns paginated list of courses for the tenant.",
  security: [{ BearerAuth: [] }],
  request: { params: z.object({}), query: z.object({}) },
  parameters: [
    ...paginationParams,
    {
      name: "status",
      in: "query",
      schema: { type: "string", enum: ["draft", "active", "archived"] },
      required: false,
    },
    {
      name: "type",
      in: "query",
      schema: { type: "string", enum: ["regular", "onboarding"] },
      required: false,
    },
  ],
  responses: {
    200: {
      description: "List of courses",
      content: {
        "application/json": {
          schema: z.object({ data: z.array(CourseSchema), meta: PaginationMeta }),
        },
      },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/courses/{courseId}",
  summary: "Get course by ID",
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ courseId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Course details",
      content: { "application/json": { schema: z.object({ data: CourseSchema }) } },
    },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/courses/{courseId}/chapters",
  summary: "List chapters of a course",
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ courseId: z.string().uuid() }) },
  parameters: paginationParams,
  responses: {
    200: {
      description: "List of chapters",
      content: {
        "application/json": {
          schema: z.object({ data: z.array(ChapterSchema), meta: PaginationMeta }),
        },
      },
    },
    404: {
      description: "Course not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/courses/{courseId}/enrollments",
  summary: "List enrollments for a course",
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ courseId: z.string().uuid() }) },
  parameters: paginationParams,
  responses: {
    200: {
      description: "List of enrollments",
      content: {
        "application/json": {
          schema: z.object({ data: z.array(EnrollmentSchema), meta: PaginationMeta }),
        },
      },
    },
    404: {
      description: "Course not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/blueprints",
  summary: "List blueprints",
  security: [{ BearerAuth: [] }],
  request: { params: z.object({}), query: z.object({}) },
  parameters: [
    ...paginationParams,
    { name: "status", in: "query", schema: { type: "string" }, required: false },
    { name: "primary_framework", in: "query", schema: { type: "string" }, required: false },
  ],
  responses: {
    200: {
      description: "List of blueprints",
      content: {
        "application/json": {
          schema: z.object({ data: z.array(BlueprintSchema), meta: PaginationMeta }),
        },
      },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/blueprints/{blueprintId}",
  summary: "Get blueprint by ID",
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ blueprintId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Blueprint details",
      content: { "application/json": { schema: z.object({ data: BlueprintSchema }) } },
    },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/enrollments",
  summary: "List enrollments",
  security: [{ BearerAuth: [] }],
  request: { params: z.object({}), query: z.object({}) },
  parameters: [
    ...paginationParams,
    {
      name: "status",
      in: "query",
      schema: { type: "string", enum: ["active", "completed", "dropped"] },
      required: false,
    },
    { name: "course_id", in: "query", schema: { type: "string", format: "uuid" }, required: false },
  ],
  responses: {
    200: {
      description: "List of enrollments",
      content: {
        "application/json": {
          schema: z.object({ data: z.array(EnrollmentSchema), meta: PaginationMeta }),
        },
      },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
})
