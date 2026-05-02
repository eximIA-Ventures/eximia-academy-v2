interface PlatformFooterProps {
  footerText?: string
  supportEmail?: string
}

export function PlatformFooter({ footerText, supportEmail }: PlatformFooterProps) {
  const displayText = footerText || `\u00a9 ${new Date().getFullYear()} exímIA Academy by ex\u00edmIA`

  return (
    <footer className="border-t border-border-medium px-6 py-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">{displayText}</p>
        {supportEmail && (
          <a
            href={`mailto:${supportEmail}`}
            className="text-xs text-accent-blue-mid hover:underline"
          >
            {supportEmail}
          </a>
        )}
      </div>
    </footer>
  )
}
