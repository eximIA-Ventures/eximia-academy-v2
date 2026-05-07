"use client"

import type { DbBook } from "@/lib/books-queries"
import {
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
import { useCallback, useEffect, useState } from "react"

const CATEGORIES = ["Lean", "Gestao", "Lideranca", "Inovacao", "Estrategia", "Cultura", "Agilidade"]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  book: DbBook | null
  onSaved: () => void
}

export function BookFormDialog({ open, onOpenChange, book, onSaved }: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [category, setCategory] = useState("Lean")
  const [description, setDescription] = useState("")
  const [year, setYear] = useState("")
  const [pages, setPages] = useState("")
  const [rating, setRating] = useState("0")
  const [tags, setTags] = useState("")
  const [synopsis, setSynopsis] = useState("")
  const [authorBio, setAuthorBio] = useState("")
  const [coverColor, setCoverColor] = useState("#1e3a5f")

  useEffect(() => {
    if (book) {
      setTitle(book.title)
      setAuthor(book.author)
      setCategory(book.category)
      setDescription(book.description ?? "")
      setYear(book.year?.toString() ?? "")
      setPages(book.pages?.toString() ?? "")
      setRating(book.rating.toString())
      setTags(book.tags?.join(", ") ?? "")
      setSynopsis(book.synopsis ?? "")
      setAuthorBio(book.author_bio ?? "")
      setCoverColor(book.cover_color ?? "#1e3a5f")
    } else {
      setTitle("")
      setAuthor("")
      setCategory("Lean")
      setDescription("")
      setYear("")
      setPages("")
      setRating("0")
      setTags("")
      setSynopsis("")
      setAuthorBio("")
      setCoverColor("#1e3a5f")
    }
  }, [book, open])

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !author.trim()) {
      toast({ variant: "error", title: "Título e autor são obrigatórios" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        author: author.trim(),
        category,
        description: description.trim() || undefined,
        year: year ? Number.parseInt(year) : null,
        pages: pages ? Number.parseInt(pages) : null,
        rating: Number.parseFloat(rating) || 0,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        synopsis: synopsis.trim() || null,
        author_bio: authorBio.trim() || null,
        cover_color: coverColor,
      }

      const url = book ? `/api/admin/books/${book.id}` : "/api/admin/books"
      const method = book ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: "Erro", description: json.error })
        return
      }

      toast({ variant: "success", title: book ? "Livro atualizado" : "Livro criado com sucesso" })
      onSaved()
    } finally {
      setSaving(false)
    }
  }, [title, author, category, description, year, pages, rating, tags, synopsis, authorBio, coverColor, book, toast, onSaved])

  const isEdit = !!book

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalOverlay />
      <ModalContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <ModalHeader>
          <ModalTitle>{isEdit ? "Editar livro" : "Novo livro"}</ModalTitle>
          <ModalDescription>
            {isEdit ? "Atualize os dados do livro." : "Preencha os dados para cadastrar um novo livro."}
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4 py-4">
          <FormField label="Titulo *">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do livro" />
          </FormField>

          <FormField label="Autor *">
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Nome do autor" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Categoria">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Nota (0-5)">
              <Input type="number" value={rating} onChange={(e) => setRating(e.target.value)} placeholder="4.5" min="0" max="5" step="0.1" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Ano">
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" />
            </FormField>

            <FormField label="Paginas">
              <Input type="number" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="300" />
            </FormField>
          </div>

          <FormField label="Descrição">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do livro"
              rows={2}
            />
          </FormField>

          <FormField label="Tags (separadas por virgula)">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="lean, gestao, kaizen" />
          </FormField>

          <FormField label="Sinopse">
            <Textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Sinopse detalhada do livro"
              rows={3}
            />
          </FormField>

          <FormField label="Sobre o autor">
            <Textarea
              value={authorBio}
              onChange={(e) => setAuthorBio(e.target.value)}
              placeholder="Biografia do autor"
              rows={2}
            />
          </FormField>

          <FormField label="Cor da capa">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={coverColor}
                onChange={(e) => setCoverColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded shadow-card"
              />
              <Input value={coverColor} onChange={(e) => setCoverColor(e.target.value)} className="flex-1" />
            </div>
          </FormField>
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim() || !author.trim()}>
            {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar livro"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
