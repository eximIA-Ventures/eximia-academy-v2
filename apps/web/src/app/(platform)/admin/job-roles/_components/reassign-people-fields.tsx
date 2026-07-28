"use client"

// ---------------------------------------------------------------------------
// Reatribuição de pessoas — o MESMO controle usado em dois lugares (CFG-3.1).
// ---------------------------------------------------------------------------
// O drawer ("Mover pessoas de cargo…", AC6) e a exclusão ("para onde vão as N
// pessoas?", AC8) fazem a mesma pergunta e precisam da mesma garantia: destino
// EXPLÍCITO por pessoa, com "Fica sem cargo" sendo uma escolha e não o default
// silencioso. Uma implementação só, para as duas não divergirem — a divergência
// entre cópias é o que faz uma delas voltar a apagar vínculo por omissão.
// ---------------------------------------------------------------------------

import { Avatar, Select } from "@eximia/ui"
import type { JobRolePerson } from "../types"

/** Sentinela do select: "ainda não escolhi" ≠ "escolhi que fica sem cargo". */
export const UNDECIDED = ""
/** Escolha explícita de deixar a pessoa sem cargo. */
export const NO_ROLE = "__no_role__"

export function initialsOf(person: JobRolePerson): string {
  const source = person.full_name?.trim() || person.email
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

export interface ReassignPeopleFieldsProps {
  people: JobRolePerson[]
  /** Cargos de destino possíveis (o cargo de origem já vem de fora, excluído). */
  destinations: { id: string; name: string }[]
  /** userId -> `UNDECIDED` | `NO_ROLE` | id do cargo destino. */
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  disabled?: boolean
}

export function ReassignPeopleFields({
  people,
  destinations,
  value,
  onChange,
  disabled,
}: ReassignPeopleFieldsProps) {
  function applyToAll(target: string) {
    if (!target) return
    const next: Record<string, string> = {}
    for (const person of people) next[person.id] = target
    onChange(next)
  }

  return (
    <div className="space-y-3" data-testid="reassign-people-fields">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary">Aplicar a todos:</span>
        <Select
          aria-label="Destino em massa"
          selectSize="sm"
          value={UNDECIDED}
          disabled={disabled}
          onChange={(e) => applyToAll(e.target.value)}
        >
          <option value={UNDECIDED}>Escolher destino…</option>
          {destinations.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
          <option value={NO_ROLE}>Fica sem cargo</option>
        </Select>
      </div>

      <ul className="space-y-2">
        {people.map((person) => (
          <li
            key={person.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border-subtle p-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Avatar
                size="sm"
                src={person.avatar_url ?? undefined}
                fallback={initialsOf(person)}
              />
              <div className="min-w-0">
                <p className="truncate text-sm text-text-primary">
                  {person.full_name ?? person.email}
                </p>
                {person.area_names.length > 0 && (
                  <p className="truncate text-xs text-text-secondary">
                    {person.area_names.join(" · ")}
                  </p>
                )}
              </div>
            </div>

            <Select
              aria-label={`Destino de ${person.full_name ?? person.email}`}
              selectSize="sm"
              className="max-w-[12rem]"
              disabled={disabled}
              value={value[person.id] ?? UNDECIDED}
              onChange={(e) => onChange({ ...value, [person.id]: e.target.value })}
            >
              <option value={UNDECIDED}>Escolher destino…</option>
              {destinations.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
              <option value={NO_ROLE}>Fica sem cargo</option>
            </Select>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Converte o estado do formulário no contrato da server action. */
export function toReassignments(value: Record<string, string>, people: JobRolePerson[]) {
  return people
    .filter((person) => (value[person.id] ?? UNDECIDED) !== UNDECIDED)
    .map((person) => ({
      userId: person.id,
      targetJobRoleId: value[person.id] === NO_ROLE ? null : (value[person.id] as string),
    }))
}

/** Quem ainda não tem destino escolhido — o gate do botão de confirmar. */
export function undecidedPeople(value: Record<string, string>, people: JobRolePerson[]) {
  return people.filter((person) => (value[person.id] ?? UNDECIDED) === UNDECIDED)
}
