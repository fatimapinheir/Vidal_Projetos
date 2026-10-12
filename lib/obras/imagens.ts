/**
 * As duas imagens da obra: dimensões recomendadas e regras de recorte.
 *
 * Mora em arquivo próprio porque três lugares precisam concordar sobre o
 * mesmo número — o texto de orientação no cadastro, a caixa de
 * pré-visualização do upload e a caixa onde a imagem aparece no portal. Com a
 * razão de aspecto escrita em cada um deles, bastava alguém ajustar a faixa de
 * saudação para a pré-visualização do engenheiro passar a mentir sobre o
 * recorte.
 *
 * NENHUMA dimensão quebra a tela: tudo é `object-cover` dentro de caixa de
 * proporção fixa, então qualquer arquivo entra. O que as medidas abaixo
 * evitam é o outro problema — foto esticada perdendo nitidez, ou assunto
 * cortado fora do quadro.
 */
export type CampoImagemObra = "capa" | "rdo";

export type EspecImagem = {
  campo: CampoImagemObra;
  coluna: "imagem_capa_path" | "imagem_rdo_path";
  rotulo: string;
  /**
   * Onde ela aparece, em uma linha — é isso que explica o recorte.
   *
   * Já vem com a preposição: "na faixa", "no cabeçalho". Montar a frase com
   * um `na` fixo no componente dava "na cabeçalho".
   */
  onde: string;
  larguraIdeal: number;
  alturaIdeal: number;
  /**
   * Largura ÷ altura da caixa onde a foto aparece no portal, no desktop.
   *
   * Quase sempre mais larga que a foto enviada — por isso a
   * pré-visualização marca a faixa que sobrevive ao recorte em vez de só
   * mostrar o arquivo inteiro.
   */
  razaoVisivel: number;
  /** Como a foto é recortada, para o engenheiro saber onde pôr o assunto. */
  enquadramento: string;
};

export const IMAGENS_OBRA: Record<CampoImagemObra, EspecImagem> = {
  capa: {
    campo: "capa",
    coluna: "imagem_capa_path",
    rotulo: "Capa da obra",
    onde: "na faixa de saudação do portal e na miniatura ao lado do nome da obra",
    larguraIdeal: 1920,
    alturaIdeal: 640,
    razaoVisivel: 5,
    enquadramento:
      "O texto da saudação cobre a metade esquerda: deixe a fachada no centro ou à direita.",
  },
  rdo: {
    campo: "rdo",
    coluna: "imagem_rdo_path",
    rotulo: "Foto do RDO",
    onde: "no cabeçalho do cartão de diário de obra do portal",
    larguraIdeal: 1600,
    alturaIdeal: 600,
    razaoVisivel: 7,
    enquadramento:
      "O título 'RDO' cobre a esquerda: uma foto de obra em andamento, com o assunto à direita, funciona melhor.",
  },
};

/**
 * Que fração da altura do arquivo enviado aparece de fato no portal.
 *
 * A caixa no portal é mais larga que a foto, e `object-cover` resolve isso
 * cortando em cima e embaixo, pelo centro. Esta conta é o que permite
 * desenhar essa faixa na pré-visualização — nada quebra se o número for
 * outro, mas o engenheiro escolheria no escuro.
 */
export function fracaoVisivel(espec: EspecImagem): number {
  const razaoArquivo = espec.larguraIdeal / espec.alturaIdeal;
  return Math.min(1, razaoArquivo / espec.razaoVisivel);
}

/** 2 MB: o mesmo teto da assinatura e das fotos do diário. */
export const TAMANHO_MAX_IMAGEM = 2 * 1024 * 1024;

export const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp"];

export const BUCKET_IMAGENS_OBRA = "obra-imagens";

/** Validade da URL assinada. Curta: a página é renderizada a cada visita. */
export const VALIDADE_URL_SEGUNDOS = 60 * 60;

export type UrlsImagensObra = { capa: string | null; rdo: string | null };

/**
 * Troca os caminhos guardados por URLs assinadas, prontas para o `<img>`.
 *
 * O bucket é privado, então a URL tem validade — uma hora, folgado para a
 * visita mais longa e curto o bastante para um link copiado não virar acesso
 * permanente à foto da casa de alguém.
 *
 * Recebe o cliente Supabase em vez de criá-lo: a mesma função serve a página
 * do engenheiro e a do cliente, e cada uma já tem o seu.
 */
export async function assinarImagensObra(
  supabase: {
    storage: {
      from: (b: string) => {
        createSignedUrl: (
          p: string,
          s: number
        ) => Promise<{ data: { signedUrl: string } | null }>;
      };
    };
  },
  obra: { imagem_capa_path?: string | null; imagem_rdo_path?: string | null }
): Promise<UrlsImagensObra> {
  async function assinar(path: string | null | undefined) {
    if (!path) return null;
    const { data } = await supabase.storage
      .from(BUCKET_IMAGENS_OBRA)
      .createSignedUrl(path, VALIDADE_URL_SEGUNDOS);
    return data?.signedUrl ?? null;
  }

  const [capa, rdo] = await Promise.all([
    assinar(obra.imagem_capa_path),
    assinar(obra.imagem_rdo_path),
  ]);
  return { capa, rdo };
}
