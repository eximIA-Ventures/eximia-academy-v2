import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_ID = "11111111-1111-1111-1111-111111111111"

const users = [
  { email: "super@a.com", password: "123456", full_name: "Super Admin", role: "super_admin", key: "super_admin", tenant_id: null as string | null },
  { email: "admin@a.com", password: "123456", full_name: "Admin User", role: "admin", key: "admin", tenant_id: TENANT_ID as string | null },
  { email: "manager@a.com", password: "123456", full_name: "Manager User", role: "manager", key: "manager", tenant_id: TENANT_ID as string | null },
  { email: "teacher@a.com", password: "123456", full_name: "Teacher User", role: "teacher", key: "teacher", tenant_id: TENANT_ID as string | null },
  { email: "student@a.com", password: "123456", full_name: "Student User", role: "student", key: "student", tenant_id: TENANT_ID as string | null },
  { email: "student2@a.com", password: "123456", full_name: "Ana Silva", role: "student", key: "student2", tenant_id: TENANT_ID as string | null },
  { email: "student3@a.com", password: "123456", full_name: "Carlos Santos", role: "student", key: "student3", tenant_id: TENANT_ID as string | null },
  { email: "student4@a.com", password: "123456", full_name: "Beatriz Lima", role: "student", key: "student4", tenant_id: TENANT_ID as string | null },
]

// ── Course IDs ──
const COURSE_1_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee" // IA para Negocios (published)
const COURSE_2_ID = "22222222-2222-2222-2222-222222222222" // Lideranca (published)
const COURSE_3_ID = "33333333-3333-3333-3333-333333333333" // Onboarding (published)
const COURSE_4_ID = "44444444-4444-4444-4444-444444444444" // Marketing Digital (draft)
const COURSE_5_ID = "55555555-5555-5555-5555-555555555555" // Excel (archived)

// ── Chapter IDs ──
// Course 1 chapters
const C1_CH1 = "ffffffff-ffff-ffff-ffff-ffffffffffff"
const C1_CH2 = "aaaaaaaa-1111-2222-3333-444444444444"
const C1_CH3 = "bbbbbbbb-1111-2222-3333-444444444444"
// Course 2 chapters
const C2_CH1 = "c2c10000-0000-0000-0000-000000000001"
const C2_CH2 = "c2c20000-0000-0000-0000-000000000002"
const C2_CH3 = "c2c30000-0000-0000-0000-000000000003"
const C2_CH4 = "c2c40000-0000-0000-0000-000000000004"
// Course 3 chapters
const C3_CH1 = "c3c10000-0000-0000-0000-000000000001"
const C3_CH2 = "c3c20000-0000-0000-0000-000000000002"
// Course 4 chapters
const C4_CH1 = "c4c10000-0000-0000-0000-000000000001"
const C4_CH2 = "c4c20000-0000-0000-0000-000000000002"
const C4_CH3 = "c4c30000-0000-0000-0000-000000000003"
// Course 5 chapters
const C5_CH1 = "c5c10000-0000-0000-0000-000000000001"
const C5_CH2 = "c5c20000-0000-0000-0000-000000000002"
const C5_CH3 = "c5c30000-0000-0000-0000-000000000003"

async function seed() {
  console.log("Starting seed...")

  // ═══════════════════════════════════════════════════════════════
  // 1. Tenant
  // ═══════════════════════════════════════════════════════════════
  console.log("Creating tenant Demo...")
  const { error: tenantErr } = await supabase.from("tenants").upsert({
    id: TENANT_ID,
    name: "Demo",
    slug: "demo",
    plan: "pro",
    status: "active",
  })
  if (tenantErr) {
    console.error("Tenant error:", tenantErr.message)
    return
  }
  console.log("Tenant created")

  // ═══════════════════════════════════════════════════════════════
  // 2. Auth users + profiles
  // ═══════════════════════════════════════════════════════════════
  const userIds: Record<string, string> = {}
  for (const u of users) {
    console.log(`Creating user ${u.email}...`)
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { tenant_id: u.tenant_id, role: u.role, full_name: u.full_name },
    })

    if (error) {
      if (error.message.includes("already been registered")) {
        console.log(`  User ${u.email} already exists, fetching...`)
        const { data: existing } = await supabase.auth.admin.listUsers()
        const found = existing?.users?.find((eu) => eu.email === u.email)
        if (found) userIds[u.key] = found.id
        continue
      }
      console.error(`  Error: ${error.message}`)
      continue
    }

    userIds[u.key] = data.user.id
    console.log(`  Auth user created: ${data.user.id}`)

    const { error: profileErr } = await supabase.from("users").upsert({
      id: data.user.id,
      tenant_id: u.tenant_id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
    })
    if (profileErr) {
      console.error(`  Profile error: ${profileErr.message}`)
    } else {
      console.log(`  Profile created`)
    }
  }

  const courseCreator = userIds.teacher || userIds.manager

  // ═══════════════════════════════════════════════════════════════
  // 3. Areas (try/catch — table may not exist)
  // ═══════════════════════════════════════════════════════════════
  const AREA_TECH_ID = "a0a00000-0000-0000-0000-000000000001"
  const AREA_BIZ_ID = "a0a00000-0000-0000-0000-000000000002"

  try {
    console.log("Creating areas...")
    await supabase.from("areas").upsert([
      { id: AREA_TECH_ID, tenant_id: TENANT_ID, name: "Tecnologia", slug: "tecnologia", description: "Equipe de tecnologia e desenvolvimento" },
      { id: AREA_BIZ_ID, tenant_id: TENANT_ID, name: "Negocios", slug: "negocios", description: "Equipe comercial e estrategia" },
    ])
    console.log("Areas created")
  } catch {
    console.log("Areas table not available, skipping...")
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. Courses (5 total)
  // ═══════════════════════════════════════════════════════════════
  if (!courseCreator) {
    console.error("No course creator found, skipping courses")
    return
  }

  const courses = [
    {
      id: COURSE_1_ID,
      tenant_id: TENANT_ID,
      title: "Inteligencia Artificial para Negocios",
      description: "Curso completo sobre como a Inteligencia Artificial esta transformando o mundo corporativo. Aborda desde conceitos fundamentais ate aplicacoes praticas de IA generativa, com foco em decisoes estrategicas e casos reais de mercado.",
      status: "published",
      type: "regular",
      created_by: courseCreator,
    },
    {
      id: COURSE_2_ID,
      tenant_id: TENANT_ID,
      title: "Lideranca e Gestao de Equipes",
      description: "Desenvolva habilidades essenciais de lideranca. Aprenda a motivar equipes, gerenciar conflitos e construir uma cultura organizacional forte. Inclui frameworks praticos de gestao e estudos de caso reais.",
      status: "published",
      type: "regular",
      created_by: courseCreator,
    },
    {
      id: COURSE_3_ID,
      tenant_id: TENANT_ID,
      title: "Primeiros Passos na Plataforma",
      description: "Trilha de onboarding para novos usuarios. Aprenda a navegar na plataforma, configurar seu perfil e aproveitar ao maximo os recursos disponiveis.",
      status: "published",
      type: "onboarding",
      created_by: courseCreator,
    },
    {
      id: COURSE_4_ID,
      tenant_id: TENANT_ID,
      title: "Marketing Digital Avancado",
      description: "Estrategias avancadas de marketing digital incluindo SEO, trafego pago, automacao de marketing e analise de dados para otimizacao de campanhas.",
      status: "draft",
      type: "regular",
      created_by: courseCreator,
    },
    {
      id: COURSE_5_ID,
      tenant_id: TENANT_ID,
      title: "Excel para Analise de Dados",
      description: "Domine o Excel para analise de dados corporativos. Tabelas dinamicas, formulas avancadas, dashboards e integracao com Power BI.",
      status: "archived",
      type: "regular",
      created_by: courseCreator,
    },
  ]

  for (const c of courses) {
    console.log(`Creating course: ${c.title}...`)
    const { error: courseErr } = await supabase.from("courses").upsert(c)
    if (courseErr) {
      console.error(`  Course error: ${courseErr.message}`)
    } else {
      console.log(`  Course created`)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. Chapters (15 total across 5 courses)
  // ═══════════════════════════════════════════════════════════════
  const chapters = [
    // --- Course 1: IA para Negocios (3 chapters) ---
    {
      id: C1_CH1, course_id: COURSE_1_ID, tenant_id: TENANT_ID,
      title: "O que e Inteligencia Artificial?",
      content: `A Inteligencia Artificial (IA) e um campo da ciencia da computacao que busca criar sistemas capazes de realizar tarefas que normalmente exigem inteligencia humana.\n\n## Tipos de IA\n\n### IA Estreita (Narrow AI)\nA IA que temos hoje e classificada como "estreita" — excelente em tarefas especificas, mas sem compreensao geral.\n\n### IA Geral (AGI)\nA IA Geral, ainda teorica, seria capaz de compreender e aplicar conhecimento em qualquer dominio.\n\n## IA no Contexto Empresarial\n\n- **Atendimento ao cliente**: Chatbots reduzem custos operacionais\n- **Analise de dados**: Algoritmos identificam padroes em grandes volumes\n- **Automacao de processos**: RPA combinada com IA elimina tarefas repetitivas\n- **Previsao de demanda**: Modelos preditivos otimizam estoques`,
      learning_objective: "Compreender os conceitos fundamentais de IA e identificar suas aplicacoes no contexto empresarial",
      order: 1, status: "published",
      video_url: "https://www.youtube.com/watch?v=2ePf9rue1Ao",
      audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    },
    {
      id: C1_CH2, course_id: COURSE_1_ID, tenant_id: TENANT_ID,
      title: "Machine Learning na Pratica",
      content: `Machine Learning (ML) e o subcampo da IA que permite que sistemas aprendam a partir de dados.\n\n## Como Funciona\n\n1. Coleta de dados\n2. Preparacao\n3. Treinamento\n4. Validacao\n5. Deploy\n\n## Tipos de Aprendizado\n\n### Supervisionado\nAprende a partir de exemplos rotulados. Ex: previsao de churn, scoring de credito.\n\n### Nao-Supervisionado\nEncontra padroes sem rotulos previos. Ex: segmentacao de mercado.\n\n### Por Reforco\nAprende por tentativa e erro com recompensas.`,
      learning_objective: "Entender os tipos de Machine Learning e como aplica-los para resolver problemas reais de negocio",
      order: 2, status: "published",
    },
    {
      id: C1_CH3, course_id: COURSE_1_ID, tenant_id: TENANT_ID,
      title: "IA Generativa e o Futuro dos Negocios",
      content: `A IA Generativa representa uma revolucao na forma como criamos conteudo, codigo e solucoes.\n\n## Modelos Fundacionais\n- GPT (OpenAI)\n- Claude (Anthropic)\n- Gemini (Google)\n- LLaMA (Meta)\n\n## Aplicacoes Empresariais\n\n### Produtividade\nGeracao de relatorios, e-mails inteligentes, documentacao automatizada.\n\n### Atendimento ao Cliente\nChatbots avancados, analise de sentimento em tempo real.\n\n## Riscos e Etica\n- Alucinacoes\n- Vies (Bias)\n- Privacidade\n- Regulamentacao`,
      learning_objective: "Avaliar criticamente as oportunidades e riscos da IA generativa para tomada de decisao estrategica",
      order: 3, status: "published",
    },
    // --- Course 2: Lideranca (4 chapters) ---
    {
      id: C2_CH1, course_id: COURSE_2_ID, tenant_id: TENANT_ID,
      title: "Fundamentos da Lideranca Moderna",
      content: `Lideranca moderna vai alem de dar ordens. E sobre influenciar, inspirar e criar condicoes para que equipes entreguem resultados excepcionais.\n\n## Estilos de Lideranca\n\n### Lideranca Transformacional\nFoca em inspirar mudancas positivas. Lideres transformacionais motivam pelo exemplo e pela visao.\n\n### Lideranca Servidora\nO lider coloca as necessidades da equipe em primeiro lugar, removendo obstaculos e promovendo crescimento.\n\n### Lideranca Situacional\nAdapta o estilo de acordo com a maturidade do liderado e a complexidade da tarefa.\n\n## Competencias Essenciais\n- Comunicacao clara e empatica\n- Tomada de decisao sob pressao\n- Delegacao efetiva\n- Inteligencia emocional`,
      learning_objective: "Identificar diferentes estilos de lideranca e quando aplicar cada um",
      order: 1, status: "published",
    },
    {
      id: C2_CH2, course_id: COURSE_2_ID, tenant_id: TENANT_ID,
      title: "Gestao de Conflitos",
      content: `Conflitos sao inevitaveis em qualquer equipe. A diferenca esta em como o lider os gerencia.\n\n## Tipos de Conflito\n\n### Conflitos de Tarefa\nDesacordos sobre o trabalho em si — prioridades, metodos, prazos.\n\n### Conflitos de Relacionamento\nTensoes pessoais entre membros da equipe.\n\n### Conflitos de Processo\nDesalinhamento sobre como o trabalho deve ser feito.\n\n## Estrategias de Resolucao\n\n1. **Escuta ativa**: Ouvir ambos os lados sem julgamento\n2. **Mediacao**: Facilitar dialogo construtivo\n3. **Foco em interesses**: Ir alem das posicoes para entender necessidades\n4. **Acordo win-win**: Buscar solucoes que atendam a todos`,
      learning_objective: "Aplicar tecnicas de resolucao de conflitos em cenarios corporativos",
      order: 2, status: "published",
    },
    {
      id: C2_CH3, course_id: COURSE_2_ID, tenant_id: TENANT_ID,
      title: "Feedback e Desenvolvimento de Equipe",
      content: `Feedback eficaz e a ferramenta mais poderosa de desenvolvimento de pessoas.\n\n## Framework SBI\n\n- **Situacao**: Descreva quando e onde aconteceu\n- **Comportamento**: O que a pessoa fez (observavel)\n- **Impacto**: Qual foi o efeito no time, projeto ou resultado\n\n## Tipos de Feedback\n\n### Feedback de Reforco\nReconhecer comportamentos positivos para que se repitam.\n\n### Feedback Corretivo\nApontar comportamentos que precisam mudar, sempre com respeito.\n\n## One-on-Ones\nReunioes individuais regulares sao o melhor canal para feedback continuo. Frequencia ideal: semanal ou quinzenal.`,
      learning_objective: "Dominar tecnicas de feedback e desenvolvimento continuo de equipes",
      order: 3, status: "published",
    },
    {
      id: C2_CH4, course_id: COURSE_2_ID, tenant_id: TENANT_ID,
      title: "Cultura Organizacional e Engajamento",
      content: `Cultura nao e o que esta escrito na parede — e o que acontece quando o lider nao esta olhando.\n\n## Elementos da Cultura\n\n- **Valores**: O que a organizacao prioriza de verdade\n- **Rituais**: Praticas recorrentes que reforçam valores\n- **Simbolos**: Artefatos que representam a identidade\n- **Narrativas**: Historias que definem "como fazemos as coisas aqui"\n\n## Engajamento\n\n### Drivers de Engajamento\n1. Proposito: Conexao com algo maior\n2. Autonomia: Liberdade para decidir como trabalhar\n3. Maestria: Oportunidade de crescer e aprender\n4. Pertencimento: Sentir-se parte do time\n\n## Medindo Engajamento\neNPS (Employee Net Promoter Score), pulse surveys, taxa de turnover.`,
      learning_objective: "Construir e manter uma cultura organizacional que promova engajamento e resultados",
      order: 4, status: "published",
    },
    // --- Course 3: Onboarding (2 chapters) ---
    {
      id: C3_CH1, course_id: COURSE_3_ID, tenant_id: TENANT_ID,
      title: "Bem-vindo a Plataforma",
      content: `Bem-vindo! Este capitulo vai te ajudar a dar os primeiros passos.\n\n## Navegacao\n\n- **Dashboard**: Sua pagina inicial com resumo de atividades\n- **Cursos**: Catalogo completo de cursos disponiveis\n- **Meu Perfil**: Configuracoes e historico de aprendizado\n\n## Como Funciona\n\n1. Explore os cursos disponiveis\n2. Inscrevase nos que interessam\n3. Estude os capitulos no seu ritmo\n4. Participe das sessoes socraticas para aprofundar o aprendizado\n5. Acompanhe seu progresso no dashboard`,
      learning_objective: "Navegar pela plataforma e entender seus principais recursos",
      order: 1, status: "published",
    },
    {
      id: C3_CH2, course_id: COURSE_3_ID, tenant_id: TENANT_ID,
      title: "Sessoes Socraticas: Aprendizado Ativo",
      content: `As sessoes socraticas sao o coracao da nossa metodologia de aprendizado.\n\n## O que e o Metodo Socratico?\n\nEm vez de receber respostas prontas, voce e guiado por perguntas que estimulam o pensamento critico.\n\n## Como Funciona na Plataforma\n\n1. Leia o conteudo do capitulo\n2. Clique em "Iniciar Sessao"\n3. Responda as perguntas com suas proprias palavras\n4. O tutor IA vai aprofundar seus argumentos\n5. Ao final, voce recebe um score de compreensao\n\n## Dicas para Aproveitamento\n- Seja autentico nas respostas\n- Nao tenha medo de errar — o erro e parte do aprendizado\n- Releia o conteudo se precisar\n- Faca conexoes com sua experiencia profissional`,
      learning_objective: "Entender e aproveitar ao maximo as sessoes socraticas da plataforma",
      order: 2, status: "published",
    },
    // --- Course 4: Marketing Digital (3 chapters, draft) ---
    {
      id: C4_CH1, course_id: COURSE_4_ID, tenant_id: TENANT_ID,
      title: "SEO Avancado",
      content: `Estrategias avancadas de SEO para dominar os resultados de busca.\n\n## SEO Tecnico\n- Core Web Vitals\n- Crawl budget\n- Schema markup\n\n## SEO de Conteudo\n- Pesquisa de palavras-chave com IA\n- Topic clusters\n- E-E-A-T`,
      learning_objective: "Dominar estrategias avancadas de SEO tecnico e de conteudo",
      order: 1, status: "draft",
    },
    {
      id: C4_CH2, course_id: COURSE_4_ID, tenant_id: TENANT_ID,
      title: "Trafego Pago e Automacao",
      content: `Combine trafego pago com automacao para maximizar ROI.\n\n## Plataformas\n- Google Ads\n- Meta Ads\n- LinkedIn Ads\n\n## Automacao de Marketing\n- Fluxos de nurturing\n- Lead scoring\n- Retargeting inteligente`,
      learning_objective: "Integrar trafego pago com automacao de marketing para otimizar conversoes",
      order: 2, status: "draft",
    },
    {
      id: C4_CH3, course_id: COURSE_4_ID, tenant_id: TENANT_ID,
      title: "Analytics e Otimizacao",
      content: `Tome decisoes baseadas em dados com analytics avancado.\n\n## Ferramentas\n- Google Analytics 4\n- Hotjar\n- Mixpanel\n\n## Metricas que Importam\n- CAC (Custo de Aquisicao)\n- LTV (Lifetime Value)\n- ROAS (Return on Ad Spend)\n- Taxa de conversao por canal`,
      learning_objective: "Usar analytics para otimizar estrategias de marketing digital",
      order: 3, status: "draft",
    },
    // --- Course 5: Excel (3 chapters, archived) ---
    {
      id: C5_CH1, course_id: COURSE_5_ID, tenant_id: TENANT_ID,
      title: "Formulas Avancadas",
      content: `Domine as formulas que separam iniciantes de experts.\n\n## Formulas Essenciais\n- PROCV / PROCX\n- INDICE + CORRESP\n- SE aninhado\n- SOMASES / CONT.SES\n\n## Formulas de Texto\n- CONCATENAR / TEXTJOIN\n- ESQUERDA / DIREITA / EXT.TEXTO\n- SUBSTITUIR`,
      learning_objective: "Dominar formulas avancadas do Excel para analise de dados",
      order: 1, status: "published",
    },
    {
      id: C5_CH2, course_id: COURSE_5_ID, tenant_id: TENANT_ID,
      title: "Tabelas Dinamicas e Dashboards",
      content: `Transforme dados brutos em insights visuais.\n\n## Tabelas Dinamicas\n- Campos calculados\n- Agrupamento de datas\n- Segmentacao de dados\n\n## Dashboards\n- Graficos dinamicos\n- Formatacao condicional\n- Sparklines\n- Slicers`,
      learning_objective: "Criar dashboards interativos com tabelas dinamicas",
      order: 2, status: "published",
    },
    {
      id: C5_CH3, course_id: COURSE_5_ID, tenant_id: TENANT_ID,
      title: "Power Query e Integracao",
      content: `Automatize a importacao e transformacao de dados.\n\n## Power Query\n- Importar de multiplas fontes\n- Transformacoes ETL\n- Merge e append de tabelas\n\n## Integracao com Power BI\n- Publicar datasets\n- Atualizar automaticamente\n- Criar relatorios compartilhados`,
      learning_objective: "Usar Power Query para automatizar processos de dados e integrar com Power BI",
      order: 3, status: "published",
    },
  ]

  for (const ch of chapters) {
    console.log(`Creating chapter: ${ch.title}...`)
    const { error: chapterErr } = await supabase.from("chapters").upsert(ch)
    if (chapterErr) {
      console.error(`  Chapter error: ${chapterErr.message}`)
    } else {
      console.log(`  Chapter created`)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. Questions (2 per chapter = 30 total)
  // ═══════════════════════════════════════════════════════════════
  const questions = [
    // Course 1, Chapter 1
    {
      id: "11110001-0001-0001-0001-000000000001", chapter_id: C1_CH1, tenant_id: TENANT_ID,
      text: 'Uma empresa de varejo esta considerando implementar IA. O CEO pergunta: "IA vai substituir meus funcionarios?". Como voce responderia, considerando IA Estreita vs IA Geral?',
      skill: "analise", intention: "Avaliar compreensao de IA Estreita vs IA Geral", expected_depth: "Distinguir IA Estreita de IA Geral, argumentando que a IA atual complementa o trabalho humano", status: "active",
    },
    {
      id: "11110001-0001-0001-0001-000000000002", chapter_id: C1_CH1, tenant_id: TENANT_ID,
      text: "O relatorio da McKinsey projeta trilhoes em valor economico gerado pela IA. Mas valor gerado e o mesmo que lucro para qualquer empresa? Que fatores determinam se uma empresa especifica vai capturar esse valor?",
      skill: "reflexao", intention: "Provocar reflexao critica sobre potencial de mercado vs resultado individual", expected_depth: "Refletir sobre maturidade digital, qualidade dos dados, cultura organizacional", status: "active",
    },
    // Course 1, Chapter 2
    {
      id: "11110001-0001-0001-0001-000000000003", chapter_id: C1_CH2, tenant_id: TENANT_ID,
      text: "Voce e o diretor de dados de um banco. Modelo A: 99% acuracia, 70% recall. Modelo B: 95% acuracia, 98% recall. Para deteccao de fraude, qual escolheria e por que?",
      skill: "aplicacao", intention: "Testar aplicacao de metricas de ML em cenario real", expected_depth: "Escolher modelo B (98% recall), pois em fraude e critico capturar o maximo de casos", status: "active",
    },
    {
      id: "11110001-0001-0001-0001-000000000004", chapter_id: C1_CH2, tenant_id: TENANT_ID,
      text: "Um colega sugere aprendizado nao-supervisionado para prever churn. Faz sentido? Que tipo seria mais adequado?",
      skill: "sintese", intention: "Verificar sintese dos tipos de aprendizado", expected_depth: "Identificar que churn e problema supervisionado, nao supervisionado", status: "active",
    },
    // Course 1, Chapter 3
    {
      id: "11110001-0001-0001-0001-000000000005", chapter_id: C1_CH3, tenant_id: TENANT_ID,
      text: "Sua empresa quer usar um LLM para automatizar suporte ao cliente, enviando todo o historico de tickets (incluindo dados pessoais) para a API. Quais riscos voce identifica?",
      skill: "analise", intention: "Avaliar identificacao de riscos de privacidade", expected_depth: "Identificar riscos de LGPD, propor anonimizacao, modelos on-premise, DPA", status: "active",
    },
    {
      id: "11110001-0001-0001-0001-000000000006", chapter_id: C1_CH3, tenant_id: TENANT_ID,
      text: 'O framework de adocao sugere "comecar pequeno" com pilotos. Um executivo defende implementacao completa. Como avaliaria esses argumentos?',
      skill: "reflexao", intention: "Estimular pensamento critico sobre estrategias de adocao", expected_depth: "Ponderar risco vs velocidade, tamanho do piloto proporcional a maturidade digital", status: "active",
    },
    // Course 2, Chapter 1
    {
      id: "22220001-0001-0001-0001-000000000001", chapter_id: C2_CH1, tenant_id: TENANT_ID,
      text: "Um gestor sempre usa o mesmo estilo de lideranca com todos os membros da equipe. Quais problemas isso pode causar? O que a lideranca situacional propoe como alternativa?",
      skill: "analise", intention: "Avaliar compreensao de estilos adaptativos", expected_depth: "Identificar que diferentes maturidades exigem diferentes estilos", status: "active",
    },
    {
      id: "22220001-0001-0001-0001-000000000002", chapter_id: C2_CH1, tenant_id: TENANT_ID,
      text: "Lideranca servidora coloca a equipe em primeiro lugar. Isso significa que o lider nunca deve ser assertivo ou tomar decisoes unilaterais? Justifique.",
      skill: "reflexao", intention: "Provocar reflexao sobre limites de cada estilo", expected_depth: "Entender que servir a equipe nao e submissao — inclui tomar decisoes dificeis", status: "active",
    },
    // Course 2, Chapter 2
    {
      id: "22220001-0001-0001-0001-000000000003", chapter_id: C2_CH2, tenant_id: TENANT_ID,
      text: "Dois membros da equipe discordam sobre a prioridade de um projeto. Um quer focar em qualidade, outro em velocidade. Como voce mediaria esse conflito de tarefa?",
      skill: "aplicacao", intention: "Testar aplicacao de tecnicas de mediacao", expected_depth: "Usar escuta ativa, foco em interesses (ambos querem sucesso do projeto) e buscar acordo win-win", status: "active",
    },
    {
      id: "22220001-0001-0001-0001-000000000004", chapter_id: C2_CH2, tenant_id: TENANT_ID,
      text: "E possivel ter uma equipe de alta performance sem nenhum conflito? O que a ausencia total de conflitos pode indicar?",
      skill: "reflexao", intention: "Desafiar a ideia de que conflito e sempre negativo", expected_depth: "Reconhecer que ausencia de conflito pode indicar conformidade ou medo de falar", status: "active",
    },
    // Course 2, Chapter 3
    {
      id: "22220001-0001-0001-0001-000000000005", chapter_id: C2_CH3, tenant_id: TENANT_ID,
      text: "Aplique o framework SBI para dar feedback a um colaborador que frequentemente interrompe colegas em reunioes.",
      skill: "aplicacao", intention: "Testar aplicacao pratica do framework SBI", expected_depth: "Descrever situacao especifica, comportamento observavel e impacto na equipe", status: "active",
    },
    {
      id: "22220001-0001-0001-0001-000000000006", chapter_id: C2_CH3, tenant_id: TENANT_ID,
      text: "Um lider so da feedback durante a avaliacao anual. Quais os problemas dessa abordagem? O que voce recomendaria?",
      skill: "sintese", intention: "Sintetizar importancia do feedback continuo", expected_depth: "Argumentar que feedback anual e tardio demais para correcao e sugerir one-on-ones regulares", status: "active",
    },
    // Course 2, Chapter 4
    {
      id: "22220001-0001-0001-0001-000000000007", chapter_id: C2_CH4, tenant_id: TENANT_ID,
      text: "Uma empresa tem valores escritos na parede mas o comportamento dos lideres contradiz esses valores. Qual o impacto na cultura e no engajamento?",
      skill: "analise", intention: "Avaliar compreensao de cultura vs declaracao", expected_depth: "Entender que cultura real e definida por comportamentos, nao por declaracoes", status: "active",
    },
    {
      id: "22220001-0001-0001-0001-000000000008", chapter_id: C2_CH4, tenant_id: TENANT_ID,
      text: "Dos 4 drivers de engajamento (proposito, autonomia, maestria, pertencimento), qual voce considera mais importante para a geracao Z? Justifique.",
      skill: "reflexao", intention: "Estimular reflexao sobre motivacao geracional", expected_depth: "Argumentar com base nos drivers, reconhecendo que pode variar por individuo", status: "active",
    },
    // Course 3, Chapter 1
    {
      id: "33330001-0001-0001-0001-000000000001", chapter_id: C3_CH1, tenant_id: TENANT_ID,
      text: "Qual recurso da plataforma voce considera mais util para seu desenvolvimento profissional? Como pretende organizar seu aprendizado?",
      skill: "reflexao", intention: "Incentivar planejamento de uso da plataforma", expected_depth: "Refletir sobre objetivos pessoais e conectar com recursos da plataforma", status: "active",
    },
    {
      id: "33330001-0001-0001-0001-000000000002", chapter_id: C3_CH1, tenant_id: TENANT_ID,
      text: "Imagine que um colega novo pergunta como aproveitar melhor a plataforma. O que voce diria com base no que aprendeu neste capitulo?",
      skill: "sintese", intention: "Verificar retencao do conteudo de onboarding", expected_depth: "Sintetizar os passos principais: explorar, inscrever, estudar, participar das sessoes", status: "active",
    },
    // Course 3, Chapter 2
    {
      id: "33330001-0001-0001-0001-000000000003", chapter_id: C3_CH2, tenant_id: TENANT_ID,
      text: "Por que o metodo socratico usa perguntas em vez de dar respostas prontas? Qual a vantagem para seu aprendizado?",
      skill: "reflexao", intention: "Verificar compreensao da metodologia socratica", expected_depth: "Entender que perguntas estimulam pensamento critico e retencao maior", status: "active",
    },
    {
      id: "33330001-0001-0001-0001-000000000004", chapter_id: C3_CH2, tenant_id: TENANT_ID,
      text: "O capitulo diz 'nao tenha medo de errar'. Em sua experiencia profissional, voce ja aprendeu algo significativo a partir de um erro? Como isso se conecta com o metodo socratico?",
      skill: "aplicacao", intention: "Conectar experiencia pessoal com a metodologia", expected_depth: "Relacionar aprendizado por erro com o ciclo socratico de questionamento", status: "active",
    },
    // Course 4, Chapter 1
    {
      id: "44440001-0001-0001-0001-000000000001", chapter_id: C4_CH1, tenant_id: TENANT_ID,
      text: "Qual a relacao entre Core Web Vitals e posicionamento nos resultados de busca? Como voce priorizaria melhorias?",
      skill: "aplicacao", intention: "Testar aplicacao de SEO tecnico", expected_depth: "Conectar metricas de performance com ranking e priorizar por impacto", status: "active",
    },
    {
      id: "44440001-0001-0001-0001-000000000002", chapter_id: C4_CH1, tenant_id: TENANT_ID,
      text: "Topic clusters sao mais eficazes que posts isolados para SEO. Por que? Como voce estruturaria um cluster para seu setor?",
      skill: "sintese", intention: "Sintetizar estrategia de conteudo", expected_depth: "Explicar autoridade tematica e interligacao de conteudos", status: "active",
    },
    // Course 4, Chapter 2
    {
      id: "44440001-0001-0001-0001-000000000003", chapter_id: C4_CH2, tenant_id: TENANT_ID,
      text: "Uma empresa gasta R$ 50 mil/mes em Google Ads com ROAS de 2x. Vale a pena investir mais ou diversificar para Meta Ads? Que dados voce analisaria?",
      skill: "analise", intention: "Avaliar pensamento analitico sobre investimento", expected_depth: "Analisar margem, capacidade de escala, saturacao do canal e potencial do novo canal", status: "active",
    },
    {
      id: "44440001-0001-0001-0001-000000000004", chapter_id: C4_CH2, tenant_id: TENANT_ID,
      text: "Lead scoring combina dados demograficos e comportamentais. Quais sinais indicariam que um lead esta pronto para compra?",
      skill: "aplicacao", intention: "Aplicar conceito de lead scoring", expected_depth: "Identificar sinais como visitas a pagina de precos, download de material, cargo decisor", status: "active",
    },
    // Course 4, Chapter 3
    {
      id: "44440001-0001-0001-0001-000000000005", chapter_id: C4_CH3, tenant_id: TENANT_ID,
      text: "CAC alto e LTV baixo: o que isso indica sobre o negocio? Quais acoes voce tomaria para corrigir?",
      skill: "analise", intention: "Testar analise de metricas de negocio", expected_depth: "Identificar que o negocio nao e sustentavel e propor reducao de CAC ou aumento de retencao", status: "active",
    },
    {
      id: "44440001-0001-0001-0001-000000000006", chapter_id: C4_CH3, tenant_id: TENANT_ID,
      text: "Uma empresa mede sucesso de marketing apenas por numero de leads. Quais metricas adicionais voce incluiria e por que?",
      skill: "sintese", intention: "Sintetizar visao completa de analytics", expected_depth: "Incluir qualidade do lead, taxa de conversao, CAC, LTV e ROAS", status: "active",
    },
    // Course 5, Chapter 1
    {
      id: "55550001-0001-0001-0001-000000000001", chapter_id: C5_CH1, tenant_id: TENANT_ID,
      text: "PROCV vs PROCX: em que cenarios o PROCX e superior? Dê um exemplo pratico.",
      skill: "aplicacao", intention: "Comparar funcoes de busca", expected_depth: "PROCX busca em qualquer direcao, aceita multiplos criterios e e mais flexivel", status: "active",
    },
    {
      id: "55550001-0001-0001-0001-000000000002", chapter_id: C5_CH1, tenant_id: TENANT_ID,
      text: "Quando usar INDICE+CORRESP em vez de PROCV? Qual a vantagem de performance?",
      skill: "analise", intention: "Avaliar compreensao de formulas avancadas", expected_depth: "INDICE+CORRESP permite busca a esquerda e e mais performatico em grandes bases", status: "active",
    },
    // Course 5, Chapter 2
    {
      id: "55550001-0001-0001-0001-000000000003", chapter_id: C5_CH2, tenant_id: TENANT_ID,
      text: "Como voce usaria campos calculados em tabela dinamica para criar uma metrica personalizada de produtividade?",
      skill: "aplicacao", intention: "Testar uso pratico de tabelas dinamicas", expected_depth: "Descrever formula do campo calculado e como configurar na tabela dinamica", status: "active",
    },
    {
      id: "55550001-0001-0001-0001-000000000004", chapter_id: C5_CH2, tenant_id: TENANT_ID,
      text: "Qual a diferenca entre graficos dinamicos e graficos comuns? Quando cada um e mais adequado?",
      skill: "sintese", intention: "Sintetizar vantagens de graficos dinamicos", expected_depth: "Graficos dinamicos atualizam automaticamente com filtros; comuns sao melhores para apresentacoes estaticas", status: "active",
    },
    // Course 5, Chapter 3
    {
      id: "55550001-0001-0001-0001-000000000005", chapter_id: C5_CH3, tenant_id: TENANT_ID,
      text: "Voce recebe dados de vendas de 3 sistemas diferentes em formatos distintos. Como usaria Power Query para consolidar?",
      skill: "aplicacao", intention: "Testar uso pratico de Power Query", expected_depth: "Descrever importacao, transformacao (padronizar colunas) e append das 3 fontes", status: "active",
    },
    {
      id: "55550001-0001-0001-0001-000000000006", chapter_id: C5_CH3, tenant_id: TENANT_ID,
      text: "Qual a vantagem de publicar datasets do Excel no Power BI em vez de trabalhar apenas localmente?",
      skill: "reflexao", intention: "Refletir sobre colaboracao e escalabilidade", expected_depth: "Atualizacao automatica, acesso compartilhado, governanca de dados e escalabilidade", status: "active",
    },
  ]

  for (const q of questions) {
    console.log(`Creating question: ${q.text.substring(0, 50)}...`)
    const { error: qErr } = await supabase.from("questions").upsert(q)
    if (qErr) {
      console.error(`  Question error: ${qErr.message}`)
    } else {
      console.log(`  Question created`)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. Enrollments (~12 total)
  // ═══════════════════════════════════════════════════════════════
  const enrollments = [
    // student@a.com: Courses 1, 2, 3
    { id: "99999999-9999-9999-9999-999999999999", student_id: userIds.student, course_id: COURSE_1_ID, tenant_id: TENANT_ID, status: "active", progress: {} },
    { id: "e0e00001-0001-0001-0001-000000000001", student_id: userIds.student, course_id: COURSE_2_ID, tenant_id: TENANT_ID, status: "active", progress: {} },
    { id: "e0e00001-0001-0001-0001-000000000002", student_id: userIds.student, course_id: COURSE_3_ID, tenant_id: TENANT_ID, status: "active", progress: {} },
    // student2@a.com: Courses 1, 3, 5
    { id: "e0e00002-0001-0001-0001-000000000001", student_id: userIds.student2, course_id: COURSE_1_ID, tenant_id: TENANT_ID, status: "active", progress: {} },
    { id: "e0e00002-0001-0001-0001-000000000002", student_id: userIds.student2, course_id: COURSE_3_ID, tenant_id: TENANT_ID, status: "active", progress: {} },
    { id: "e0e00002-0001-0001-0001-000000000003", student_id: userIds.student2, course_id: COURSE_5_ID, tenant_id: TENANT_ID, status: "completed", progress: {} },
    // student3@a.com: Courses 1, 3
    { id: "e0e00003-0001-0001-0001-000000000001", student_id: userIds.student3, course_id: COURSE_1_ID, tenant_id: TENANT_ID, status: "active", progress: {} },
    { id: "e0e00003-0001-0001-0001-000000000002", student_id: userIds.student3, course_id: COURSE_3_ID, tenant_id: TENANT_ID, status: "active", progress: {} },
    // student4@a.com: Courses 2, 3
    { id: "e0e00004-0001-0001-0001-000000000001", student_id: userIds.student4, course_id: COURSE_2_ID, tenant_id: TENANT_ID, status: "active", progress: {} },
    { id: "e0e00004-0001-0001-0001-000000000002", student_id: userIds.student4, course_id: COURSE_3_ID, tenant_id: TENANT_ID, status: "active", progress: {} },
  ]

  for (const e of enrollments) {
    if (!e.student_id) {
      console.log(`  Skipping enrollment — student not found`)
      continue
    }
    console.log(`Enrolling ${e.student_id} in course ${e.course_id}...`)
    const { error: enrollErr } = await supabase.from("enrollments").upsert(e)
    if (enrollErr) {
      console.error(`  Enrollment error: ${enrollErr.message}`)
    } else {
      console.log(`  Enrolled`)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. Sessions + Messages (2 completed sessions)
  // ═══════════════════════════════════════════════════════════════
  const SESSION_1_ID = "s0s00001-0001-0001-0001-000000000001"
  const SESSION_2_ID = "s0s00002-0001-0001-0001-000000000001"

  // Session 1: student@a.com on Course 1, Chapter 1, Question 1
  if (userIds.student) {
    console.log("Creating session 1 (student@a.com, IA para Negocios, Cap 1)...")
    const { error: s1Err } = await supabase.from("sessions").upsert({
      id: SESSION_1_ID,
      student_id: userIds.student,
      chapter_id: C1_CH1,
      question_id: "11110001-0001-0001-0001-000000000001",
      tenant_id: TENANT_ID,
      status: "completed",
      interactions_remaining: 14,
      turn_number: 6,
    })
    if (s1Err) {
      console.error(`  Session 1 error: ${s1Err.message}`)
    } else {
      console.log(`  Session 1 created`)

      const s1Messages = [
        { id: "m0m00001-0001-0001-0001-000000000001", session_id: SESSION_1_ID, tenant_id: TENANT_ID, role: "system", content: 'Pergunta: Uma empresa de varejo esta considerando implementar IA. O CEO pergunta: "IA vai substituir meus funcionarios?". Como voce responderia?', turn_number: 0 },
        { id: "m0m00001-0001-0001-0001-000000000002", session_id: SESSION_1_ID, tenant_id: TENANT_ID, role: "user", content: "Acredito que a IA nao vai substituir todos os funcionarios, mas sim automatizar algumas tarefas repetitivas. A IA que temos hoje e estreita, focada em tarefas especificas.", turn_number: 1 },
        { id: "m0m00001-0001-0001-0001-000000000003", session_id: SESSION_1_ID, tenant_id: TENANT_ID, role: "assistant", content: "Boa observacao sobre a IA Estreita! Voce mencionou tarefas repetitivas. Pode dar exemplos especificos de quais tarefas no varejo seriam automatizadas e quais exigiriam o toque humano?", turn_number: 2 },
        { id: "m0m00001-0001-0001-0001-000000000004", session_id: SESSION_1_ID, tenant_id: TENANT_ID, role: "user", content: "No varejo, a IA pode automatizar controle de estoque com previsao de demanda, atendimento basico via chatbot e analise de dados de vendas. Mas o atendimento personalizado, negociacoes complexas e gestao de equipe continuam exigindo pessoas.", turn_number: 3 },
        { id: "m0m00001-0001-0001-0001-000000000005", session_id: SESSION_1_ID, tenant_id: TENANT_ID, role: "assistant", content: "Excelente analise! Voce fez uma distincao clara entre tarefas automatizaveis e humanas. E sobre a IA Geral (AGI) — como isso mudaria o cenario? E quando voce acha que chegariamos la?", turn_number: 4 },
        { id: "m0m00001-0001-0001-0001-000000000006", session_id: SESSION_1_ID, tenant_id: TENANT_ID, role: "user", content: "A AGI e ainda teorica e nao temos previsao concreta de quando sera alcancada. Se existisse, ai sim poderia substituir mais funcoes humanas. Mas por enquanto, a IA e uma ferramenta que complementa o trabalho, nao substitui. A questao para o CEO e: como usar IA para tornar seus funcionarios mais produtivos, nao como substitui-los.", turn_number: 5 },
      ]

      for (const msg of s1Messages) {
        const { error: msgErr } = await supabase.from("messages").upsert(msg)
        if (msgErr) console.error(`  Message error: ${msgErr.message}`)
      }
      console.log(`  Session 1 messages created (6)`)

      // QA Report for session 1
      const { error: qa1Err } = await supabase.from("qa_reports").upsert({
        id: "qr000001-0001-0001-0001-000000000001",
        session_id: SESSION_1_ID,
        message_id: "m0m00001-0001-0001-0001-000000000006",
        tenant_id: TENANT_ID,
        verdict: "approved",
        score: 9.2,
        criteria_results: {
          depth: { score: 9, comment: "Distinguiu IA Estreita de AGI com clareza" },
          application: { score: 9.5, comment: "Exemplos concretos do varejo" },
          critical_thinking: { score: 9, comment: "Reposicionou a pergunta de substituicao para complemento" },
        },
      })
      if (qa1Err) console.error(`  QA Report 1 error: ${qa1Err.message}`)
      else console.log(`  QA Report 1 created (score: 9.2)`)
    }
  }

  // Session 2: student2@a.com on Course 2, Chapter 1, Question 1
  if (userIds.student2) {
    console.log("Creating session 2 (student2@a.com, Lideranca, Cap 1)...")
    const { error: s2Err } = await supabase.from("sessions").upsert({
      id: SESSION_2_ID,
      student_id: userIds.student2,
      chapter_id: C2_CH1,
      question_id: "22220001-0001-0001-0001-000000000001",
      tenant_id: TENANT_ID,
      status: "completed",
      interactions_remaining: 14,
      turn_number: 6,
    })
    if (s2Err) {
      console.error(`  Session 2 error: ${s2Err.message}`)
    } else {
      console.log(`  Session 2 created`)

      const s2Messages = [
        { id: "m0m00002-0001-0001-0001-000000000001", session_id: SESSION_2_ID, tenant_id: TENANT_ID, role: "system", content: "Pergunta: Um gestor sempre usa o mesmo estilo de lideranca com todos. Quais problemas isso pode causar? O que a lideranca situacional propoe?", turn_number: 0 },
        { id: "m0m00002-0001-0001-0001-000000000002", session_id: SESSION_2_ID, tenant_id: TENANT_ID, role: "user", content: "Se o gestor usa sempre o mesmo estilo, alguns funcionarios podem se sentir microgerenciados enquanto outros se sentiriam abandonados sem orientacao.", turn_number: 1 },
        { id: "m0m00002-0001-0001-0001-000000000003", session_id: SESSION_2_ID, tenant_id: TENANT_ID, role: "assistant", content: "Boa percepcao! Voce tocou num ponto chave: a relacao entre estilo e maturidade. Pode elaborar como a lideranca situacional resolveria isso na pratica?", turn_number: 2 },
        { id: "m0m00002-0001-0001-0001-000000000004", session_id: SESSION_2_ID, tenant_id: TENANT_ID, role: "user", content: "A lideranca situacional diz que o lider deve adaptar seu estilo. Com um junior, seria mais diretivo. Com um senior experiente, pode delegar mais e dar autonomia.", turn_number: 3 },
        { id: "m0m00002-0001-0001-0001-000000000005", session_id: SESSION_2_ID, tenant_id: TENANT_ID, role: "assistant", content: "E se o lider tem um colaborador senior que esta enfrentando um desafio novo para ele — um projeto em uma area que nao domina. O estilo deveria ser delegacao ou voltar a ser mais diretivo?", turn_number: 4 },
        { id: "m0m00002-0001-0001-0001-000000000006", session_id: SESSION_2_ID, tenant_id: TENANT_ID, role: "user", content: "Nesse caso, mesmo sendo senior, ele e 'junior' nessa tarefa especifica. O lider deveria voltar a um estilo mais diretivo para essa tarefa, enquanto mantem a delegacao em areas onde o colaborador tem dominio.", turn_number: 5 },
      ]

      for (const msg of s2Messages) {
        const { error: msgErr } = await supabase.from("messages").upsert(msg)
        if (msgErr) console.error(`  Message error: ${msgErr.message}`)
      }
      console.log(`  Session 2 messages created (6)`)

      const { error: qa2Err } = await supabase.from("qa_reports").upsert({
        id: "qr000002-0001-0001-0001-000000000001",
        session_id: SESSION_2_ID,
        message_id: "m0m00002-0001-0001-0001-000000000006",
        tenant_id: TENANT_ID,
        verdict: "approved",
        score: 7.8,
        criteria_results: {
          depth: { score: 7.5, comment: "Compreensao boa mas poderia aprofundar nos 4 estilos de Hersey-Blanchard" },
          application: { score: 8, comment: "Bom uso de exemplos praticos junior vs senior" },
          critical_thinking: { score: 8, comment: "Excelente insight sobre maturidade ser relativa a tarefa" },
        },
      })
      if (qa2Err) console.error(`  QA Report 2 error: ${qa2Err.message}`)
      else console.log(`  QA Report 2 created (score: 7.8)`)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. Assessment History (3 records)
  // ═══════════════════════════════════════════════════════════════
  try {
    console.log("Creating assessment history...")
    const assessments = [
      {
        id: "ah000001-0001-0001-0001-000000000001",
        user_id: userIds.student,
        tenant_id: TENANT_ID,
        assessment_type: "big_five",
        result: {
          openness: 78,
          conscientiousness: 85,
          extraversion: 62,
          agreeableness: 71,
          neuroticism: 35,
          summary: "Perfil altamente consciencioso com boa abertura a experiencias. Tendencia a organizacao e planejamento.",
        },
      },
      {
        id: "ah000002-0001-0001-0001-000000000001",
        user_id: userIds.student2,
        tenant_id: TENANT_ID,
        assessment_type: "big_five",
        result: {
          openness: 88,
          conscientiousness: 72,
          extraversion: 81,
          agreeableness: 76,
          neuroticism: 42,
          summary: "Perfil criativo e extrovertido com boa conscienciosidade. Natural para papeis que exigem inovacao e colaboracao.",
        },
      },
      {
        id: "ah000003-0001-0001-0001-000000000001",
        user_id: userIds.student2,
        tenant_id: TENANT_ID,
        assessment_type: "disc",
        result: {
          dominance: 45,
          influence: 82,
          steadiness: 68,
          conscientiousness: 55,
          primary_style: "I",
          summary: "Perfil predominantemente Influente. Forte em comunicacao, persuasao e construcao de relacionamentos.",
        },
      },
    ]

    for (const a of assessments) {
      if (!a.user_id) {
        console.log(`  Skipping assessment — user not found`)
        continue
      }
      const { error: aErr } = await supabase.from("assessment_history").upsert(a)
      if (aErr) {
        console.error(`  Assessment error: ${aErr.message}`)
      } else {
        console.log(`  Assessment created: ${a.assessment_type} for user ${a.user_id}`)
      }
    }
  } catch {
    console.log("Assessment history table not available, skipping...")
  }

  // ═══════════════════════════════════════════════════════════════
  // Done
  // ═══════════════════════════════════════════════════════════════
  console.log("\n✓ Seed complete!")
  console.log("\nTest credentials (all passwords: 123456):")
  console.log("  super@a.com  (super_admin)")
  console.log("  admin@a.com  (admin)")
  console.log("  manager@a.com (manager)")
  console.log("  teacher@a.com (teacher)")
  console.log("  student@a.com (student) — enrolled in IA, Lideranca, Onboarding")
  console.log("  student2@a.com (student) — enrolled in IA, Onboarding, Excel(completed)")
  console.log("  student3@a.com (student) — enrolled in IA, Onboarding")
  console.log("  student4@a.com (student) — enrolled in Lideranca, Onboarding")
  console.log("\nCourses:")
  console.log("  1. IA para Negocios (published, 3 chapters)")
  console.log("  2. Lideranca e Gestao (published, 4 chapters)")
  console.log("  3. Primeiros Passos (onboarding, 2 chapters)")
  console.log("  4. Marketing Digital (draft, 3 chapters)")
  console.log("  5. Excel para Analise (archived, 3 chapters)")
}

seed().catch(console.error)
