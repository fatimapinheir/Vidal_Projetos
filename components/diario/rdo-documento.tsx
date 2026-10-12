import Image from "next/image";
import { formatDateBR } from "@/lib/format-date";
import { rotuloCondicao } from "@/lib/diario/condicao";
import type { DadosRdo } from "@/lib/diario/carregar-rdo";
import { BotaoImprimir } from "./botao-imprimir";
import "./rdo.css";

/** Quebra um texto de campo livre em itens, um por linha não vazia. */
function emItens(texto: string | null | undefined) {
  return (texto ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean);
}

/**
 * A folha do Relatório Diário de Obra.
 *
 * A MESMA peça serve o engenheiro e o cliente. Era só do engenheiro; o cliente
 * via um resumo em cartões, com os mesmos dados arrumados de outro jeito. Duas
 * apresentações do mesmo documento é um convite a divergirem — e, pior, a do
 * cliente não tinha assinatura, que é justamente o que faz um RDO valer como
 * documento. Agora quem abre o dia, de qualquer lado, vê a folha que vai para
 * o papel.
 *
 * O que muda entre os dois é só o que a página passa aqui: nada é escondido
 * por papel dentro deste componente.
 */
export function RdoDocumento({ dados }: { dados: DadosRdo }) {
  const atividades = emItens(dados.atividades);
  const ocorrencias = emItens(dados.ocorrencias);

  return (
    <div className="rdo-wrapper">
      <BotaoImprimir />

      <article className="rdo">
        <header className="rdo-cabecalho">
          <div>
            <p className="rdo-marca">ANKORA</p>
            <p className="rdo-titulo">RELATÓRIO DIÁRIO DE OBRA</p>
          </div>
          <div className="rdo-data-selo">
            <span>DATA</span>
            <strong>{formatDateBR(dados.data)}</strong>
          </div>
        </header>

        <section className="rdo-secao">
          <h2>
            <span>1</span> IDENTIFICAÇÃO DA OBRA
          </h2>
          <div className="rdo-grade">
            <p>
              <span>OBRA:</span> {dados.obraNome}
            </p>
            <p>
              <span>DATA:</span> {formatDateBR(dados.data)}
            </p>
            <p>
              <span>CONTRATANTE:</span> {dados.contratante}
            </p>
            <p>
              <span>RESPONSÁVEL TÉCNICO:</span> {dados.responsavel.nome}
            </p>
            <p>
              <span>LOCAL:</span> {dados.local}
            </p>
            <p>
              <span>CREA:</span> {dados.responsavel.crea ?? "—"}
            </p>
          </div>
        </section>

        <section className="rdo-secao">
          <h2>
            <span>2</span> CONDIÇÕES CLIMÁTICAS
          </h2>
          <div className="rdo-clima">
            <div>
              <span>TEMPERATURA</span>
              <strong>{dados.temperatura != null ? `${dados.temperatura}°C` : "—"}</strong>
            </div>
            <div>
              <span>UMIDADE</span>
              <strong>{dados.umidade != null ? `${dados.umidade}%` : "—"}</strong>
            </div>
            <div>
              <span>CONDIÇÃO</span>
              <strong>{rotuloCondicao(dados.condicaoDia).toUpperCase()}</strong>
            </div>
          </div>
        </section>

        <section className="rdo-secao">
          <h2>
            <span>3</span> EFETIVO
          </h2>
          <table className="rdo-tabela">
            <thead>
              <tr>
                <th>FUNÇÃO</th>
                <th className="num">QUANTIDADE</th>
              </tr>
            </thead>
            <tbody>
              {dados.efetivo.map((e) => (
                <tr key={e.funcao}>
                  <td>{e.funcao}</td>
                  <td className="num">{e.total}</td>
                </tr>
              ))}
              {!dados.efetivo.length && (
                <tr>
                  <td colSpan={2} className="vazio">
                    Nenhum efetivo registrado neste dia.
                  </td>
                </tr>
              )}
            </tbody>
            {!!dados.efetivo.length && (
              <tfoot>
                <tr>
                  <td>TOTAL</td>
                  <td className="num">{dados.totalEfetivo}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </section>

        <div className="rdo-duas-colunas">
          <section className="rdo-secao">
            <h2>
              <span>4</span> ATIVIDADES EXECUTADAS
            </h2>
            <ul className="rdo-lista">
              {atividades.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
              {!atividades.length && <li className="vazio">Nada registrado.</li>}
            </ul>
          </section>

          <section className="rdo-secao">
            <h2>
              <span>5</span> OCORRÊNCIAS / OBSERVAÇÕES
            </h2>
            <ul className="rdo-lista">
              {ocorrencias.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
              {!ocorrencias.length && <li className="vazio">Nada registrado.</li>}
            </ul>
          </section>
        </div>

        <section className="rdo-secao">
          <h2>
            <span>6</span> REGISTRO FOTOGRÁFICO
          </h2>
          {dados.fotos.length ? (
            <div className="rdo-fotos">
              {dados.fotos.map((f, i) =>
                f.url ? (
                  <figure key={i}>
                    <Image
                      src={f.url}
                      alt={f.legenda ?? `Foto ${i + 1}`}
                      width={320}
                      height={220}
                      unoptimized
                    />
                    <figcaption>{f.legenda ?? ""}</figcaption>
                  </figure>
                ) : null
              )}
            </div>
          ) : (
            <p className="vazio">Nenhuma foto neste dia.</p>
          )}
        </section>

        <section className="rdo-secao">
          <h2>
            <span>7</span> ASSINATURA
          </h2>
          <div className="rdo-assinatura">
            {dados.assinaturaUrl ? (
              <Image
                src={dados.assinaturaUrl}
                alt=""
                width={200}
                height={64}
                unoptimized
                className="rdo-rubrica"
              />
            ) : (
              <div className="rdo-rubrica-vazia" />
            )}
            <div className="rdo-linha-assinatura">
              <strong>{dados.responsavel.nome}</strong>
              {dados.responsavel.crea && <span>CREA {dados.responsavel.crea}</span>}
              <span>RESPONSÁVEL TÉCNICO</span>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
