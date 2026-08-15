// ---------------------------------------------------------------------------
// STUB — aba "Visão geral" do Analytics do gestor.
//
// PROPÓSITO DESTE ARQUIVO: provar que o trilho de verificação funciona ponta a
// ponta (rota sem login → render determinístico → screenshot 1672×941). Ele NÃO
// é a tela final e NÃO tenta acertar o design.
//
// O que existe aqui de propósito:
//   • o cabeçalho (título, subtítulo, chips, carimbo de atualização);
//   • a trinca NOVA de abas (Visão geral / Padrões e tendências / Mapa da jornada);
//   • os 6 blocos como CAIXAS VAZIAS ROTULADAS, na grade 2 colunas × 3 linhas
//     com a inversão de lado na linha 3.
//
// O que NÃO existe aqui de propósito: tipografia, cor, sombra, raio, ícone,
// tabela, tile, pílula. Tudo isso é trabalho do agente construtor no loop, medido
// contra CRITERIOS.md. Fingir acabamento aqui só criaria falso verde.
//
// Referência visual: docs/sop/runs/_referencias/academy-analytics-gestor/01-visao-geral.png
// ---------------------------------------------------------------------------

import type { VisaoGeralFixture } from "./fixture"

function Caixa({
  rotulo,
  nota,
  className,
}: {
  rotulo: string
  nota: string
  className?: string
}) {
  return (
    <section
      className={`flex flex-col justify-between rounded-xl border border-dashed border-neutral-300 bg-white p-4 ${className ?? ""}`}
    >
      <h2 className="text-sm font-bold text-neutral-900">{rotulo}</h2>
      <p className="text-xs text-neutral-500">{nota}</p>
    </section>
  )
}

export function VisaoGeralTab({ data }: { data: VisaoGeralFixture }) {
  const {
    sidebar,
    cabecalho,
    chipsFiltro,
    abas,
    placar,
    mudancas,
    atencao,
    recomendacoes,
    resposta,
    sinais,
  } = data

  return (
    <div className="flex min-h-[941px] w-[1672px] bg-[#F8F5F4] text-neutral-900">
      {/* Sidebar — caixa rotulada, sem acabamento. */}
      <aside className="flex w-[201px] shrink-0 flex-col justify-between border-r border-neutral-200 bg-white p-4">
        <div>
          <p className="text-sm font-bold">{sidebar.marca.wordmark}</p>
          <p className="text-[10px] tracking-widest text-neutral-500">{sidebar.marca.subtitulo}</p>
          <ul className="mt-6 space-y-2">
            {sidebar.itens.map((item) => (
              <li
                key={item.id}
                className={
                  item.ativo ? "text-xs font-semibold text-orange-600" : "text-xs text-neutral-600"
                }
              >
                {item.rotulo}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs">
          <p className="font-semibold">{sidebar.usuario.nome}</p>
          <p className="text-neutral-500">{sidebar.usuario.papel}</p>
        </div>
      </aside>

      {/* Página */}
      <main className="flex-1 px-[31px] py-6">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{cabecalho.titulo}</h1>
            <p className="text-sm text-neutral-600">{cabecalho.subtitulo}</p>
          </div>
          <span className="text-xs text-neutral-500">{cabecalho.atualizadoLabel}</span>
        </header>

        <div className="mt-4 flex gap-3">
          {chipsFiltro.map((chip) => (
            <span key={chip.id} className="rounded-lg bg-white px-3 py-2 text-xs text-neutral-700">
              {chip.rotulo}
            </span>
          ))}
        </div>

        <nav className="mt-4 flex gap-6 text-sm">
          {abas.map((aba) => (
            <span
              key={aba.id}
              className={
                aba.ativa
                  ? "border-b-[3px] border-orange-500 pb-1 font-semibold text-orange-600"
                  : "pb-1 text-neutral-500"
              }
            >
              {aba.rotulo}
            </span>
          ))}
        </nav>

        {/* Grade: 2 colunas × 3 linhas. Linha 3 INVERTE o lado do bloco largo. */}
        <div className="mt-4 flex flex-col gap-[14px]">
          <div className="flex h-[200px] gap-[14px]">
            <Caixa className="basis-[66.4%]" rotulo={placar.titulo} nota="5 tiles · stub" />
            <Caixa className="basis-[33.6%]" rotulo={mudancas.titulo} nota="3 itens · stub" />
          </div>
          <div className="flex h-[357px] gap-[14px]">
            <Caixa
              className="basis-[66.4%]"
              rotulo={atencao.titulo}
              nota="4 pílulas + 4 linhas · stub"
            />
            <Caixa
              className="basis-[33.6%]"
              rotulo={recomendacoes.titulo}
              nota="3 recomendações · stub"
            />
          </div>
          <div className="flex h-[169px] gap-[13px]">
            <Caixa
              className="basis-[48.3%]"
              rotulo={resposta.titulo}
              nota="3 estatísticas · stub"
            />
            <Caixa className="basis-[51.7%]" rotulo={sinais.titulo} nota="3 sinais · stub" />
          </div>
        </div>
      </main>
    </div>
  )
}
