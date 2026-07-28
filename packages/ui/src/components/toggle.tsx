import { type ButtonHTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

export interface ToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role" | "onClick"> {
  /** Whether the toggle is in the on state */
  checked?: boolean
  /** Callback fired when the toggle state changes */
  onCheckedChange?: (checked: boolean) => void
  /** When true, disables the toggle */
  disabled?: boolean
}

const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        // RODADA 12 (E4) — o TRILHO LIGADO é marcador de ESTADO: identidade do
        // mundo, não enfeite. Saía `bg-cerrado-600` chumbado, medido
        // `rgb(222,97,41)` em TODOS os toggles de `/admin/plans` e
        // `/admin/configuracoes/plano` — laranja dentro do mundo teal. O anel
        // de foco seguia o mesmo laranja e vai junto.
        "inline-flex items-center w-11 h-6 rounded-full border transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[var(--world-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app focus-visible:outline-none",
        checked
          ? "bg-[var(--world-accent)] border-[var(--world-accent)]"
          : "bg-bg-surface border-border-medium",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span
        className={cn(
          // O BOTÃO tem de trocar junto com o trilho, senão a correção acima
          // apagaria o próprio marcador: `--world-accent` é a parada ESCURA no
          // tema claro, e `bg-text-primary` ali é quase-preto (2.40:1 sobre
          // cerrado-800 — o botão sumiria). `--world-accent-fg` é o par legível
          // do fundo sólido (branco no claro, quase-preto no escuro): 8.21:1 e
          // 7.44:1 no Padrão, >= 6.25:1 no pior caso dos 4 mundos. DESLIGADO
          // continua `bg-text-primary`, porque ali o fundo é `bg-bg-surface`,
          // que anda no mesmo sentido do tema.
          "block h-5 w-5 rounded-full shadow-card transition-transform duration-200",
          checked
            ? "bg-[var(--world-accent-fg)] translate-x-[22px]"
            : "bg-text-primary translate-x-0.5",
        )}
      />
    </button>
  ),
)

Toggle.displayName = "Toggle"

export { Toggle }
