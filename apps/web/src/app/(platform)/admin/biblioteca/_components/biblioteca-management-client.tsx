"use client"

import type { DbBook } from "@/lib/books-queries"
import {
  Badge,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from "@eximia/ui"
import { BookOpen, Download, Edit, Loader2, Plus, Search, Star, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { BookFormDialog } from "./book-form-dialog"
import { BookSearchDialog } from "./book-search-dialog"

interface Props {
  initialBooks: DbBook[]
}

export function BibliotecaManagementClient({ initialBooks }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [books, setBooks] = useState(initialBooks)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [editBook, setEditBook] = useState<DbBook | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DbBook | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [fetchingRatings, setFetchingRatings] = useState(false)

  const categories = useMemo(() => {
    const set = new Set(books.map((b) => b.category))
    return Array.from(set).sort()
  }, [books])

  const filtered = useMemo(() => {
    return books.filter((b) => {
      const matchSearch =
        !search ||
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        b.author.toLowerCase().includes(search.toLowerCase())
      const matchCategory = !categoryFilter || b.category === categoryFilter
      return matchSearch && matchCategory
    })
  }, [books, search, categoryFilter])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/books/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: "Erro", description: json.error })
        return
      }
      setBooks((prev) => prev.filter((b) => b.id !== deleteTarget.id))
      toast({ variant: "success", title: "Livro excluido com sucesso" })
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, toast])

  const handleFetchRatings = useCallback(async () => {
    setFetchingRatings(true)
    try {
      const res = await fetch("/api/admin/books/fetch-ratings", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: "error", title: "Erro", description: data.error })
        return
      }
      toast({ variant: "success", title: "Avaliações atualizadas", description: data.message })
      router.refresh()
    } finally {
      setFetchingRatings(false)
    }
  }, [toast, router])

  const handleSaved = useCallback(() => {
    setShowCreate(false)
    setEditBook(null)
    router.refresh()
  }, [router])

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="max-w-xs flex-1">
            <Input
              placeholder="Buscar por título ou autor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingIcon={<Search size={16} />}
              inputSize="sm"
            />
          </div>
          <div className="w-40">
            <Select
              selectSize="sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Todas categorias</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleFetchRatings} disabled={fetchingRatings}>
            {fetchingRatings ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
            {fetchingRatings ? "Buscando..." : "Buscar Avaliações"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowSearch(true)}>
            <Download size={16} />
            Importar Livro
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            Novo livro
          </Button>
        </div>
      </div>

      {/* Books table */}
      <div className="rounded-lg shadow-card bg-bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titulo</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-center">Nota</TableHead>
              <TableHead className="text-center">Ano</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-text-muted">
                  Nenhum livro encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((book) => (
                <TableRow key={book.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt=""
                          className="h-8 w-6 rounded object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-8 w-6 items-center justify-center rounded text-[8px] text-white/60"
                          style={{ backgroundColor: book.cover_color ?? "#374151" }}
                        >
                          <BookOpen size={12} />
                        </div>
                      )}
                      <span className="line-clamp-1">{book.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-text-secondary">{book.author}</TableCell>
                  <TableCell>
                    <Badge variant="default">{book.category}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-accent-gold">
                      <Star size={12} fill="currentColor" />
                      <span className="text-sm">{book.rating % 1 === 0 ? book.rating : book.rating.toFixed(1)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-text-secondary">
                    {book.year ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/biblioteca/${book.id}/conteúdo`}>
                        <Button size="sm" variant="ghost" title="Editar conteúdo">
                          <BookOpen size={14} />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Editar livro"
                        onClick={() => setEditBook(book)}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Excluir"
                        onClick={() => setDeleteTarget(book)}
                      >
                        <Trash2 size={14} className="text-status-error" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit dialog */}
      <BookFormDialog
        open={showCreate || !!editBook}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false)
            setEditBook(null)
          }
        }}
        book={editBook}
        onSaved={handleSaved}
      />

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Excluir livro</ModalTitle>
            <ModalDescription>
              Tem certeza que deseja excluir &quot;{deleteTarget?.title}&quot;? Esta acao nao pode
              ser desfeita. Todos os capítulos e resumos serao excluidos.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Import from Google Books */}
      <BookSearchDialog open={showSearch} onOpenChange={setShowSearch} />
    </>
  )
}
