import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_ID = "11111111-1111-1111-1111-111111111111"
const COURSE_ID = "66666666-6666-6666-6666-666666666666"
const CHAPTER_ID = "a6c10000-0000-0000-0000-000000000001"

const SLIDES_DIR = path.resolve(__dirname, "../tmp-slides")

const SLIDE_FILES = [
  "slide01-capa.png",
  "slide08-timeline.png",
  "slide09-modelo-shingo.png",
  "slide10-kpi-kbi.png",
  "slide12-piramide-principios.png",
  "slide15-modelo-completo.png",
]

async function uploadImages(): Promise<Record<string, string>> {
  const urls: Record<string, string> = {}

  for (const file of SLIDE_FILES) {
    const filePath = path.join(SLIDES_DIR, file)
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`)
      continue
    }

    const fileBuffer = fs.readFileSync(filePath)
    const storagePath = `${TENANT_ID}/${CHAPTER_ID}/images/${file}`

    console.log(`Uploading ${file}...`)
    const { error } = await supabase.storage
      .from("chapter-assets")
      .upload(storagePath, fileBuffer, {
        contentType: "image/png",
        upsert: true,
      })

    if (error) {
      console.error(`  Upload error for ${file}:`, error.message)
      continue
    }

    const { data: urlData } = supabase.storage
      .from("chapter-assets")
      .getPublicUrl(storagePath)

    urls[file.replace(".png", "")] = urlData.publicUrl
    console.log(`  Uploaded: ${urlData.publicUrl}`)
  }

  return urls
}

function buildContent(urls: Record<string, string>): string {
  const img = (key: string, alt: string, size = "large", align = "center") => {
    const url = urls[key] || `https://placeholder.com/${key}.png`
    return `![${alt} |size:${size}|align:${align}](${url})`
  }

  return `A busca pela excelência operacional não é um conceito novo. Desde o início do século XX, organizações ao redor do mundo vêm desenvolvendo metodologias para melhorar seus processos, reduzir desperdícios e alcançar resultados sustentáveis. Neste capítulo, vamos percorrer essa história e entender como o **Modelo SHINGO™** integra todos esses aprendizados em um framework poderoso para a transformação organizacional.

${img("slide01-capa", "Treinamento Análise e Solução de Problemas — capa do curso")}

## A Evolução da Excelência Operacional

A história da excelência operacional pode ser traçada como uma estrada de evolução contínua, onde cada década trouxe novas abordagens e ferramentas:

### As origens: Engenharia Industrial (1913)

Tudo começou com **Henry Ford** e a engenharia industrial. A introdução da linha de montagem revolucionou a manufatura, estabelecendo os conceitos de **fluxo** e **inventário** que seriam a base de todas as metodologias futuras. A ideia central era simples, mas transformadora: organizar o trabalho de forma sequencial e padronizada para maximizar a eficiência.

### Qualidade Total — TQM (1950)

Após a Segunda Guerra Mundial, o Japão abraçou os ensinamentos de Deming e Juran, dando origem ao **Total Quality Management (TQM)**. A qualidade deixou de ser responsabilidade de um departamento e passou a ser um compromisso de toda a organização. O foco migrou de "inspecionar defeitos" para "prevenir defeitos".

### Manutenção Produtiva Total — TPM (1960)

O **Japan Institute of Plant Maintenance (JIPM)** formalizou o conceito de **TPM — Total Productive Maintenance**. A ideia central é que a manutenção não é apenas responsabilidade da equipe técnica — todos os operadores devem participar do cuidado com os equipamentos. Isso reduz paradas não planejadas e aumenta a disponibilidade das máquinas.

${img("slide08-timeline", "Linha do tempo da Excelência Operacional: de Ford 1913 até WCM/SHINGO nos anos 1990", "full")}

### Sistema Toyota de Produção — JIT/TPS (1980)

O **Toyota Production System (TPS)** e o conceito de **Just In Time (JIT)** trouxeram uma revolução: produzir apenas o necessário, na quantidade certa e no momento certo. O TPS introduziu ferramentas como Kanban, Andon e o conceito de eliminação de desperdícios (*muda*) que se tornariam pilares do Lean Manufacturing.

### Six Sigma (1986)

A Motorola criou o **Six Sigma**, uma metodologia focada em **qualidade estatística** — reduzir a variação dos processos a ponto de ter no máximo 3,4 defeitos por milhão de oportunidades. O Six Sigma trouxe rigor analítico e a abordagem DMAIC (Definir, Medir, Analisar, Melhorar, Controlar).

### WCM e Modelo SHINGO (1990)

O **World Class Manufacturing (WCM)** e o **Modelo SHINGO™** representam a síntese de todas essas abordagens. Mas o Modelo SHINGO vai além: ele reconhece que **ferramentas sozinhas não sustentam resultados** — é preciso uma transformação cultural e comportamental.

> **Reflexão:** Perceba que cada metodologia não substituiu a anterior — elas se acumularam e se complementaram. O Modelo SHINGO integra todas elas sob uma visão unificada.

## O Modelo SHINGO™

O Modelo SHINGO™, desenvolvido pelo **Shingo Institute** (Utah State University), é nomeado em homenagem a **Shigeo Shingo**, um dos maiores engenheiros industriais do século XX e co-criador do Sistema Toyota de Produção.

O modelo se organiza em **quatro dimensões** interconectadas:

${img("slide09-modelo-shingo", "Diagrama do Modelo SHINGO: Princípios Orientadores no topo, Cultura/Comportamento no centro, Resultados à esquerda, Sistemas à direita, e Ferramentas na base")}

### 1. Princípios Orientadores

No topo do modelo estão os **Princípios Orientadores** — verdades fundamentais que guiam o comportamento ideal. Eles se organizam em três níveis:

**Facilitadores Culturais** (base da pirâmide):
- **Respeite Cada Indivíduo** — Toda pessoa merece respeito; liderar com humildade cria confiança
- **Conduza com Humildade** — Reconhecer que ninguém tem todas as respostas

**Melhoria Contínua** (nível intermediário):
- Melhore o Fluxo e Valor Puxado
- Garanta a Qualidade na Fonte
- Busque a Perfeição
- Adote Pensamento Científico
- Foco no Processo

**Alinhamento Empresarial** (topo):
- Crie Valor para os Clientes
- Crie Consistência de Propósitos
- Pense Sistemicamente

${img("slide12-piramide-principios", "Pirâmide dos Princípios Orientadores do Modelo SHINGO com os três níveis: Facilitadores Culturais, Melhoria Contínua e Alinhamento Empresarial")}

### 2. Sistemas

Os sistemas são as estruturas organizacionais que traduzem os princípios em ação. O Modelo SHINGO define **três sistemas essenciais**:

- **Sistemas de Gestão** — Foco no Desenvolvimento da Liderança
- **Sistemas de Trabalho** — Foco no Fluxo do Trabalho
- **Sistemas de Melhorias** — Foco em tornar a organização melhor

Os sistemas **dirigem** a cultura e são **habilitados** pelas ferramentas. Não adianta ter as melhores ferramentas se não houver um sistema que garanta seu uso consistente.

### 3. Ferramentas

As ferramentas são os métodos e técnicas práticas. O Modelo SHINGO identifica **cinco ferramentas necessárias para todo sistema**:

1. **Trabalho Padronizado** — Definir a melhor forma conhecida de executar uma tarefa
2. **Acompanhamento/Feedback** — Monitorar o desempenho e dar retorno
3. **Lógica de Melhoria** — Aplicar o pensamento científico (PDCA, A3, etc.)
4. **Rotinas** — Criar disciplina e consistência na execução
5. **Gestão à Vista** — Tornar o desempenho visível para todos

### 4. Resultados

Os resultados são consequência das três dimensões anteriores. O modelo distingue dois tipos de indicadores:

**KPIs (Key Performance Indicators)** — Indicadores de resultado:
- **S**egurança
- **Q**ualidade
- **C**usto
- **D**elivery (Entrega)
- **M**oral (Pessoa)
- **P**rodutividade

**KBIs (Key Behavior Indicators)** — Indicadores de comportamento:
- Medem os **comportamentos** que sustentam os resultados
- Um comportamento pode ser **observado, descrito e registrado**
- São a ponte entre sistemas e resultados

${img("slide10-kpi-kbi", "Relação entre KPIs (Resultados), Sistemas e KBIs (Comportamentos)", "medium")}

> **Insight importante:** Muitas organizações focam apenas nos KPIs (resultados), mas o Modelo SHINGO ensina que **resultados sustentáveis só vêm de comportamentos corretos**. Se você quer mudar os resultados, precisa mudar os comportamentos — e para mudar comportamentos, precisa ajustar os sistemas.

## A Conexão entre as Dimensões

O Modelo SHINGO não é linear — é um sistema dinâmico onde cada dimensão influencia as outras:

- **Princípios** → *Afirmam e Dirigem* → **Cultura/Comportamento**
- **Cultura** → *Alinha e Dirige* → **Sistemas**
- **Sistemas** → *Habilitam e Selecionam* → **Ferramentas**
- **Ferramentas** → *Alcançam e Refinam* → **Resultados**
- **Resultados** → Retroalimentam o ciclo

${img("slide15-modelo-completo", "Visão completa do Modelo SHINGO com todas as dimensões integradas: Princípios, Cultura, Sistemas, Ferramentas e Resultados", "full")}

Essa visão integrada é o que diferencia o Modelo SHINGO de abordagens que focam apenas em ferramentas. **Ferramentas sem cultura geram resultados temporários. Cultura sem sistemas gera inconsistência. Sistemas sem princípios perdem o norte.**`
}

const questions = [
  {
    id: "a6c10001-0001-4001-8001-000000000001",
    chapter_id: CHAPTER_ID,
    tenant_id: TENANT_ID,
    text: 'Uma fábrica investiu pesadamente em ferramentas Lean (5S, Kanban, SMED) e obteve ganhos expressivos nos primeiros 6 meses. Porém, após 1 ano, os indicadores voltaram aos patamares anteriores. Usando o Modelo SHINGO, como você explicaria esse fenômeno e o que deveria ter sido feito diferente?',
    skill: "analise",
    intention: "Avaliar se o aluno compreende que ferramentas sem transformação cultural e sistêmica geram resultados temporários",
    expected_depth: "O aluno deve identificar que a empresa focou apenas na dimensão 'Ferramentas' do Modelo SHINGO, sem trabalhar Sistemas (rotinas de sustentação, liderança) e Cultura (comportamentos). Deve argumentar que resultados sustentáveis exigem KBIs, não apenas KPIs.",
    status: "active",
  },
  {
    id: "a6c10001-0001-4001-8001-000000000002",
    chapter_id: CHAPTER_ID,
    tenant_id: TENANT_ID,
    text: "O Modelo SHINGO organiza os Princípios Orientadores em três níveis hierárquicos. Por que os 'Facilitadores Culturais' (Respeite Cada Indivíduo e Conduza com Humildade) estão na BASE da pirâmide e não no topo? O que isso implica para uma empresa que quer implementar Melhoria Contínua?",
    skill: "reflexao",
    intention: "Verificar compreensão da hierarquia dos princípios e a importância da base cultural para sustentar melhorias",
    expected_depth: "O aluno deve explicar que sem respeito e humildade não há ambiente psicologicamente seguro para que pessoas proponham melhorias, reportem problemas ou desafiem o status quo. A base cultural é pré-requisito — sem ela, iniciativas de Melhoria Contínua e Alinhamento Empresarial fracassam.",
    status: "active",
  },
  {
    id: "a6c10001-0001-4001-8001-000000000003",
    chapter_id: CHAPTER_ID,
    tenant_id: TENANT_ID,
    text: "Considere a evolução histórica da Excelência Operacional: Ford (1913) → TQM (1950) → TPM (1960) → TPS/JIT (1980) → Six Sigma (1986) → WCM/SHINGO (1990). Identifique qual foi a principal contribuição ÚNICA de cada era e explique por que o Modelo SHINGO é considerado uma síntese e não apenas 'mais uma metodologia'.",
    skill: "sintese",
    intention: "Testar a capacidade de sintetizar a evolução histórica e articular o diferencial integrador do Modelo SHINGO",
    expected_depth: "Ford=fluxo/padronização, TQM=qualidade como responsabilidade de todos, TPM=manutenção autônoma, TPS=eliminação de desperdício/JIT, Six Sigma=rigor estatístico. O SHINGO integra tudo e adiciona a dimensão comportamental/cultural que as outras não endereçavam explicitamente.",
    status: "active",
  },
  {
    id: "a6c10001-0001-4001-8001-000000000004",
    chapter_id: CHAPTER_ID,
    tenant_id: TENANT_ID,
    text: 'Você é gerente de uma planta industrial e seu diretor cobra melhores KPIs de Segurança e Qualidade. Usando o conceito de KPIs vs KBIs do Modelo SHINGO, elabore um plano de ação que não foque diretamente nos indicadores de resultado, mas sim nos comportamentos que os sustentam. Dê exemplos concretos de KBIs que você mediria.',
    skill: "aplicacao",
    intention: "Avaliar a capacidade de aplicar o conceito de KBIs em um cenário prático, distinguindo causa (comportamento) de efeito (resultado)",
    expected_depth: "O aluno deve propor KBIs concretos como: % de auditorias de segurança comportamental realizadas, frequência de diálogos de segurança líder-operador, % de anomalias reportadas vs resolvidas em 24h, número de gemba walks semanais. Deve argumentar que melhorar esses comportamentos (leading indicators) é o que sustenta a melhoria dos KPIs (lagging indicators).",
    status: "active",
  },
  {
    id: "a6c10001-0001-4001-8001-000000000005",
    chapter_id: CHAPTER_ID,
    tenant_id: TENANT_ID,
    text: "O Modelo SHINGO define cinco ferramentas necessárias para todo sistema: Trabalho Padronizado, Acompanhamento/Feedback, Lógica de Melhoria, Rotinas e Gestão à Vista. Se você pudesse implementar apenas UMA delas primeiro em uma organização que nunca teve contato com Lean, qual escolheria e por quê? Justifique considerando as dependências entre elas.",
    skill: "reflexao",
    intention: "Provocar pensamento crítico sobre priorização e interdependências entre ferramentas fundamentais",
    expected_depth: "Não há resposta única correta, mas o aluno deve argumentar com lógica. Uma resposta forte seria 'Trabalho Padronizado' porque sem padrão não há base para medir desvios (Acompanhamento), não há referência para melhorar (Lógica de Melhoria), e não há o que tornar visível (Gestão à Vista). Outra resposta válida seria 'Gestão à Vista' como catalisador de consciência.",
    status: "active",
  },
  {
    id: "a6c10001-0001-4001-8001-000000000006",
    chapter_id: CHAPTER_ID,
    tenant_id: TENANT_ID,
    text: "No diagrama do Modelo SHINGO, as setas entre as dimensões têm verbos específicos: Princípios 'Afirmam e Dirigem' a Cultura, Cultura 'Alinha e Dirige' Sistemas, Sistemas 'Habilitam e Selecionam' Ferramentas, Ferramentas 'Alcançam e Refinam' Resultados. Explique por que a relação Sistemas→Ferramentas usa os verbos 'Habilitar' e 'Selecionar' e não simplesmente 'Implementar'.",
    skill: "analise",
    intention: "Testar compreensão profunda das relações causais no Modelo SHINGO, indo além da memorização",
    expected_depth: "O aluno deve perceber que 'Habilitar' significa que o sistema cria as condições para que a ferramenta funcione (tempo, recursos, treinamento, liderança), enquanto 'Selecionar' implica que nem toda ferramenta serve para todo contexto — o sistema define QUAIS ferramentas são adequadas. 'Implementar' seria genérico e não capturaria essas nuances.",
    status: "active",
  },
]

async function seed() {
  console.log("=== Seed: Análise e Solução de Problemas — Capítulo 1 ===\n")

  // 1. Upload images
  console.log("── 1. Uploading slide images ──")
  const imageUrls = await uploadImages()
  console.log(`\nUploaded ${Object.keys(imageUrls).length} images\n`)

  // 2. Get a course creator (reuse existing manager/teacher user)
  console.log("── 2. Finding course creator ──")
  const { data: users } = await supabase
    .from("users")
    .select("id, role")
    .eq("tenant_id", TENANT_ID)
    .in("role", ["manager", "admin", "super_admin"])
    .limit(1)

  const creatorId = users?.[0]?.id
  if (!creatorId) {
    console.error("No manager/admin user found in tenant. Run seed-remote first.")
    process.exit(1)
  }
  console.log(`Using creator: ${creatorId} (${users![0].role})\n`)

  // 3. Upsert course
  console.log("── 3. Creating course ──")
  const { error: courseErr } = await supabase.from("courses").upsert({
    id: COURSE_ID,
    tenant_id: TENANT_ID,
    title: "Análise e Solução de Problemas",
    description: "Treinamento completo sobre metodologias de análise e solução de problemas, baseado no Modelo SHINGO™ e práticas de excelência operacional. Aborda desde a evolução histórica até ferramentas práticas como Kaizen, Makigami e os 7 passos de solução de problema.",
    status: "published",
    type: "regular",
    created_by: creatorId,
  })
  if (courseErr) {
    console.error("Course error:", courseErr.message)
    process.exit(1)
  }
  console.log("Course created: Análise e Solução de Problemas\n")

  // 4. Upsert chapter
  console.log("── 4. Creating chapter ──")
  const content = buildContent(imageUrls)
  const { error: chapterErr } = await supabase.from("chapters").upsert({
    id: CHAPTER_ID,
    course_id: COURSE_ID,
    tenant_id: TENANT_ID,
    title: "Fundamentos da Excelência Operacional e o Modelo SHINGO",
    content,
    learning_objective: "Compreender a evolução histórica da excelência operacional e os elementos do Modelo SHINGO™, identificando como princípios, sistemas e ferramentas se conectam para gerar resultados sustentáveis.",
    key_concepts: ["Modelo SHINGO", "Excelência Operacional", "KPI", "KBI", "Melhoria Contínua", "Princípios Orientadores", "Kaizen", "TPM", "WCM"],
    estimated_reading_time_min: 12,
    order: 1,
    status: "published",
    created_by: creatorId,
  })
  if (chapterErr) {
    console.error("Chapter error:", chapterErr.message)
    process.exit(1)
  }
  console.log("Chapter created: Fundamentos da Excelência Operacional\n")

  // 5. Upsert questions
  console.log("── 5. Creating questions ──")
  for (const q of questions) {
    const { error: qErr } = await supabase.from("questions").upsert(q)
    if (qErr) {
      console.error(`Question error (${q.id}):`, qErr.message)
    } else {
      console.log(`  ✓ Question [${q.skill}]: ${q.text.substring(0, 60)}...`)
    }
  }

  console.log("\n=== Done! ===")
  console.log(`Course:  ${COURSE_ID}`)
  console.log(`Chapter: ${CHAPTER_ID}`)
  console.log(`Questions: ${questions.length}`)
}

seed().catch(console.error)
