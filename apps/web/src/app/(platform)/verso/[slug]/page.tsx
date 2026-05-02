import { createClient } from "@/lib/supabase/server"
import { getVersoPostBySlug, toClientPost } from "@/lib/verso-queries"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect, notFound } from "next/navigation"
import { VersoReaderClient } from "@/components/verso/verso-reader-client"

interface Props {
  params: Promise<{ slug: string }>
}

export default async function VersoPostPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  const { data: dbPost, error } = await getVersoPostBySlug(supabase, slug)
  if (error || !dbPost) notFound()

  const post = toClientPost(dbPost)

  return <VersoReaderClient post={post} />
}
