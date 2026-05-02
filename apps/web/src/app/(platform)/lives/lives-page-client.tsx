"use client"

import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@eximia/ui"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Calendar,
  ExternalLink,
  Play,
  Plus,
  Radio,
  Users,
  Video,
} from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { cancelRegistration, registerForLive } from "./actions"
import { CreateLiveModal } from "./create-live-modal"

export interface LiveEvent {
  id: string
  title: string
  description: string | null
  hostName: string
  status: "scheduled" | "live" | "ended" | "cancelled"
  scheduledAt: string
  startedAt: string | null
  endedAt: string | null
  meetingUrl: string | null
  recordingUrl: string | null
  maxParticipants: number | null
  tags: string[] | null
  registrationCount: number
  isRegistered: boolean
}

interface LivesPageClientProps {
  events: LiveEvent[]
  isManager: boolean
}

export function LivesPageClient({ events, isManager }: LivesPageClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [tab, setTab] = useState("upcoming")

  const upcoming = useMemo(
    () =>
      events.filter(
        (e) => e.status === "scheduled" && new Date(e.scheduledAt) >= new Date(),
      ),
    [events],
  )

  const live = useMemo(() => events.filter((e) => e.status === "live"), [events])

  const recordings = useMemo(
    () => events.filter((e) => e.status === "ended" && e.recordingUrl),
    [events],
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div />
        {isManager && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={16} className="mr-1.5" />
            Nova Live
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming">
            Proximas{" "}
            {upcoming.length > 0 && (
              <Badge className="ml-1.5 text-[10px] font-semibold bg-accent-gold/15 text-accent-gold-light ring-1 ring-accent-gold/20">
                {upcoming.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="live">
            Ao Vivo{" "}
            {live.length > 0 && (
              <Badge className="ml-1.5 text-[10px] font-semibold bg-semantic-error/15 text-semantic-error ring-1 ring-semantic-error/20">
                {live.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recordings">Gravacoes</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          {upcoming.length === 0 ? (
            <EmptyState
              message="Nenhuma live agendada no momento."
              sub="Novas lives serao exibidas aqui quando agendadas."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((event) => (
                <UpcomingCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="live" className="mt-6">
          {live.length === 0 ? (
            <EmptyState
              message="Nenhuma live acontecendo agora."
              sub="Lives ao vivo aparecerao aqui em tempo real."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {live.map((event) => (
                <LiveCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recordings" className="mt-6">
          {recordings.length === 0 ? (
            <EmptyState
              message="Nenhuma gravacao disponivel."
              sub="Gravacoes de lives encerradas serao exibidas aqui."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recordings.map((event) => (
                <RecordingCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create modal */}
      {isManager && (
        <CreateLiveModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
        />
      )}
    </div>
  )
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-accent-gold/5 via-bg-card to-bg-card py-16 ring-1 ring-white/[0.06]">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-gold/10">
        <Video className="h-8 w-8 text-accent-gold/60" />
      </div>
      <p className="mt-4 text-sm font-medium text-text-secondary">{message}</p>
      {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
    </div>
  )
}

function UpcomingCard({ event }: { event: LiveEvent }) {
  const [isPending, startTransition] = useTransition()
  const [registered, setRegistered] = useState(event.isRegistered)

  function handleToggle() {
    startTransition(async () => {
      if (registered) {
        const result = await cancelRegistration(event.id)
        if (!result.error) setRegistered(false)
      } else {
        const result = await registerForLive(event.id)
        if (!result.error) setRegistered(true)
      }
    })
  }

  return (
    <div className="group flex flex-col rounded-2xl bg-gradient-to-br from-accent-gold/5 via-bg-card to-bg-card ring-1 ring-white/[0.06] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:ring-accent-gold/20">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <Badge className="bg-accent-gold/15 text-accent-gold-light text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ring-accent-gold/20">
            Agendada
          </Badge>
          <div className="flex gap-1.5">
            {event.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} className="bg-bg-elevated text-text-muted text-[10px] ring-1 ring-white/[0.06]">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <h3 className="font-semibold text-text-primary line-clamp-2 transition-colors group-hover:text-accent-gold-light">
          {event.title}
        </h3>

        {event.description && (
          <p className="text-sm text-text-muted line-clamp-2">{event.description}</p>
        )}

        <div className="flex flex-col gap-2 text-xs text-text-muted">
          <span className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-gold/10">
              <Calendar size={12} className="text-accent-gold-light" />
            </div>
            {format(new Date(event.scheduledAt), "dd MMM yyyy 'as' HH:mm", {
              locale: ptBR,
            })}
          </span>
          <span className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-gold/10">
              <Users size={12} className="text-accent-gold-light" />
            </div>
            {event.hostName}
            {event.maxParticipants && ` · max ${event.maxParticipants}`}
          </span>
          <span className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-gold/10">
              <Users size={12} className="text-accent-gold-light" />
            </div>
            {event.registrationCount + (registered && !event.isRegistered ? 1 : 0)}{" "}
            inscrito{event.registrationCount !== 1 ? "s" : ""}
          </span>
        </div>

        <Button
          variant={registered ? "outline" : "default"}
          size="sm"
          className="mt-auto"
          onClick={handleToggle}
          disabled={isPending}
        >
          {isPending
            ? "Processando..."
            : registered
              ? "Cancelar inscricao"
              : "Inscrever-me"}
        </Button>
      </div>
    </div>
  )
}

function LiveCard({ event }: { event: LiveEvent }) {
  return (
    <div className="group flex flex-col rounded-2xl bg-gradient-to-br from-semantic-error/8 via-bg-card to-bg-card ring-1 ring-semantic-error/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-semantic-error opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-semantic-error" />
          </span>
          <Badge className="bg-semantic-error/15 text-semantic-error text-[10px] font-semibold uppercase tracking-[0.15em] ring-1 ring-semantic-error/20">
            AO VIVO
          </Badge>
        </div>

        <h3 className="font-semibold text-text-primary line-clamp-2 transition-colors group-hover:text-accent-gold-light">
          {event.title}
        </h3>

        <div className="flex flex-col gap-2 text-xs text-text-muted">
          <span className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-semantic-error/10">
              <Radio size={12} className="text-semantic-error" />
            </div>
            {event.hostName}
          </span>
          <span className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-semantic-error/10">
              <Users size={12} className="text-semantic-error" />
            </div>
            {event.registrationCount} participante
            {event.registrationCount !== 1 ? "s" : ""}
          </span>
        </div>

        {event.meetingUrl && (
          <a
            href={event.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "sm", className: "mt-auto" })}
          >
            <ExternalLink size={14} className="mr-1.5" />
            Entrar
          </a>
        )}
      </div>
    </div>
  )
}

function RecordingCard({ event }: { event: LiveEvent }) {
  return (
    <div className="group flex flex-col rounded-2xl bg-gradient-to-br from-accent-gold/5 via-bg-card to-bg-card ring-1 ring-white/[0.06] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:ring-accent-gold/20">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <Badge className="w-fit bg-bg-elevated text-text-muted text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ring-white/[0.06]">
          Gravacao
        </Badge>

        <h3 className="font-semibold text-text-primary line-clamp-2 transition-colors group-hover:text-accent-gold-light">
          {event.title}
        </h3>

        <div className="flex flex-col gap-2 text-xs text-text-muted">
          <span className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-gold/10">
              <Video size={12} className="text-accent-gold-light" />
            </div>
            {event.hostName}
          </span>
          {event.endedAt && (
            <span className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-gold/10">
                <Calendar size={12} className="text-accent-gold-light" />
              </div>
              {format(new Date(event.endedAt), "dd MMM yyyy", { locale: ptBR })}
            </span>
          )}
        </div>

        {event.recordingUrl && (
          <a
            href={event.recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm", className: "mt-auto" })}
          >
            <Play size={14} className="mr-1.5" />
            Assistir
          </a>
        )}
      </div>
    </div>
  )
}
