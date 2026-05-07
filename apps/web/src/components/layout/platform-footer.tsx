interface PlatformFooterProps {
  footerText?: string
  supportEmail?: string
}

export function PlatformFooter({ footerText, supportEmail }: PlatformFooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer className="px-6 py-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          {footerText || (
            <>© {year} exímIA <span style={{ fontFamily: "var(--font-caveat), cursive" }} className="text-cerrado-600 font-bold">Academy</span> by exímIA</>
          )}
        </p>
        {supportEmail && (
          <a
            href={`mailto:${supportEmail}`}
            className="text-xs text-cerrado-600 hover:underline"
          >
            {supportEmail}
          </a>
        )}
      </div>
    </footer>
  )
}
