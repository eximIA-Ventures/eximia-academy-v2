# Referência Stratws One — Estudo Funcional da Área de Configurações

> **Autor:** REGENTE (orquestrador do Hub de Configurações)
> **Data:** 2026-07-22 · **Fonte:** navegação read-only autenticada em `cory.stratws.com/Configuracoes` (tenant real Cory), via portal Maestri, autorizada por Hugo.
> **Escopo:** FUNÇÕES, não visual (decisão do Hugo: o visual do nosso mockup está escolhido).
> **Cobertura:** 33 seções do diretório, 4 grupos. Todas visitadas, exceto "Faixas para os Indicadores Cronograma" (modal sem URL própria; função descrita no diretório).

---

## 1. Arquitetura de informação do hub Stratws

A página `/Configuracoes` é um **diretório de links com descrição de 1 linha por item**, agrupado por módulo:

| Grupo | Qtde | Natureza |
|:---|:---|:---|
| **Geral** | 11 | Governança da conta: contrato, unidades, usuários, grupos, planos anuais, cargos, taxonomias transversais, visual |
| **Oportunidades de Melhoria** | 15 | Configuração do módulo de fluxos (classificações, métodos, aprovações, prazos, regras, taxonomias de segurança) |
| **Performance Corporativa** | 5 | Configuração de indicadores (base, tipos, gráficos, cenários, faixas) |
| **Gestão de Talentos** | 2 | Ciclos e formulários de avaliação |

**Padrão estrutural:** cada seção abre uma tela própria com botão "Voltar" que retorna SEMPRE ao diretório `/one/Configuracoes`. Navegação hub-and-spoke pura (não há menu lateral persistente dentro das seções — o nosso menu lateral fixo é superior em orientação).

**Lição nº 1 para o nosso hub:** o hub não é só das capabilities "core" (usuários, marca, plano); ele hospeda também as **configurações de cada módulo do produto**. No nosso caso: IA socrática, Course Designer, avaliações, trilhas etc. têm lar natural no hub quando ganharem configuração por tenant.

## 2. Seção a seção — grupo Geral (o análogo do nosso hub)

### 2.1 Meu Contrato (`/one/ContratosDeUso/Contratos`)
Tela 100% read-only: **Produtos** (por módulo: "Contratado (Versão Completa)" / "Não Contratado") + **Limitações** (Usuários Contratados: Ilimitado; Unidades Gerenciais por Plano de Gestão: 7) com **tabela de uso por ano** ("7", "1 (6 Disponíveis)"). Equivale ao nosso Plano & Cobrança: entitlements + quota + uso, sem self-service.

### 2.2 Unidades Gerenciais (`/one/Manutencao/UnidadeGerencial`)
- **Árvore** (expansores [+]), escopada por **Plano de Gestão (ano)** — a estrutura organizacional é versionada por ano.
- Busca por sigla, nome ou responsável.
- Ficha da unidade: Sigla, Descrição*, **Subordinado à** (parent → hierarquia real), **Responsável** (picker de usuário), **Código de Interface** (chave p/ integrações), toggle de módulo (Exibir Tendência no Farol).
- Abas da unidade: **Missão e Visão** (textareas) · **Usuários que acessam** · **Grupos que acessam** · **Documentos**.
- Acesso é gerenciável DOS DOIS LADOS: do usuário (aba UGs) e da unidade (aba usuários).

### 2.3 Usuários (`/one/Manutencao/Usuarios`)
- Lista **search-first** (só renderiza após buscar; placeholder "Pesquise usuários por nome, login, email ou unidade gerencial"). Filtros-toggle: **Ativos** ("somente usuários ativos") e **Terceiros**; filtro extra por árvore de unidade (ícone org).
- Colunas: Nome, Usuário (login), Email, **Permissão**, Unidade, Telefone, **Terceiro** (Sim/Não).
- Botões de topo: Adicionar, **Logs de Acesso**, Voltar.
- **Ficha do usuário** (5 abas + cabeçalho):
  - Cabeçalho: Nome*, Usuário*, Email*, **Tipo de Permissão: Normal | Administrador | Super-usuário** (só 3 níveis globais), Receber Notificações por Email (Sim/Não), foto (Alterar), **Redefinir Senha** (modal), **Logs de Acesso** (do indivíduo). Ações: Salvar, **Desativar Usuário**, Voltar.
  - **Profissional:** Matrícula, Unidade Gerencial, **Exerce cargo de chefia** (Sim/Não), Cargo (picker + criar), **Superior Imediato** ("Definir Superior Imediato"), Data de Admissão, Data de Admissão na Função, Observações Gerais.
  - **Unidades Gerenciais:** memberships por unidade com toggle **"Acesso às subordinadas"** (Não/Sim) + edição de permissão por unidade.
  - **Regras:** grants granulares por usuário (ex.: "Administrar o módulo Gestão de Talentos → Sim") com Adicionar.
  - **Grupos de Usuários:** memberships em grupos funcionais (dropdown + Adicionar).
  - **Lançamento de Indicadores:** escopo operacional — quais indicadores o usuário lança, filtrado por Plano de Gestão.

### 2.4 Grupos de Usuário (`/one/Manutencao/GruposDeUsuario`)
- CRUD simples de lista, com painel de edição: Nome + 4 abas: **Usuários** (membros) · **UGs** (unidades vinculadas) · **Regras** (grants do grupo) · **Lançamento de Indicadores**.
- O modelo de permissão avançada do Stratws é: **papel global raso (3 níveis) + REGRAS granulares atribuíveis a usuário OU grupo + escopo por unidade**. Grupos são simultaneamente feixes de capacidade e de escopo.
- Uso real no tenant Cory: dezenas de grupos operacionais padrão "Aprovador de {fluxo} - {unidade}" (papéis de workflow por unidade).

### 2.5 Planos de Gestão (`/one/PlanosDeGestao`)
- Contêiner ANUAL que escopa todo o resto (unidades, indicadores, ciclos): Nome, Exercício (ano), Ativo (Sim/Não).
- Ação **"Copiar de outro Plano de Gestão"** (rollover de ano inteiro).
- Abas: Programas de Resultados · Ciclos de Avaliação · **Bloqueios** (regras de trava/congelamento).

### 2.6 Cargos (`/one/Cargos`)
CRUD mínimo: modal com 1 campo (Nome) + "Salvar e adicionar novo". **O nosso Cargos (área, senioridade, descrição, vínculo a trilhas) é substancialmente mais rico.**

### 2.7 Taxonomias transversais
- **Origens** (`OportunidadesDeMelhoria/Origens`), **Áreas de Resultados** (`AreasDeResultado`: Financeiro, Operação, Comercial...), **Unidades de Medida** (`UnidadeMedida`: %, Kg, kWh/ton...), **Tags de Tarefa** (`TagDeAtividade`, form com cor): todos CRUDs simples nome(-sigla), padrão lista+Adicionar+Pesquisar+Excluir por linha.

### 2.8 Personalização Visual (`/foundation/settings/visual`)
Mínima: **Logotipo** (Editar) + **Aparência do Menu** (cor do menu, 2 swatches). O nosso whitelabel (textos, favicon, preview de login, cores completas) é muito superior.

## 3. Grupos de módulo (padrões que importam)

### 3.1 Oportunidades de Melhoria (15 seções)
- **Classificações** (de Solução de Problemas; de Ocorrência): taxonomias-mãe dos fluxos.
- **Métodos** (`MetodosDasSolucoesDeProblemas`): CRUD de metodologias (A3 Operacional, DMAIC, FCAR, Análise de Acidentes...), com filtro por classificação; método define cor + ferramentas por passo.
- **Configurações do Fluxo (SP):** por classificação, define quem verifica/aprova, alternando alvo por abas **"Unidade Gerencial" | "Grupo de usuário"**.
- **Configurações do Fluxo de Ocorrência:** matriz de checkboxes por Unidade Gerencial + grupo aprovador por linha, com o link-ação **"Manter esta configuração nas Unidades Gerenciais subordinadas"** → **herança de configuração pela árvore de unidades** (cascade opt-in).
- **Configurações de Prazo:** prazo por etapa do fluxo, filtrado por Classificação × UG.
- **Configurações de Regras:** regras por etapa do fluxo (OM/Ocorrência).
- **Grupos Responsáveis:** consulta por UG × Origem × Classificação × Método → quem aprova/verifica.
- **Interação com a Comunidade / Matrizes de Priorização** (GUT, Rapidez/Autonomia/Benefício...) / **Natureza das Lesões / Normas e Requisitos** (NRs reais) / **Partes do Corpo / Tipos de Equipamentos:** CRUDs de domínio.
- **Contexto de tenant/ano visível:** várias telas mostram chips "FAB MG" e "2026" no topo — o contexto (unidade + exercício) acompanha a configuração.

### 3.2 Performance Corporativa (5)
- **Indicadores** (base p/ o Farol; search-first), **Tipos de Indicador** (Nome+Sigla: Estratégico, Tático, Operacional, Comportamental), **Modelos de Gráficos** (presets), **Cenários de Análise** (form de RENOMEAÇÃO de slots fixos: "Cenário 1: Forecast-FC", "Cenário 2: Projetado-PJ"), Faixas p/ Indicadores Cronograma (modal; faixas de nota).

### 3.3 Gestão de Talentos (2)
- **Ciclos de Avaliação** (escopado por Plano de Gestão) e **Formulários de Avaliação** (matrizes de competência). CRUDs padrão.

## 4. Logs de Acesso (`/one/Manutencao/LogDeAcesso/Filtrar`)
Colunas: Usuário, Email, Matrícula, Telefone, Unidade Gerencial, **Módulo**, Origem (Navegador Web), Data/Hora Acesso + **Gerar Excel**. É **último acesso por usuário × módulo** (telemetria de adoção), acessível global (botão na tela Usuários) e por indivíduo (link na ficha). **NÃO é trilha de auditoria de ações** — o Stratws, nesta superfície, não expõe "quem mudou o quê". Nossa Auditoria proposta (ações administrativas com autor/alvo/IP) vai ALÉM da referência.

## 5. Síntese — o que a referência ensina ao nosso hub (função, não visual)

| # | Padrão Stratws | Tradução para o nosso hub |
|:---|:---|:---|
| 1 | Hub hospeda config de módulos, não só o "core" | Reservar espaço no IA p/ seções de módulo (IA socrática, Course Designer, avaliações) crescerem dentro do hub |
| 2 | Hierarquia de unidades (Subordinado à) + acesso às subordinadas + **cascade de config p/ subordinadas** | Confirma o gap 8 do mapa como aposta futura; se um dia introduzirmos `parent_id` em areas, os padrões prontos são: flag "acesso às subordinadas" no membership e cascade opt-in de configuração |
| 3 | Papel global raso (3 níveis) + **Regras granulares por usuário OU grupo** + escopo por unidade | Valida a generalização do padrão `instructor_permissions` (gap 9); grupo como feixe de capacidade+escopo é o degrau seguinte do nosso manager_groups |
| 4 | Estrutura organizacional **versionada por ano** (Plano de Gestão) com rollover ("Copiar de outro Plano") | Não se aplica hoje ao LMS; anotar como conceito se Academy ganhar ciclos/turmas anuais |
| 5 | Usuário carrega o vínculo organizacional (Superior Imediato, Cargo, Chefia, Matrícula, Terceiro) | Já temos `reports_to` e job_roles; campos "Matrícula" e flag "Terceiro" são candidatos baratos ao nosso modelo de usuário B2B |
| 6 | Ficha de usuário com ações administrativas: Desativar, **Redefinir Senha**, **Logs de Acesso do indivíduo** | Adicionar "reset de senha" e "último acesso por área do produto" como ações da ficha na nossa seção Usuários |
| 7 | Search-first em listas grandes | Padrão consciente de performance; nossa lista paginada com filtros já cobre |
| 8 | Meu Contrato: produtos contratados + quotas com uso por período, read-only | Espelha nosso Plano & Cobrança; reforça mostrar USO junto do limite (já no mockup) |
| 9 | Logs de Acesso = adoção (último acesso por módulo), não auditoria | Nossa Auditoria de AÇÕES é diferencial real vs. a referência; e "último acesso" nós já temos na lista de usuários |
| 10 | Diretório com **descrição de 1 linha por seção** | Adotar: subtítulo descritivo por item de menu/página no hub (o mockup já faz nos panel-headers) |
| 11 | Config contextual: chips de contexto (unidade, ano) visíveis na tela de configuração | No nosso multi-tenant: o tenant-chip do mockup cumpre o papel; manter sempre visível |
| 12 | Personalização Visual e Cargos do Stratws são MAIS POBRES que os nossos equivalentes | Confiança: nosso whitelabel e nosso Cargos já superam a referência; não copiar para baixo |

---
*Estudo conduzido com cliques somente de navegação (entrar/voltar/expandir/filtrar visualização); nenhum botão de ação (Salvar/Adicionar/Excluir/Rotacionar/etc.) foi acionado. Portal devolvido à página inicial de Configurações.*
