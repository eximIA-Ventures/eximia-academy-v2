"use client"

import {
  Badge,
  Button,
  FormField,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Select,
  Textarea,
  useToast,
} from "@eximia/ui"
import { ArrowLeft, BookOpen, Loader2, Search, Star, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

interface SearchResult {
  sourceId: string
  source: "google" | "openlibrary" | "isbndb"
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  year: number | null
  pages: number | null
  categories: string[]
  rating: number | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CATEGORIES = ["Lean", "Gestão", "Liderança", "Inovação", "Estratégia", "Cultura", "Agilidade"]

const CATEGORY_MAP: Record<string, string> = {
  // English terms
  "Business & Economics": "Gestão",
  "Business": "Gestão",
  "Economics": "Gestão",
  "Management": "Gestão",
  "Project management": "Gestão",
  "Quality control": "Gestão",
  "Operations management": "Gestão",
  "Leadership": "Liderança",
  "Executive ability": "Liderança",
  "Supervision": "Liderança",
  "Innovation": "Inovação",
  "Technological innovations": "Inovação",
  "Creative thinking": "Inovação",
  "Disruptive technologies": "Inovação",
  "Strategic planning": "Estratégia",
  "Strategy": "Estratégia",
  "Competition": "Estratégia",
  "Competitive advantage": "Estratégia",
  "Corporate culture": "Cultura",
  "Organizational behavior": "Cultura",
  "Corporate governance": "Cultura",
  "Organizational change": "Agilidade",
  "Agile": "Agilidade",
  "Scrum": "Agilidade",
  "Kanban": "Agilidade",
  "Lean manufacturing": "Lean",
  "Lean": "Lean",
  "Toyota": "Lean",
  "Continuous improvement": "Lean",
  "Six Sigma": "Lean",
  "Kaizen": "Lean",
  // Portuguese terms
  "Administracao": "Gestão",
  "Gestao empresarial": "Gestão",
  "Negocios": "Gestão",
  "Economia": "Gestão",
  "Lideranca": "Liderança",
  "Inovacao": "Inovação",
  "Estrategia": "Estratégia",
  "Planejamento estrategico": "Estratégia",
  "Cultura organizacional": "Cultura",
  "Agilidade": "Agilidade",
  "Manufatura enxuta": "Lean",
  "Melhoria contínua": "Lean",
}

function mapCategory(categories: string[]): string {
  for (const cat of categories) {
    for (const [key, value] of Object.entries(CATEGORY_MAP)) {
      if (cat.toLowerCase().includes(key.toLowerCase())) return value
    }
  }
  return "Gestão"
}

function mapTags(categories: string[]): string[] {
  const tags = new Set<string>()
  for (const cat of categories.slice(0, 8)) {
    const lower = cat.toLowerCase()
    // Try to map to Portuguese
    for (const [key, value] of Object.entries(CATEGORY_MAP)) {
      if (lower.includes(key.toLowerCase())) {
        tags.add(value)
        break
      }
    }
    // Keep original if short enough
    if (cat.length <= 30) {
      tags.add(cat)
    }
  }
  return Array.from(tags).slice(0, 5)
}

export function BookSearchDialog({ open, onOpenChange }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  // Step: "search" or "review"
  const [step, setStep] = useState<"search" | "review">("search")

  // Search state
  const [query, setQuery] = useState("")
  const [searchMode, setSearchMode] = useState<"title" | "author">("title")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Review/edit form state
  const [formTitle, setFormTitle] = useState("")
  const [formAuthor, setFormAuthor] = useState("")
  const [formCoverUrl, setFormCoverUrl] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formYear, setFormYear] = useState("")
  const [formPages, setFormPages] = useState("")
  const [formCategory, setFormCategory] = useState("Gestao")
  const [formTags, setFormTags] = useState("")
  const [formRating, setFormRating] = useState(0)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep("search")
      setQuery("")
      setSearchMode("title")
      setResults([])
      setSearching(false)
      setImporting(false)
    }
  }, [open])

  const doSearch = useCallback(async (q: string, mode: "title" | "author") => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }

    setSearching(true)
    try {
      const params = new URLSearchParams({ q: q.trim(), mode })
      const res = await fetch(`/api/admin/books/search?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setResults(data.results ?? [])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => doSearch(value, searchMode), 500)
    },
    [doSearch, searchMode],
  )

  const handleModeChange = useCallback(
    (mode: "title" | "author") => {
      setSearchMode(mode)
      if (query.trim().length >= 2) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        doSearch(query, mode)
      }
    },
    [doSearch, query],
  )

  const handleSelectResult = useCallback((result: SearchResult) => {
    setFormTitle(result.title)
    setFormAuthor(result.author)
    setFormCoverUrl(result.coverUrl ?? "")
    setFormDescription(result.description ?? "")
    setFormYear(result.year?.toString() ?? "")
    setFormPages(result.pages?.toString() ?? "")
    setFormCategory(mapCategory(result.categories))
    setFormTags(mapTags(result.categories).join(", "))
    setFormRating(result.rating ?? 0)
    setStep("review")
  }, [])

  const handleBack = useCallback(() => {
    setStep("search")
  }, [])

  const handleImport = useCallback(async () => {
    if (!formTitle.trim() || !formAuthor.trim()) {
      toast({ variant: "error", title: "Título e autor são obrigatórios" })
      return
    }

    setImporting(true)
    try {
      const payload = {
        title: formTitle.trim(),
        author: formAuthor.trim(),
        category: formCategory,
        description: formDescription.trim() || undefined,
        synopsis: formDescription.trim() || undefined,
        cover_url: formCoverUrl.trim() || undefined,
        year: formYear ? Number.parseInt(formYear) : null,
        pages: formPages ? Number.parseInt(formPages) : null,
        tags: formTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        rating: formRating,
      }

      const res = await fetch("/api/admin/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: "Erro ao importar", description: json.error })
        return
      }

      const { data } = await res.json()
      toast({ variant: "success", title: "Livro importado com sucesso" })
      onOpenChange(false)
      router.push(`/admin/biblioteca/${data.id}/conteúdo`)
      router.refresh()
    } finally {
      setImporting(false)
    }
  }, [formTitle, formAuthor, formCategory, formDescription, formCoverUrl, formYear, formPages, formTags, formRating, toast, onOpenChange, router])

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalOverlay />
      <ModalContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <ModalHeader>
          <ModalTitle>
            {step === "search" ? "Importar livro" : "Revisar dados"}
          </ModalTitle>
          <ModalDescription>
            {step === "search"
              ? "Busque por título ou autor em 3 fontes: Google Books, Open Library e ISBNdb."
              : "Revise e edite os dados antes de importar."}
          </ModalDescription>
        </ModalHeader>

        {step === "search" ? (
          <>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder={searchMode === "author" ? "Nome do autor..." : "Título do livro..."}
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    leadingIcon={searchMode === "author" ? <User size={16} /> : <Search size={16} />}
                    autoFocus
                  />
                </div>
                <div className="flex rounded-lg border border-border-subtle overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleModeChange("title")}
                    className={`px-3 py-2 text-xs font-medium transition-colors ${
                      searchMode === "title"
                        ? "bg-accent-blue-mid text-white"
                        : "bg-bg-card text-text-secondary hover:bg-bg-elevated"
                    }`}
                  >
                    Título
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange("author")}
                    className={`px-3 py-2 text-xs font-medium transition-colors ${
                      searchMode === "author"
                        ? "bg-accent-blue-mid text-white"
                        : "bg-bg-card text-text-secondary hover:bg-bg-elevated"
                    }`}
                  >
                    Autor
                  </button>
                </div>
              </div>

              {searching && (
                <div className="flex items-center justify-center py-8 text-text-muted">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="ml-2">Buscando...</span>
                </div>
              )}

              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="py-6 text-center text-sm text-text-muted">
                  Nenhum resultado encontrado.
                </p>
              )}

              {!searching && results.length > 0 && (
                <div className="space-y-3">
                  {results.map((result) => (
                    <button
                      key={`${result.source}-${result.sourceId}`}
                      type="button"
                      onClick={() => handleSelectResult(result)}
                      className="flex w-full gap-3 rounded-lg border border-border-subtle bg-bg-card p-3 text-left transition-colors hover:border-accent-blue-mid"
                    >
                      {result.coverUrl ? (
                        <img
                          src={result.coverUrl}
                          alt=""
                          className="h-20 w-14 flex-shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-14 flex-shrink-0 items-center justify-center rounded bg-bg-elevated text-text-muted">
                          <BookOpen size={20} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary line-clamp-1">{result.title}</p>
                        <p className="text-sm text-text-secondary">{result.author}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                          {result.year && <span>{result.year}</span>}
                          {result.pages && <span>{result.pages} pag.</span>}
                          {result.rating != null && result.rating > 0 && (
                            <span className="flex items-center gap-0.5 text-accent-gold">
                              <Star size={10} fill="currentColor" />
                              {result.rating}
                            </span>
                          )}
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">
                            {result.source === "google" ? "Google" : result.source === "isbndb" ? "ISBNdb" : "Open Library"}
                          </Badge>
                        </div>
                        {result.description && (
                          <p className="mt-1 text-xs text-text-muted line-clamp-2">
                            {result.description}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-border-subtle pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {/* Cover preview */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  {formCoverUrl ? (
                    <img
                      src={formCoverUrl}
                      alt=""
                      className="h-32 w-24 rounded object-cover border border-border-subtle"
                    />
                  ) : (
                    <div className="flex h-32 w-24 items-center justify-center rounded bg-bg-elevated text-text-muted border border-border-subtle">
                      <BookOpen size={28} />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <FormField label="Título *">
                    <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
                  </FormField>
                  <FormField label="Autor *">
                    <Input value={formAuthor} onChange={(e) => setFormAuthor(e.target.value)} />
                  </FormField>
                </div>
              </div>

              <FormField label="URL da capa">
                <Input
                  value={formCoverUrl}
                  onChange={(e) => setFormCoverUrl(e.target.value)}
                  placeholder="https://..."
                />
              </FormField>

              <FormField label="Sinopse">
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Descrição ou sinopse do livro"
                  rows={3}
                />
              </FormField>

              <div className="grid grid-cols-4 gap-4">
                <FormField label="Categoria">
                  <Select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Ano">
                  <Input
                    type="number"
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    placeholder="2024"
                  />
                </FormField>

                <FormField label="Páginas">
                  <Input
                    type="number"
                    value={formPages}
                    onChange={(e) => setFormPages(e.target.value)}
                    placeholder="300"
                  />
                </FormField>

                <FormField label="Nota (0-5)">
                  <Input type="number" value={String(formRating)} onChange={(e) => setFormRating(Number.parseFloat(e.target.value) || 0)} placeholder="4.5" min="0" max="5" step="0.1" />
                </FormField>
              </div>

              <FormField label="Tags (separadas por vírgula)">
                <Input
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="lean, gestão, kaizen"
                />
              </FormField>
            </div>

            <ModalFooter>
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft size={16} />
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || !formTitle.trim() || !formAuthor.trim()}
              >
                {importing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Importando...
                  </>
                ) : (
                  "Importar"
                )}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
