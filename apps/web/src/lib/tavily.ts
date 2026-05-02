export interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
}

export interface TavilySearchResponse {
  results: TavilySearchResult[]
  query: string
}

export async function searchTavily(
  query: string,
  options?: { maxResults?: number },
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY not configured")
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: options?.maxResults ?? 5,
      search_depth: "advanced",
      include_answer: false,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`Tavily API error ${response.status}: ${text}`)
  }

  const data = await response.json()

  return {
    query,
    results: (data.results ?? []).map((r: Record<string, unknown>) => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      content: String(r.content ?? ""),
      score: Number(r.score ?? 0),
    })),
  }
}
