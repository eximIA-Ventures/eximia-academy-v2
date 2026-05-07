"use client"

import { buttonVariants } from "@eximia/ui"
import Link from "next/link"

interface ChapterNavigationProps {
  courseId: string
  prevChapter: { id: string; title: string } | null
  nextChapter: { id: string; title: string } | null
}

export function ChapterNavigation({ courseId, prevChapter, nextChapter }: ChapterNavigationProps) {
  return (
    <div className="mt-8 flex flex-col gap-3  pt-4 sm:mt-10 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
      {prevChapter ? (
        <Link
          href={`/courses/${courseId}/chapters/${prevChapter.id}`}
          className={buttonVariants({ variant: "outline" }) + " min-h-[44px] max-w-full truncate text-sm sm:max-w-[45%]"}
        >
          <span className="truncate">← {prevChapter.title}</span>
        </Link>
      ) : (
        <div />
      )}
      {nextChapter ? (
        <Link
          href={`/courses/${courseId}/chapters/${nextChapter.id}`}
          className={buttonVariants({ variant: "outline" }) + " min-h-[44px] max-w-full truncate text-sm sm:max-w-[45%] sm:ml-auto"}
        >
          <span className="truncate">{nextChapter.title} →</span>
        </Link>
      ) : (
        <div />
      )}
    </div>
  )
}
