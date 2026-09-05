# Curso demo "Jornada" para reunião ao vivo — 2026-07-28

Criado sob pedido urgente do Hugo (reunião imediata). Registro para permitir remoção limpa depois.
Tenant usado: **exímIA Academy** (`8d45bcf4-ed2f-408d-a1af-0ee1fc6a3bea`). Tenant Cory Alimentos
(`a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32`) **NÃO foi tocado** (nenhum insert/update/delete lá).

## Objetos criados

| Objeto | Id | Detalhe |
|---|---|---|
| Curso | `e435ef0c-858e-44fb-9af9-6393ad0a7eb4` | "Trilha Demo: Fundamentos de Onboarding", status=published, deadline_days=70, manager_deadline_days=56 |
| Capítulos (10) | ver lista abaixo | order 0-9, status=published |
| Usuário demo (auth + profile) | `dc16ef6c-8672-42b2-bb20-fe7f2664c30b` | `demo.jornada@eximiaventures.com.br`, role=student, tenant=exímIA Academy |
| Matrícula do usuário demo | `2d700055-c5d1-4140-9c07-9cbe8592012d` | status=active, created_at=2026-07-28 (âncora da jornada) |
| Matrícula da conta do Hugo (`hugo.capitelli@eximiaventures.com.br`, super_admin) | `908ea421-fac6-40e2-bc51-b6d942c3ec72` | status=active — criada conforme pedido literal, ver ressalva abaixo |

### Capítulos (order, título, id)
0. Boas-vindas e visão geral do programa — `0682acd1-c8b7-4425-81e8-3332e938179c`
1. Cultura e valores da empresa — `45d3fdd2-6680-405c-a92c-26322295dd5d`
2. Ferramentas e fluxos de trabalho essenciais — `3cf32d0d-b051-4557-86c5-30d0a9c0cb18`
3. Comunicação eficaz em equipe — `2aea8528-fe91-47e4-8e0d-9be842b8b8fe`
4. Gestão do tempo e produtividade — `764b0e73-3bc0-4b36-beed-de6ba83d7f0e`
5. Fundamentos de atendimento ao cliente — `11d2c406-b778-4d3d-a48c-80b2f4860d40`
6. Segurança da informação no dia a dia — `a1e9e6ae-6aa6-4aff-94ed-35e6ce7e9765`
7. Processos e políticas internas — `5b4b6625-1116-4fc3-82fc-c89619471006`
8. Liderança e trabalho em equipe — `df9b0fc6-ff21-4301-8f21-271ee6efb4a8`
9. Avaliação final e certificação — `6e93c8c3-16d2-46e6-9e89-6e3d2c935625`

## Achado crítico: conta super_admin do Hugo NÃO consegue demonstrar "Começar minha jornada"

`hugo.capitelli@eximiaventures.com.br` tem `role=super_admin` e `tenant_id=NULL` (constraint
`users_super_admin_tenant_check` força esse par — não dá para dar tenant_id a um super_admin sem
tirar o role). O bloqueio real **não é RLS** (a policy `sp_super_admin` já libera esse usuário via
`is_super_admin()`, e a migration `20260729000000` que tira o predicado `role='student'` de
`sp_student_insert` **já está aplicada em produção**, confirmado lendo `pg_policies` ao vivo — não
precisou de GO nem de reaplicação). O bloqueio é de **código de página**:
`apps/web/src/app/(platform)/jornada/page.tsx:63-64` faz
`if (!tenantId) return redirect("/dashboard")` antes de qualquer outra coisa. Um super_admin
puro nunca chega em `/jornada`, é redirecionado para `/dashboard` na hora.

Por isso criei uma **conta demo dedicada** (`demo.jornada@eximiaventures.com.br`) em vez de mexer
no `role`/`tenant_id` da conta super_admin do Hugo (mudança de privilégio real, fora do escopo
autorizado sem confirmação explícita). Matriculei a conta do Hugo também, conforme pedido literal,
mas ela seguirá indo para `/dashboard` se ele tentar `/jornada` logado nela — comportamento
esperado do app para super_admin, não um bug novo.

## Verificação de ponta a ponta

Provado com transação `BEGIN ... ROLLBACK` (nada persistido) simulando `auth.uid()` do usuário demo
via `request.jwt.claims`: o INSERT em `study_plans` (o mesmo que `saveJourneyPlan`/"Começar minha
jornada" executa) **passou** nas policies reais de produção. Curso e capítulos confirmados no banco
via SELECT. Dev server confirmado de pé (ver relatório principal — porta correta é **3000**, não
3002).

## Como remover depois

```sql
DELETE FROM enrollments WHERE id IN ('2d700055-c5d1-4140-9c07-9cbe8592012d', '908ea421-fac6-40e2-bc51-b6d942c3ec72');
DELETE FROM chapters WHERE course_id = 'e435ef0c-858e-44fb-9af9-6393ad0a7eb4';
DELETE FROM courses WHERE id = 'e435ef0c-858e-44fb-9af9-6393ad0a7eb4';
DELETE FROM users WHERE id = 'dc16ef6c-8672-42b2-bb20-fe7f2664c30b';
-- + supabase.auth.admin.deleteUser('dc16ef6c-8672-42b2-bb20-fe7f2664c30b') via Admin API
```
