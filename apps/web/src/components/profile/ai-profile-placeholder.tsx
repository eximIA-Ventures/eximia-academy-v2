import { Card, CardContent } from "@eximia/ui"
import { Sparkles } from "lucide-react"

export function AiProfilePlaceholder() {
  return (
    <Card className="border-dashed border-accent-gold/20 bg-accent-gold/5">
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-gold/10 text-accent-gold">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-text-primary">Como a IA me vê</h3>
          <p className="mt-1 text-sm leading-relaxed text-text-muted">
            Conforme você interage com o tutor, seu perfil de aprendizado será construído automaticamente.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
