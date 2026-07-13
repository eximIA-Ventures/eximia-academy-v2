"use client"

import { useState } from "react"
import type { ManagerGroupRow, ManagerOption, UnitOption } from "../actions"
import { GroupFormDialog } from "./group-form-dialog"
import { GroupList } from "./group-list"
import { UnionScopeNotice } from "./union-scope-notice"

interface GroupManagementClientProps {
  initialGroups: ManagerGroupRow[]
  gestores: ManagerOption[]
  units: UnitOption[]
  isAdmin: boolean
}

export function GroupManagementClient({
  initialGroups,
  gestores,
  units,
  isAdmin,
}: GroupManagementClientProps) {
  const [showCreate, setShowCreate] = useState(false)

  return (
    <>
      {/* Callout fixo: o alcance é UNIÃO subárvore ∪ inclusões; remover daqui
          não tira ninguém da hierarquia (E10 §4.1, AC2). */}
      <UnionScopeNotice />

      <GroupList
        groups={initialGroups}
        gestores={gestores}
        units={units}
        isAdmin={isAdmin}
        onCreateClick={() => setShowCreate(true)}
      />

      {/* Create Dialog */}
      <GroupFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        group={null}
        gestores={gestores}
        units={units}
        isAdmin={isAdmin}
      />
    </>
  )
}
