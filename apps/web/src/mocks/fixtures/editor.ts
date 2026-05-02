import type { EditorOutput } from "@eximia/agents"

export const editorFixture: EditorOutput = {
  edited_response: {
    content:
      "Sua observação sobre a conexão entre teoria e prática mostra que você esta no caminho certo. " +
      "A forma como você articulou os conceitos demonstra uma compreensão que vai alem da superficie, " +
      "conectando diferentes aspectos do conteúdo de maneira coerente e reflexiva.\n\n" +
      "Agora, pensando um pouco mais adiante: se você tivesse que aplicar esse mesmo raciocinio em um " +
      "contexto completamente diferente, como você adaptaria sua abordagem para manter a mesma profundidade?",
    paragraph_1:
      "Sua observação sobre a conexão entre teoria e prática mostra que você esta no caminho certo. " +
      "A forma como você articulou os conceitos demonstra uma compreensão que vai alem da superficie, " +
      "conectando diferentes aspectos do conteúdo de maneira coerente e reflexiva.",
    paragraph_2:
      "Agora, pensando um pouco mais adiante: se você tivesse que aplicar esse mesmo raciocinio em um " +
      "contexto completamente diferente, como você adaptaria sua abordagem para manter a mesma profundidade?",
    paragraph_count: 2,
    word_count: 95,
    ends_with_question: true,
  },
  changes_made: {
    labels_removed: [],
    formatting_removed: [],
    paragraphs_restructured: true,
    content_condensed: false,
    words_removed: 0,
  },
  quality_checks: {
    no_labels: true,
    two_paragraphs: true,
    ends_with_question: true,
    within_word_limit: true,
    meaning_preserved: true,
  },
}
