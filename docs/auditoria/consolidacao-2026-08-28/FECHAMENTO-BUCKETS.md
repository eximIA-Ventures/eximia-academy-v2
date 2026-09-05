# FECHAMENTO DE BUCKETS — `materials` fechado, `books` PARADO por divergência

> Executado em 2026-08-31 no projeto de produção `vaguswivhqnlbgqvnjch`, sob autorização
> explícita do Senhor. **Única escrita realizada:** `materials.public = true → false`.
> Nenhum objeto removido. `chapter-assets` não foi tocado. Nenhum DDL em tabela de aplicação.

## Veredito em uma linha

**`materials` está fechado e a prova é o mesmo teste que provou a exposição: `206` antes,
`400` depois, sem sessão nenhuma.** **`books` NÃO foi fechado**: o levantamento dizia "vazio",
e ele tem um PDF real de 2,38 MB sendo servido publicamente agora. Isso dispara literalmente a
cláusula de parada da tarefa, então parei e reporto.

---

## 1. A divergência que interrompeu metade da tarefa

O Adendo 3 registrou `books` como **"0 objetos (só uma pasta vazia, `11111111-…`)"**. É falso.

```
bucket_id       | name                                                                       | bytes
books           | 11111111-1111-1111-1111-111111111111/books/31f2c56a-…-4780d99e8f81/book.pdf | 2.384.216
```

O erro tem causa identificável: `listBuckets`/`list()` na raiz devolve apenas o **prefixo** da
pasta, e quem mediu não desceu um nível. O Adendo 1, na tabela de tamanhos, já dizia
`books | 1` objeto. **Os dois adendos se contradiziam, e o brief herdou a versão errada.**

O objeto casa exatamente com o padrão de `uploadBookPdf`
(`${tenantId}/books/${bookId}/book.pdf`), logo **foi produzido pela aplicação**: é o PDF de um
livro cuja linha em `books` foi apagada depois. Órfão, não placeholder.

### Por que a divergência não muda o veredito de risco, e ainda assim eu parei

Medi o custo real de fechar `books`, para que a decisão do Senhor custe uma linha e não uma
nova investigação:

| Pergunta | Medida |
|---|---|
| Linhas na tabela `books` | **0** |
| URLs persistidas apontando para `books/` | **0** (censo em 17 colunas, com controle positivo) |
| Código que **lê** o bucket `books` no storage | **nenhum** |
| Código que **escreve** no bucket | 1 rota, `api/admin/books/[bookId]/upload-pdf/route.ts`, via **service-role** |
| `service_role` é afetado por `public=false`? | **Não**, ignora RLS e visibilidade |
| `lib/utils/book-upload.ts` (as 2 chamadas a `getPublicUrl`) | **código morto**, zero chamadores |

A rota viva faz upload e em seguida **extrai o texto do PDF para capítulos**. Ela nunca chama
`getPublicUrl` e nunca grava `books.file_url`. **Não há leitor do bucket na aplicação.**

**Conclusão da medição:** fechar `books` não quebraria nada, nem hoje nem no próximo upload.
A exposição, porém, é maior do que o brief supunha (2,38 MB de livro servidos à internet, não
uma pasta vazia). **Mesmo assim não executei**, porque "`books` com objetos" é palavra por
palavra a condição de parada que recebi. Basta o Senhor dizer "fecha `books`" e é um comando.

---

## 2. `materials`: premissa confirmada no momento da mudança, não horas antes

| Verificação | Medida no instante da aplicação |
|---|---|
| Linhas na tabela `public.materials` | **0** |
| Objetos no bucket | **2**, os mesmos dois nomes do levantamento |
| URLs persistidas apontando para `materials/` | **0** |

O censo de URLs varreu **17 colunas de texto** com `url`/`path` no nome, em todo o schema
`public`. Um total zero é suspeito por natureza, então rodei o **controle positivo**: o mesmo
`LIKE`, apontado para `chapter-assets`, devolveu **746** (698 + 24 + 24), batendo exatamente
com o Adendo 3. Logo o zero é verdade medida, não consulta vazia.

---

## 3. Mecanismo escolhido: API de Storage, não SQL em `storage.buckets`

Usei `PUT https://vaguswivhqnlbgqvnjch.supabase.co/storage/v1/bucket/materials` com corpo
`{"public": false}`, autenticado por `service_role`. **Não** usei `UPDATE storage.buckets`.

A razão é o modo de falha específico desta operação: o `storage-api` mantém cache próprio dos
metadados de bucket. Um `UPDATE` por SQL grava a linha, mas o serviço pode continuar servindo
o objeto pela rota pública a partir do cache. O resultado seria a pior forma de fechamento
possível: **a listagem mostraria `public=false` enquanto o arquivo seguiria sendo entregue**.
Ou seja, um flag trocado que passa por trabalho feito. Passando pelo próprio serviço, a
invalidação é dele e a propagação é imediata, o que a sonda do §4 confirma empiricamente.

```
{"message":"Successfully updated"}   http_code=200
```

---

## 4. A prova: antes e depois, com os dois controles

Sonda idêntica à que provou a exposição no Adendo 1: `curl` **sem cookie, sem `apikey`, sem
`Authorization`**, `Range: bytes=0-0` (1 byte, para não baixar os arquivos).

### Rota pública `/storage/v1/object/public/…`

| Alvo | ANTES | DEPOIS |
|---|---|---|
| `materials/treinamento-asp-rev0.pdf` | **206** `application/pdf` | **400** `application/json` |
| `materials/treinamento-asp-rev0-2.pdf` | **206** `application/pdf` | **400** `application/json` |
| `chapter-assets/…8043c8b7….jpg` (controle positivo, não tocado) | **206** `image/jpeg` | **206** `image/jpeg` |
| `books/…/book.pdf` (não tocado) | **206** `application/pdf` | **206** `application/pdf` |
| `materials/nao-existe-xyz.pdf` (controle negativo) | **400** | — |

O **controle positivo é o que impede o `400` de ser vácuo**: se a sonda tivesse quebrado, ou se
o serviço tivesse caído, `chapter-assets` também teria falhado. Ele seguiu servindo `206`.
Logo o `400` de `materials` é negação, não instrumento quebrado.

### A porta lateral: rota autenticada com a chave anônima

Fechar o bucket não basta se a rota `/storage/v1/object/…` (sem `/public/`) continuar servindo
com a chave anônima, que é pública no frontend por construção. Testei:

| Credencial na rota autenticada | Resultado |
|---|---|
| chave **anon** | **400** |
| nenhuma | **400** |
| **service_role** (controle) | **206** `application/pdf` |

O `206` do `service_role` prova que o objeto continua lá e que a URL está correta, portanto os
dois `400` são recusa de acesso e não caminho inválido. **A porta lateral está fechada.**

---

## 5. `chapter-assets`: inalterado, conferido dos dois lados

| | ANTES | DEPOIS |
|---|---|---|
| flag `public` | `true` | `true` |
| `updated_at` do bucket | `2026-02-10T02:17:22.573Z` | `2026-02-10T02:17:22.573Z` (idêntico) |
| objetos em `storage.objects` | **612** | **612** |
| objeto de controle servido sem sessão | `206` | `206` |

Continua público e continua funcionando, exatamente como determinado. As 746 URLs persistidas
seguem válidas.

## 6. Nenhum objeto removido

| bucket | objetos ANTES | objetos DEPOIS |
|---|---:|---:|
| `books` | 1 | 1 |
| `chapter-assets` | 612 | 612 |
| `materials` | 2 | 2 |

Os 2 PDFs da Argos Consultoria permanecem no bucket, agora inacessíveis sem credencial.
Tabelas `materials` e `books` seguem com **0 linhas** depois da mudança.

---

## 7. O que fica em aberto, e que eu não tinha autorização para tocar

### 7.1 Quebra latente no próximo upload de material (conhecida e aceita no Adendo 3)

`apps/web/src/lib/utils/material-upload.ts:25` chama `getPublicUrl` e
`components/materiais/materiais-page-client.tsx:116` grava esse endereço em `materials.file_url`,
lido de volta em `href={m.file_url}` (linha 211). **Com o bucket privado, o upload continua
funcionando e a URL gravada passa a devolver `400`.** Hoje isso não quebra tela alguma, porque
a tabela tem 0 linhas, mas quebra **no primeiro upload real**. A correção é trocar por
`createSignedUrl` nesses 2 sítios. O Adendo 3 já previa isto ("ajustar os 2 sítios antes do
primeiro upload real"), por isso prossegui em vez de parar, mas registro alto: **é uma dívida
com prazo, e o prazo é o próximo upload.**

### 7.2 CORREÇÃO DESTE RELATÓRIO — a política larga não é desenho, é uma correção que consta aplicada e não está em vigor

> Escrito primeiro como "a política é larga". Está errado como enquadramento, e o erro muda a
> conclusão do leitor. Refeito depois de reconstruir o estado final por todas as migrations que
> tocam o objeto, em vez de parar na primeira.

**Estado vivo (fato, `pg_policies`, sem truncar):**

```
materials_storage_read   SELECT  {authenticated}   (bucket_id = 'materials'::text)
books_storage_read       SELECT  {authenticated}   (bucket_id = 'books'::text)
```

**O que a migration vigente manda (hipótese, `20260530120000_security_hardening_rls.sql:241`):**

```sql
DROP POLICY IF EXISTS "materials_storage_read" ON storage.objects;
CREATE POLICY "materials_storage_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'materials'
         AND (storage.foldername(name))[1] = auth_tenant_id()::text);
```

**O recorte por tenant foi escrito, consta como aplicado, e não está em vigor.**

Cada uma dessas políticas é definida por **duas** migrations (`20260211200000` e `20260530120000`).
Quem lesse só a primeira concluiria "larga por desenho". Quem lesse só a última concluiria
"recortada por tenant". **As duas leituras erram**, e em direções opostas. O catálogo decide.

**A prova de que o bloco de storage não pegou, com controle:**

| Medida | Resultado |
|---|---:|
| Políticas vivas com a assinatura do hardening (`foldername` **e** `auth_tenant_id`) | **0** |
| **Controle:** políticas vivas que usam `auth_tenant_id()` de qualquer forma | **175** |

O 175 é o que impede o 0 de ser vácuo: o `LIKE` funciona e a função existe. O zero é real.

**E a migration não é a que não rodou.** Ela consta em `supabase_migrations.schema_migrations`, e
`utm_super_admin_manage` (linha 206, **exclusiva** dela, ausente de qualquer outra migration em
qualquer grafia) existe no servidor com o corpo idêntico ao do arquivo, `is_super_admin()`. Logo
a migration **rodou**, e o bloco de storage dela (linhas 238 a 320) **não pegou**.

Das 23 políticas que ela cria, **7 não existem no servidor**, e elas estão **espalhadas** pelo
arquivo (linhas 48, 61, 74, 123, 188, 258, 299), não num sufixo. Aborto de transação deixaria um
prefixo limpo; espalhamento não. Das 16 presentes, 15 também são definidas por migrations
anteriores, ou seja, **presença por nome não prova que esta migration as criou** (`materials_storage_read`
é o caso exemplar: existe pelo nome, com o corpo antigo).

**Por que isso não se resolve daqui:** provar *por que* os 7 falharam exige o log de execução, que
não está no repositório. Registro o que é fato (o estado) e o que é hipótese (a causa), sem
misturar.

**Consequência de segurança, que é o que importa:** fechar o bucket tirou **a internet inteira** do
alcance, e essa parte está feita e provada. Mas qualquer usuário autenticado, **de qualquer
tenant**, continua lendo qualquer objeto de `materials` e de `books` pela rota autenticada, desde
2026-05-30, numa correção que todo mundo tem motivo para acreditar que está no ar. Mesma família
do achado dos 31 usuários sobre `chapter_slides`. **Não alterei política nenhuma.**

### 7.4 A mudança que apliquei não existe em migration alguma

`materials.public = false` foi feito pela API de Storage. `20260211200000_materials.sql:40` continua
dizendo `values ('materials','materials', true)`. Quem ler a migration conclui que o bucket é
público. **O servidor e o git divergem por causa desta tarefa, deliberadamente e sob autorização,
e fica registrado aqui para não ser "corrigido" de volta.**

O risco de reversão está contido, e a razão é a forma do `INSERT`: `on conflict (id) do nothing`
(mesma forma em `20260214000000_biblioteca_books.sql:90`). Re-executar a migration **não** reabre o
bucket. Mas um ambiente novo, criado do zero pelas migrations, nasceria com `materials` **público**.

Correção de rota, e ela desmente o Adendo 1: aquele texto afirma que "só `chapter-assets` nasce de
`INSERT INTO storage.buckets` numa migration; os outros dois foram criados fora do versionamento".
**Os três nascem de migration.** `materials` em `20260211200000_materials.sql:39`, `books` em
`20260214000000_biblioteca_books.sql:88`. O `updated_at` dos três buckets no catálogo
(`2026-02-10`, `2026-02-11`, `2026-02-14`) bate com a data das três migrations, o que corrobora.
O erro veio de olhar **uma** migration, exatamente como o caso do `users_role_check`.

### 7.3 O bucket `tenant-assets` continua não existindo

O Adendo 3 já havia registrado. Confirmo pela listagem do serviço: só existem
`chapter-assets`, `materials`, `books`. `components/admin/logo-upload.tsx:61` e
`components/onboarding/step-welcome.tsx:59` gravam num bucket inexistente.

---

## 8. Comandos de evidência

```bash
PAT=$(security find-generic-password -s "Supabase CLI" -a supabase -w)   # remover prefixo go-keyring-base64: e decodificar
SRV=<service_role, via GET /v1/projects/vaguswivhqnlbgqvnjch/api-keys?reveal=true>

# flag dos buckets, pela via autoritativa (o proprio servico)
curl -s -H "Authorization: Bearer $SRV" -H "apikey: $SRV" \
  https://vaguswivhqnlbgqvnjch.supabase.co/storage/v1/bucket

# a mudanca aplicada
curl -s -X PUT https://vaguswivhqnlbgqvnjch.supabase.co/storage/v1/bucket/materials \
  -H "Authorization: Bearer $SRV" -H "apikey: $SRV" -H "Content-Type: application/json" \
  -d '{"public": false}'

# a prova, sem sessao nenhuma
B=https://vaguswivhqnlbgqvnjch.supabase.co/storage/v1/object/public
curl -s -o /dev/null -w '%{http_code}\n' -H 'Range: bytes=0-0' $B/materials/treinamento-asp-rev0.pdf
curl -s -o /dev/null -w '%{http_code}\n' -H 'Range: bytes=0-0' $B/materials/nao-existe-xyz.pdf   # controle negativo

# contagem de objetos e das duas tabelas (Management API, database/query)
select bucket_id, count(*) from storage.objects group by 1 order by 1;
select (select count(*) from public.materials) as materials, (select count(*) from public.books) as books;
```

A leitura ao banco foi feita pela Management API (`database/query`), somente `SELECT`. Nenhum
arquivo de produção foi alterado por esta tarefa. Nenhum commit, push, PR ou deploy.
