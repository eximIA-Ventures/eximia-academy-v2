-- =============================================================
-- Seed: Tenant Demo + 8 Users + 5 Courses + 15 Chapters + 30 Questions
-- =============================================================

-- Tenant
INSERT INTO tenants (id, name, slug, plan, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Demo', 'demo', 'pro', 'active');

-- Users (linked to auth.users — seed script should create auth users first)
-- For local dev, we use deterministic UUIDs:
-- super_admin: 00000000-0000-0000-0000-000000000005
-- admin:       aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- manager:     bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
-- teacher:     cccccccc-cccc-cccc-cccc-cccccccccccc
-- student:     dddddddd-dddd-dddd-dddd-dddddddddddd
-- student2:    dddddddd-dddd-dddd-dddd-dddddddddd02
-- student3:    dddddddd-dddd-dddd-dddd-dddddddddd03
-- student4:    dddddddd-dddd-dddd-dddd-dddddddddd04

INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'super@a.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), ''),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'admin@a.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), ''),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'manager@a.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), ''),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'teacher@a.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), ''),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'student@a.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), ''),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', '00000000-0000-0000-0000-000000000000', 'student2@a.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), ''),
  ('dddddddd-dddd-dddd-dddd-dddddddddd03', '00000000-0000-0000-0000-000000000000', 'student3@a.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), ''),
  ('dddddddd-dddd-dddd-dddd-dddddddddd04', '00000000-0000-0000-0000-000000000000', 'student4@a.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '');

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', '{"sub":"00000000-0000-0000-0000-000000000005","email":"super@a.com"}', 'email', '00000000-0000-0000-0000-000000000005', now(), now(), now()),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","email":"admin@a.com"}', 'email', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now(), now(), now()),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","email":"manager@a.com"}', 'email', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now(), now(), now()),
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","email":"teacher@a.com"}', 'email', 'cccccccc-cccc-cccc-cccc-cccccccccccc', now(), now(), now()),
  (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","email":"student@a.com"}', 'email', 'dddddddd-dddd-dddd-dddd-dddddddddddd', now(), now(), now()),
  (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddd02', '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddd02","email":"student2@a.com"}', 'email', 'dddddddd-dddd-dddd-dddd-dddddddddd02', now(), now(), now()),
  (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddd03', '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddd03","email":"student3@a.com"}', 'email', 'dddddddd-dddd-dddd-dddd-dddddddddd03', now(), now(), now()),
  (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddd04', '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddd04","email":"student4@a.com"}', 'email', 'dddddddd-dddd-dddd-dddd-dddddddddd04', now(), now(), now());

-- Application users (super_admin has NULL tenant_id per CHECK constraint)
INSERT INTO users (id, tenant_id, email, full_name, role) VALUES
  ('00000000-0000-0000-0000-000000000005', NULL, 'super@a.com', 'Super Admin', 'super_admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin@a.com', 'Admin User', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'manager@a.com', 'Manager User', 'manager'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'teacher@a.com', 'Teacher User', 'teacher'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'student@a.com', 'Student User', 'student'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', '11111111-1111-1111-1111-111111111111', 'student2@a.com', 'Ana Silva', 'student'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd03', '11111111-1111-1111-1111-111111111111', 'student3@a.com', 'Carlos Santos', 'student'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd04', '11111111-1111-1111-1111-111111111111', 'student4@a.com', 'Beatriz Lima', 'student');

-- =============================================================
-- Course 1: Inteligencia Artificial para Negocios (published)
-- =============================================================
INSERT INTO courses (id, tenant_id, title, description, status, created_by) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111',
   'Inteligencia Artificial para Negocios',
   'Curso completo sobre como a Inteligencia Artificial esta transformando o mundo corporativo.',
   'published', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- =============================================================
-- Course 2: Lideranca e Gestao de Equipes (published)
-- =============================================================
INSERT INTO courses (id, tenant_id, title, description, status, created_by) VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'Lideranca e Gestao de Equipes',
   'Desenvolva habilidades essenciais de lideranca. Aprenda a motivar equipes, gerenciar conflitos e construir uma cultura organizacional forte.',
   'published', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- =============================================================
-- Course 3: Primeiros Passos na Plataforma (onboarding, published)
-- =============================================================
INSERT INTO courses (id, tenant_id, title, description, status, type, created_by) VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   'Primeiros Passos na Plataforma',
   'Trilha de onboarding para novos usuarios.',
   'published', 'onboarding', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- =============================================================
-- Course 4: Marketing Digital Avancado (draft)
-- =============================================================
INSERT INTO courses (id, tenant_id, title, description, status, created_by) VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
   'Marketing Digital Avancado',
   'Estrategias avancadas de marketing digital incluindo SEO, trafego pago, automacao e analytics.',
   'draft', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- =============================================================
-- Course 5: Excel para Analise de Dados (archived)
-- =============================================================
INSERT INTO courses (id, tenant_id, title, description, status, created_by) VALUES
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
   'Excel para Analise de Dados',
   'Domine o Excel para analise de dados corporativos. Tabelas dinamicas, formulas avancadas, dashboards e Power BI.',
   'archived', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- =============================================================
-- Chapters: Course 1 (3 chapters)
-- =============================================================
INSERT INTO chapters (id, course_id, tenant_id, title, content, learning_objective, "order", status, video_url, audio_url) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111',
   'O que e Inteligencia Artificial?',
   E'## O que e Inteligencia Artificial?\n\nA **Inteligencia Artificial (IA)** e um campo da ciencia da computacao que busca criar sistemas capazes de realizar tarefas que normalmente exigem inteligencia humana. Desde reconhecimento de voz ate decisoes complexas, a IA esta transformando todos os setores da economia.\n\n![Diagrama conceitual de Inteligencia Artificial mostrando as diferentes subáreas](https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80)\n\n## Historia e Evolucao\n\nA historia da IA comeca na decada de 1950, quando **Alan Turing** propos a famosa pergunta: \"As maquinas podem pensar?\". Desde entao, o campo passou por diversas fases:\n\n1. **1950-1970** — Os primeiros programas de IA e o otimismo inicial\n2. **1970-1990** — O \"inverno da IA\" e a falta de poder computacional\n3. **1990-2010** — Redes neurais e o renascimento do Machine Learning\n4. **2010-presente** — Deep Learning, LLMs e IA Generativa\n\n![Linha do tempo da evolucao da Inteligencia Artificial](https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80)\n\n## Tipos de Inteligencia Artificial\n\nPodemos classificar a IA em tres grandes categorias:\n\n### IA Estreita (ANI)\nSistemas projetados para uma tarefa especifica. Exemplos: assistentes virtuais, sistemas de recomendacao, reconhecimento facial.\n\n### IA Geral (AGI)\nSistemas com capacidade cognitiva equivalente a humana — ainda **teorica**.\n\n### Super IA (ASI)\nSistemas que superariam a inteligencia humana em todos os aspectos — conceito **especulativo**.\n\n> \"A IA e a nova eletricidade. Assim como a eletricidade transformou quase tudo ha 100 anos, a IA vai transformar todos os setores nos proximos anos.\" — **Andrew Ng**\n\n## Aplicacoes no Mundo dos Negocios\n\nA IA ja esta presente em diversas areas empresariais:\n\n| Area | Aplicacao | Impacto |\n|------|-----------|--------|\n| Marketing | Personalizacao em escala | +40% conversao |\n| RH | Triagem automatizada de CVs | -60% tempo de contratacao |\n| Financas | Deteccao de fraude | 99.5% precisao |\n| Logistica | Otimizacao de rotas | -25% custos |\n\n![Dashboard de analytics com IA aplicada a negocios](https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80)\n\n## Conceitos Fundamentais\n\nPara entender IA, voce precisa dominar alguns conceitos-chave:\n\n- **Dados de treinamento**: a materia-prima de qualquer modelo de IA\n- **Algoritmo**: o conjunto de regras que o modelo segue para aprender\n- **Modelo**: o resultado do treinamento — a \"inteligencia\" em si\n- **Inferencia**: quando o modelo aplica o que aprendeu a dados novos\n\n```python\n# Exemplo simples de um modelo de classificacao\nfrom sklearn.ensemble import RandomForestClassifier\n\nmodelo = RandomForestClassifier(n_estimators=100)\nmodelo.fit(dados_treino, labels_treino)\nprevisao = modelo.predict(dados_novos)\n```\n\n## Proximo Passo\n\nNo proximo capitulo, vamos mergulhar em **Machine Learning na Pratica** — onde voce vai aprender os tres tipos de aprendizado (supervisionado, nao-supervisionado e por reforco) e como aplica-los em problemas reais.',
   'Compreender os conceitos fundamentais de IA e identificar suas aplicacoes no contexto empresarial',
   1, 'published',
   'https://www.youtube.com/watch?v=2ePf9rue1Ao',
   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'),
  ('aaaaaaaa-1111-2222-3333-444444444444', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111',
   'Machine Learning na Pratica',
   'Machine Learning (ML) e o subcampo da IA que permite que sistemas aprendam a partir de dados.',
   'Entender os tipos de Machine Learning e como aplica-los para resolver problemas reais de negocio',
   2, 'published', NULL, NULL),
  ('bbbbbbbb-1111-2222-3333-444444444444', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111',
   'IA Generativa e o Futuro dos Negocios',
   'A IA Generativa representa uma revolucao na forma como criamos conteudo, codigo e solucoes.',
   'Avaliar criticamente as oportunidades e riscos da IA generativa para tomada de decisao estrategica',
   3, 'published', NULL, NULL);

-- =============================================================
-- Chapters: Course 2 (4 chapters)
-- =============================================================
INSERT INTO chapters (id, course_id, tenant_id, title, content, learning_objective, "order", status) VALUES
  ('c2c10000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'Fundamentos da Lideranca Moderna',
   'Lideranca moderna vai alem de dar ordens. E sobre influenciar, inspirar e criar condicoes para resultados excepcionais.',
   'Identificar diferentes estilos de lideranca e quando aplicar cada um',
   1, 'published'),
  ('c2c20000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'Gestao de Conflitos',
   'Conflitos sao inevitaveis em qualquer equipe. A diferenca esta em como o lider os gerencia.',
   'Aplicar tecnicas de resolucao de conflitos em cenarios corporativos',
   2, 'published'),
  ('c2c30000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'Feedback e Desenvolvimento de Equipe',
   'Feedback eficaz e a ferramenta mais poderosa de desenvolvimento de pessoas.',
   'Dominar tecnicas de feedback e desenvolvimento continuo de equipes',
   3, 'published'),
  ('c2c40000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'Cultura Organizacional e Engajamento',
   'Cultura nao e o que esta escrito na parede — e o que acontece quando o lider nao esta olhando.',
   'Construir e manter uma cultura organizacional que promova engajamento e resultados',
   4, 'published');

-- =============================================================
-- Chapters: Course 3 (2 chapters)
-- =============================================================
INSERT INTO chapters (id, course_id, tenant_id, title, content, learning_objective, "order", status) VALUES
  ('c3c10000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   'Bem-vindo a Plataforma',
   'Bem-vindo! Este capitulo vai te ajudar a dar os primeiros passos na plataforma.',
   'Navegar pela plataforma e entender seus principais recursos',
   1, 'published'),
  ('c3c20000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   'Sessoes Socraticas: Aprendizado Ativo',
   'As sessoes socraticas sao o coracao da nossa metodologia de aprendizado.',
   'Entender e aproveitar ao maximo as sessoes socraticas da plataforma',
   2, 'published');

-- =============================================================
-- Chapters: Course 4 (3 chapters, draft)
-- =============================================================
INSERT INTO chapters (id, course_id, tenant_id, title, content, learning_objective, "order", status) VALUES
  ('c4c10000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
   'SEO Avancado',
   'Estrategias avancadas de SEO para dominar os resultados de busca.',
   'Dominar estrategias avancadas de SEO tecnico e de conteudo',
   1, 'draft'),
  ('c4c20000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
   'Trafego Pago e Automacao',
   'Combine trafego pago com automacao para maximizar ROI.',
   'Integrar trafego pago com automacao de marketing para otimizar conversoes',
   2, 'draft'),
  ('c4c30000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
   'Analytics e Otimizacao',
   'Tome decisoes baseadas em dados com analytics avancado.',
   'Usar analytics para otimizar estrategias de marketing digital',
   3, 'draft');

-- =============================================================
-- Chapters: Course 5 (3 chapters, archived course)
-- =============================================================
INSERT INTO chapters (id, course_id, tenant_id, title, content, learning_objective, "order", status) VALUES
  ('c5c10000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
   'Formulas Avancadas',
   'Domine as formulas que separam iniciantes de experts no Excel.',
   'Dominar formulas avancadas do Excel para analise de dados',
   1, 'published'),
  ('c5c20000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
   'Tabelas Dinamicas e Dashboards',
   'Transforme dados brutos em insights visuais com tabelas dinamicas.',
   'Criar dashboards interativos com tabelas dinamicas',
   2, 'published'),
  ('c5c30000-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
   'Power Query e Integracao',
   'Automatize a importacao e transformacao de dados com Power Query.',
   'Usar Power Query para automatizar processos de dados e integrar com Power BI',
   3, 'published');

-- =============================================================
-- Questions (2 per chapter = 30 total)
-- =============================================================

-- Course 1, Chapter 1
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('11110001-0001-0001-0001-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111',
   'Uma empresa de varejo esta considerando implementar IA. O CEO pergunta: "IA vai substituir meus funcionarios?". Como voce responderia?',
   'analise', 'Avaliar compreensao de IA Estreita vs IA Geral',
   'Distinguir IA Estreita de IA Geral, argumentando que a IA atual complementa o trabalho humano', 'active'),
  ('11110001-0001-0001-0001-000000000002', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111',
   'O relatorio da McKinsey projeta trilhoes em valor economico gerado pela IA. Mas valor gerado e o mesmo que lucro para qualquer empresa?',
   'reflexao', 'Provocar reflexao critica sobre potencial de mercado vs resultado individual',
   'Refletir sobre maturidade digital, qualidade dos dados, cultura organizacional', 'active');

-- Course 1, Chapter 2
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('11110001-0001-0001-0001-000000000003', 'aaaaaaaa-1111-2222-3333-444444444444', '11111111-1111-1111-1111-111111111111',
   'Modelo A: 99% acuracia, 70% recall. Modelo B: 95% acuracia, 98% recall. Para deteccao de fraude, qual escolheria?',
   'aplicacao', 'Testar aplicacao de metricas de ML em cenario real',
   'Escolher modelo B (98% recall), pois em fraude e critico capturar o maximo de casos', 'active'),
  ('11110001-0001-0001-0001-000000000004', 'aaaaaaaa-1111-2222-3333-444444444444', '11111111-1111-1111-1111-111111111111',
   'Um colega sugere aprendizado nao-supervisionado para prever churn. Faz sentido?',
   'sintese', 'Verificar sintese dos tipos de aprendizado',
   'Identificar que churn e problema supervisionado, nao supervisionado', 'active');

-- Course 1, Chapter 3
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('11110001-0001-0001-0001-000000000005', 'bbbbbbbb-1111-2222-3333-444444444444', '11111111-1111-1111-1111-111111111111',
   'Sua empresa quer usar um LLM para automatizar suporte ao cliente, enviando dados pessoais para a API. Quais riscos?',
   'analise', 'Avaliar identificacao de riscos de privacidade',
   'Identificar riscos de LGPD, propor anonimizacao, modelos on-premise, DPA', 'active'),
  ('11110001-0001-0001-0001-000000000006', 'bbbbbbbb-1111-2222-3333-444444444444', '11111111-1111-1111-1111-111111111111',
   'O framework de adocao sugere comecar pequeno. Um executivo defende implementacao completa. Como avaliaria?',
   'reflexao', 'Estimular pensamento critico sobre estrategias de adocao',
   'Ponderar risco vs velocidade, tamanho do piloto proporcional a maturidade digital', 'active');

-- Course 2, Chapter 1
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('22220001-0001-0001-0001-000000000001', 'c2c10000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Um gestor sempre usa o mesmo estilo de lideranca com todos. Quais problemas isso pode causar?',
   'analise', 'Avaliar compreensao de estilos adaptativos',
   'Identificar que diferentes maturidades exigem diferentes estilos', 'active'),
  ('22220001-0001-0001-0001-000000000002', 'c2c10000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Lideranca servidora coloca a equipe em primeiro lugar. Isso significa que o lider nunca deve ser assertivo?',
   'reflexao', 'Provocar reflexao sobre limites de cada estilo',
   'Entender que servir a equipe nao e submissao — inclui tomar decisoes dificeis', 'active');

-- Course 2, Chapter 2
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('22220001-0001-0001-0001-000000000003', 'c2c20000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Dois membros discordam sobre prioridade: qualidade vs velocidade. Como voce mediaria?',
   'aplicacao', 'Testar aplicacao de tecnicas de mediacao',
   'Usar escuta ativa, foco em interesses e buscar acordo win-win', 'active'),
  ('22220001-0001-0001-0001-000000000004', 'c2c20000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'E possivel ter equipe de alta performance sem nenhum conflito? O que a ausencia indica?',
   'reflexao', 'Desafiar a ideia de que conflito e sempre negativo',
   'Reconhecer que ausencia de conflito pode indicar conformidade ou medo', 'active');

-- Course 2, Chapter 3
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('22220001-0001-0001-0001-000000000005', 'c2c30000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Aplique o framework SBI para dar feedback a um colaborador que interrompe colegas em reunioes.',
   'aplicacao', 'Testar aplicacao pratica do framework SBI',
   'Descrever situacao especifica, comportamento observavel e impacto na equipe', 'active'),
  ('22220001-0001-0001-0001-000000000006', 'c2c30000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Um lider so da feedback na avaliacao anual. Quais os problemas dessa abordagem?',
   'sintese', 'Sintetizar importancia do feedback continuo',
   'Feedback anual e tardio demais, sugerir one-on-ones regulares', 'active');

-- Course 2, Chapter 4
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('22220001-0001-0001-0001-000000000007', 'c2c40000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Empresa tem valores na parede mas lideres contradizem. Qual o impacto na cultura?',
   'analise', 'Avaliar compreensao de cultura vs declaracao',
   'Cultura real e definida por comportamentos, nao por declaracoes', 'active'),
  ('22220001-0001-0001-0001-000000000008', 'c2c40000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Dos 4 drivers de engajamento, qual mais importante para geracao Z? Justifique.',
   'reflexao', 'Estimular reflexao sobre motivacao geracional',
   'Argumentar com base nos drivers, reconhecendo que pode variar por individuo', 'active');

-- Course 3, Chapter 1
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('33330001-0001-0001-0001-000000000001', 'c3c10000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Qual recurso da plataforma voce considera mais util? Como pretende organizar seu aprendizado?',
   'reflexao', 'Incentivar planejamento de uso da plataforma',
   'Refletir sobre objetivos pessoais e conectar com recursos', 'active'),
  ('33330001-0001-0001-0001-000000000002', 'c3c10000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Um colega novo pergunta como aproveitar a plataforma. O que voce diria?',
   'sintese', 'Verificar retencao do conteudo de onboarding',
   'Sintetizar os passos: explorar, inscrever, estudar, participar das sessoes', 'active');

-- Course 3, Chapter 2
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('33330001-0001-0001-0001-000000000003', 'c3c20000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Por que o metodo socratico usa perguntas em vez de dar respostas prontas?',
   'reflexao', 'Verificar compreensao da metodologia socratica',
   'Perguntas estimulam pensamento critico e retencao maior', 'active'),
  ('33330001-0001-0001-0001-000000000004', 'c3c20000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Voce ja aprendeu algo significativo a partir de um erro? Como se conecta com o metodo socratico?',
   'aplicacao', 'Conectar experiencia pessoal com a metodologia',
   'Relacionar aprendizado por erro com o ciclo socratico', 'active');

-- Course 4, Chapter 1
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('44440001-0001-0001-0001-000000000001', 'c4c10000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Qual a relacao entre Core Web Vitals e posicionamento nos resultados de busca?',
   'aplicacao', 'Testar aplicacao de SEO tecnico',
   'Conectar metricas de performance com ranking e priorizar por impacto', 'active'),
  ('44440001-0001-0001-0001-000000000002', 'c4c10000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Topic clusters sao mais eficazes que posts isolados para SEO. Por que?',
   'sintese', 'Sintetizar estrategia de conteudo',
   'Explicar autoridade tematica e interligacao de conteudos', 'active');

-- Course 4, Chapter 2
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('44440001-0001-0001-0001-000000000003', 'c4c20000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Empresa gasta R$ 50k/mes em Google Ads com ROAS 2x. Investir mais ou diversificar?',
   'analise', 'Avaliar pensamento analitico sobre investimento',
   'Analisar margem, capacidade de escala, saturacao e potencial do novo canal', 'active'),
  ('44440001-0001-0001-0001-000000000004', 'c4c20000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Lead scoring: quais sinais indicariam que um lead esta pronto para compra?',
   'aplicacao', 'Aplicar conceito de lead scoring',
   'Visitas a pagina de precos, download de material, cargo decisor', 'active');

-- Course 4, Chapter 3
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('44440001-0001-0001-0001-000000000005', 'c4c30000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'CAC alto e LTV baixo: o que indica? Quais acoes tomaria?',
   'analise', 'Testar analise de metricas de negocio',
   'Negocio nao e sustentavel, propor reducao de CAC ou aumento de retencao', 'active'),
  ('44440001-0001-0001-0001-000000000006', 'c4c30000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Empresa mede sucesso apenas por numero de leads. Quais metricas adicionar?',
   'sintese', 'Sintetizar visao completa de analytics',
   'Qualidade do lead, taxa de conversao, CAC, LTV e ROAS', 'active');

-- Course 5, Chapter 1
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('55550001-0001-0001-0001-000000000001', 'c5c10000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'PROCV vs PROCX: em que cenarios o PROCX e superior?',
   'aplicacao', 'Comparar funcoes de busca',
   'PROCX busca em qualquer direcao, aceita multiplos criterios', 'active'),
  ('55550001-0001-0001-0001-000000000002', 'c5c10000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Quando usar INDICE+CORRESP em vez de PROCV?',
   'analise', 'Avaliar compreensao de formulas avancadas',
   'INDICE+CORRESP permite busca a esquerda e e mais performatico', 'active');

-- Course 5, Chapter 2
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('55550001-0001-0001-0001-000000000003', 'c5c20000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Como usaria campos calculados em tabela dinamica para metrica de produtividade?',
   'aplicacao', 'Testar uso pratico de tabelas dinamicas',
   'Descrever formula e configuracao na tabela dinamica', 'active'),
  ('55550001-0001-0001-0001-000000000004', 'c5c20000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Diferenca entre graficos dinamicos e comuns? Quando usar cada um?',
   'sintese', 'Sintetizar vantagens de graficos dinamicos',
   'Dinamicos atualizam com filtros; comuns melhores para apresentacoes estaticas', 'active');

-- Course 5, Chapter 3
INSERT INTO questions (id, chapter_id, tenant_id, text, skill, intention, expected_depth, status) VALUES
  ('55550001-0001-0001-0001-000000000005', 'c5c30000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Dados de vendas de 3 sistemas em formatos distintos. Como usaria Power Query?',
   'aplicacao', 'Testar uso pratico de Power Query',
   'Importacao, transformacao e append das 3 fontes', 'active'),
  ('55550001-0001-0001-0001-000000000006', 'c5c30000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Vantagem de publicar datasets no Power BI vs trabalhar localmente?',
   'reflexao', 'Refletir sobre colaboracao e escalabilidade',
   'Atualizacao automatica, acesso compartilhado, governanca e escalabilidade', 'active');

-- =============================================================
-- Enrollments (10 total)
-- =============================================================

-- student@a.com: Courses 1, 2, 3
INSERT INTO enrollments (id, student_id, course_id, tenant_id, status, progress) VALUES
  ('99999999-9999-9999-9999-999999999999', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'active', '{}'),
  ('e0e00001-0001-0001-0001-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'active', '{}'),
  ('e0e00001-0001-0001-0001-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'active', '{}');

-- student2@a.com: Courses 1, 3, 5
INSERT INTO enrollments (id, student_id, course_id, tenant_id, status, progress) VALUES
  ('e0e00002-0001-0001-0001-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'active', '{}'),
  ('e0e00002-0001-0001-0001-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddd02', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'active', '{}'),
  ('e0e00002-0001-0001-0001-000000000003', 'dddddddd-dddd-dddd-dddd-dddddddddd02', '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'completed', '{}');

-- student3@a.com: Courses 1, 3
INSERT INTO enrollments (id, student_id, course_id, tenant_id, status, progress) VALUES
  ('e0e00003-0001-0001-0001-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd03', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'active', '{}'),
  ('e0e00003-0001-0001-0001-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddd03', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'active', '{}');

-- student4@a.com: Courses 2, 3
INSERT INTO enrollments (id, student_id, course_id, tenant_id, status, progress) VALUES
  ('e0e00004-0001-0001-0001-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd04', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'active', '{}'),
  ('e0e00004-0001-0001-0001-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddd04', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'active', '{}');

-- =============================================================
-- Sessions (2 completed)
-- =============================================================

-- Session 1: student@a.com on Course 1, Chapter 1
INSERT INTO sessions (id, student_id, chapter_id, question_id, tenant_id, status, interactions_remaining, turn_number) VALUES
  ('s0s00001-0001-0001-0001-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '11110001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'completed', 14, 6);

-- Session 1 messages
INSERT INTO messages (id, session_id, tenant_id, role, content, turn_number) VALUES
  ('m0m00001-0001-0001-0001-000000000001', 's0s00001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'system', 'Pergunta: Uma empresa de varejo esta considerando implementar IA. O CEO pergunta: IA vai substituir meus funcionarios?', 0),
  ('m0m00001-0001-0001-0001-000000000002', 's0s00001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'user', 'Acredito que a IA nao vai substituir todos os funcionarios, mas sim automatizar algumas tarefas repetitivas. A IA que temos hoje e estreita, focada em tarefas especificas.', 1),
  ('m0m00001-0001-0001-0001-000000000003', 's0s00001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'assistant', 'Boa observacao sobre a IA Estreita! Pode dar exemplos especificos de quais tarefas no varejo seriam automatizadas e quais exigiriam o toque humano?', 2),
  ('m0m00001-0001-0001-0001-000000000004', 's0s00001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'user', 'No varejo, a IA pode automatizar controle de estoque, atendimento basico via chatbot e analise de vendas. Mas atendimento personalizado e gestao de equipe continuam exigindo pessoas.', 3),
  ('m0m00001-0001-0001-0001-000000000005', 's0s00001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'assistant', 'Excelente analise! E sobre a IA Geral (AGI) — como isso mudaria o cenario?', 4),
  ('m0m00001-0001-0001-0001-000000000006', 's0s00001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'user', 'A AGI e ainda teorica. Por enquanto, a IA e uma ferramenta que complementa o trabalho. A questao para o CEO e: como usar IA para tornar funcionarios mais produtivos.', 5);

-- QA Report for session 1
INSERT INTO qa_reports (id, session_id, message_id, tenant_id, verdict, score, criteria_results) VALUES
  ('qr000001-0001-0001-0001-000000000001', 's0s00001-0001-0001-0001-000000000001', 'm0m00001-0001-0001-0001-000000000006', '11111111-1111-1111-1111-111111111111',
   'approved', 9.2,
   '{"depth": {"score": 9, "comment": "Distinguiu IA Estreita de AGI com clareza"}, "application": {"score": 9.5, "comment": "Exemplos concretos do varejo"}, "critical_thinking": {"score": 9, "comment": "Reposicionou substituicao para complemento"}}');

-- Session 2: student2@a.com on Course 2, Chapter 1
INSERT INTO sessions (id, student_id, chapter_id, question_id, tenant_id, status, interactions_remaining, turn_number) VALUES
  ('s0s00002-0001-0001-0001-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'c2c10000-0000-0000-0000-000000000001', '22220001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'completed', 14, 6);

-- Session 2 messages
INSERT INTO messages (id, session_id, tenant_id, role, content, turn_number) VALUES
  ('m0m00002-0001-0001-0001-000000000001', 's0s00002-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'system', 'Pergunta: Um gestor sempre usa o mesmo estilo de lideranca com todos. Quais problemas isso pode causar?', 0),
  ('m0m00002-0001-0001-0001-000000000002', 's0s00002-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'user', 'Se o gestor usa sempre o mesmo estilo, alguns funcionarios podem se sentir microgerenciados enquanto outros se sentiriam abandonados.', 1),
  ('m0m00002-0001-0001-0001-000000000003', 's0s00002-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'assistant', 'Boa percepcao! Pode elaborar como a lideranca situacional resolveria isso na pratica?', 2),
  ('m0m00002-0001-0001-0001-000000000004', 's0s00002-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'user', 'A lideranca situacional diz que o lider deve adaptar seu estilo. Com junior, mais diretivo. Com senior, mais delegacao e autonomia.', 3),
  ('m0m00002-0001-0001-0001-000000000005', 's0s00002-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'assistant', 'E se um senior enfrenta um desafio novo em area que nao domina? Delegacao ou mais diretivo?', 4),
  ('m0m00002-0001-0001-0001-000000000006', 's0s00002-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'user', 'Mesmo sendo senior, ele e junior nessa tarefa especifica. O lider deveria voltar a ser mais diretivo para essa tarefa, mantendo delegacao nas areas de dominio.', 5);

-- QA Report for session 2
INSERT INTO qa_reports (id, session_id, message_id, tenant_id, verdict, score, criteria_results) VALUES
  ('qr000002-0001-0001-0001-000000000001', 's0s00002-0001-0001-0001-000000000001', 'm0m00002-0001-0001-0001-000000000006', '11111111-1111-1111-1111-111111111111',
   'approved', 7.8,
   '{"depth": {"score": 7.5, "comment": "Poderia aprofundar nos 4 estilos de Hersey-Blanchard"}, "application": {"score": 8, "comment": "Bom uso de exemplos junior vs senior"}, "critical_thinking": {"score": 8, "comment": "Excelente insight sobre maturidade relativa a tarefa"}}');

-- =============================================================
-- Assessment History (3 records)
-- =============================================================
INSERT INTO assessment_history (id, user_id, tenant_id, assessment_type, result) VALUES
  ('ah000001-0001-0001-0001-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
   'big_five',
   '{"openness": 78, "conscientiousness": 85, "extraversion": 62, "agreeableness": 71, "neuroticism": 35, "summary": "Perfil altamente consciencioso com boa abertura a experiencias."}'),
  ('ah000002-0001-0001-0001-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd02', '11111111-1111-1111-1111-111111111111',
   'big_five',
   '{"openness": 88, "conscientiousness": 72, "extraversion": 81, "agreeableness": 76, "neuroticism": 42, "summary": "Perfil criativo e extrovertido com boa conscienciosidade."}'),
  ('ah000003-0001-0001-0001-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd02', '11111111-1111-1111-1111-111111111111',
   'disc',
   '{"dominance": 45, "influence": 82, "steadiness": 68, "conscientiousness": 55, "primary_style": "I", "summary": "Perfil predominantemente Influente."}');
