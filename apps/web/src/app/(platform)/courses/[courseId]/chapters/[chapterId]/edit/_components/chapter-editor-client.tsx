"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  FormField,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@eximia/ui"
import { useRouter } from "next/navigation"
import type { Value } from "platejs"
import { useCallback, useMemo, useState, useTransition } from "react"
import Markdown from "react-markdown"
import { createChapter, updateChapter } from "../../../actions"
import { ChapterBlocksRenderer } from "../../_components/chapter-blocks-renderer"
import { chapterMarkdownComponents } from "../../_components/chapter-content"
import type { ChapterSlide } from "@eximia/shared"
import { AudioGenerator } from "./audio-generator"
import { AudioUploader } from "./audio-uploader"
import { BlockEditor } from "./block-editor"
import { InteractionEngine } from "./interaction-engine"
import { ReflectionsViewer } from "./reflections-viewer"
import { SlideManager } from "./slide-manager"
import { VideoPreview } from "./video-preview"

interface ChapterEditorClientProps {
  courseId: string
  courseTitle: string
  tenantId: string
  chapter?: {
    id: string
    title: string
    content: string
    content_blocks: Record<string, unknown>[] | null
    learning_objective: string | null
    status: string
    video_url: string | null
    audio_url: string | null
    slide_audio_url: string | null
  }
  slides?: ChapterSlide[]
}

export function ChapterEditorClient({
  courseId,
  courseTitle,
  tenantId,
  chapter,
  slides = [],
}: ChapterEditorClientProps) {
  const isEditing = !!chapter
  // Stable draft ID for asset uploads on new chapters (avoids "new" path collisions)
  const draftChapterId = useMemo(() => chapter?.id ?? crypto.randomUUID(), [chapter?.id])
  const [contentBlocks, setContentBlocks] = useState<Value | null>(
    (chapter?.content_blocks as Value | null) ?? null,
  )
  const [markdownContent, setMarkdownContent] = useState(chapter?.content ?? "")
  const [activeTab, setActiveTab] = useState("edit")
  const [audioUrl, setAudioUrl] = useState<string | null>(chapter?.audio_url ?? null)
  const [videoUrl, setVideoUrl] = useState(chapter?.video_url ?? "")
  const [interactionMode, setInteractionMode] = useState<string | null>(null)
  const [quizQuestions, setQuizQuestions] = useState<any[]>([])
  const [scenarioConfig, setScenarioConfig] = useState<any>(null)
  const [assignmentConfig, setAssignmentConfig] = useState<any>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  const isContentValid = contentBlocks ? contentBlocks.length > 0 : markdownContent.length >= 100

  const handleEditorChange = useCallback((blocks: Value, markdown: string) => {
    setContentBlocks(blocks)
    setMarkdownContent(markdown)
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set("content", markdownContent)
    formData.set("audio_url", audioUrl ?? "")

    if (contentBlocks) {
      formData.set("content_blocks", JSON.stringify(contentBlocks))
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateChapter(chapter.id, courseId, formData)
        : await createChapter(courseId, formData)

      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }

      toast({
        variant: "success",
        title: isEditing ? "Capítulo atualizado" : "Capítulo criado",
      })
      router.push(`/courses/${courseId}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={`/courses`}>Cursos</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/courses/${courseId}`}>{courseTitle}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{isEditing ? "Editar Capítulo" : "Novo Capítulo"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="text-2xl font-bold text-text-primary">
        {isEditing ? "Editar Capítulo" : "Novo Capítulo"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <FormField label="Titulo" htmlFor="title" required>
          <Input
            id="title"
            name="title"
            placeholder="Ex: Introducao ao Machine Learning"
            defaultValue={chapter?.title ?? ""}
            required
          />
        </FormField>

        <FormField label="Objetivo de Aprendizagem" htmlFor="learning_objective">
          <Input
            id="learning_objective"
            name="learning_objective"
            placeholder="O que o aluno deve aprender neste capítulo"
            defaultValue={chapter?.learning_objective ?? ""}
          />
        </FormField>

        <FormField label="URL do Video" htmlFor="video_url">
          <Input
            id="video_url"
            name="video_url"
            placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
          <p className="text-xs text-text-muted mt-1">YouTube, Vimeo ou URL direta (.mp4, .webm)</p>
          {videoUrl && /^https?:\/\/.+/.test(videoUrl) && <VideoPreview url={videoUrl} />}
        </FormField>

        <FormField label="Áudio do Capítulo" htmlFor="audio">
          <AudioUploader
            currentUrl={audioUrl}
            chapterId={draftChapterId}
            tenantId={tenantId}
            onUpload={(url) => setAudioUrl(url)}
            onRemove={() => setAudioUrl(null)}
          />
        </FormField>

        {/* AI Audio Generation (ElevenLabs) */}
        {isEditing && (
          <AudioGenerator chapterId={chapter.id} hasContent={markdownContent.trim().length > 50} />
        )}

        {/* Slides management (only for existing chapters) */}
        {isEditing && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Slides</label>
            <SlideManager
              chapterId={chapter.id}
              tenantId={tenantId}
              initialSlides={slides}
              initialSlideAudioUrl={chapter.slide_audio_url}
            />
          </div>
        )}

        {/* Content with block editor + preview */}
        <div className="space-y-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-primary">
                Conteúdo <span className="text-semantic-error">*</span>
              </label>
              <TabsList>
                <TabsTrigger value="edit">Editar</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="edit">
              <BlockEditor
                initialBlocks={contentBlocks}
                initialMarkdown={chapter?.content ?? ""}
                chapterId={draftChapterId}
                tenantId={tenantId}
                onChange={handleEditorChange}
              />
            </TabsContent>

            <TabsContent value="preview">
              <div className="min-h-[300px] rounded-sm shadow-card p-4">
                {contentBlocks && contentBlocks.length > 0 ? (
                  <ChapterBlocksRenderer
                    blocks={contentBlocks as unknown as Record<string, unknown>[]}
                  />
                ) : markdownContent ? (
                  <div className="prose prose-invert max-w-none">
                    <Markdown components={chapterMarkdownComponents}>{markdownContent}</Markdown>
                  </div>
                ) : (
                  <p className="text-text-muted italic">Nenhum conteúdo para visualizar</p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Validation indicator */}
          <div className="flex justify-end">
            <span
              className={`text-xs ${isContentValid ? "text-semantic-success" : "text-semantic-error"}`}
            >
              {isContentValid ? "Conteúdo valido" : "Adicione conteúdo ao capítulo"}
            </span>
          </div>
        </div>

        {/* Interaction Engine */}
        {isEditing && (
          <InteractionEngine
            chapterId={chapter.id}
            currentMode={interactionMode as any}
            currentQuestions={quizQuestions}
            currentScenario={scenarioConfig}
            currentAssignment={assignmentConfig}
            onModeChange={setInteractionMode as any}
            onQuestionsChange={setQuizQuestions}
            onScenarioChange={setScenarioConfig}
            onAssignmentChange={setAssignmentConfig}
          />
        )}

        {/* Reflections — only when editing existing chapter with slides */}
        {isEditing && slides.length > 0 && (
          <ReflectionsViewer chapterId={chapter.id} />
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/courses/${courseId}`)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending || !isContentValid}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  )
}
