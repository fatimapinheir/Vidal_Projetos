import { AnkoraWordmark } from "@/components/marca/ankora-wordmark";

/**
 * A primeira tela: metade navy com a marca, metade clara com o formulário.
 *
 * A divisão não é decoração. O logotipo da Ankora nasceu branco sobre navy, e
 * é a única tela do sistema onde ele pode aparecer grande — depois do login
 * ele vive a 24px no canto da lateral. Dar a ele metade da tela aqui é o que
 * faz a marca existir para quem entra.
 *
 * No celular a chapa navy vira uma faixa no topo: duas metades empilhadas
 * empurrariam o formulário para fora da primeira dobra, e quem abre esta tela
 * veio digitar a senha.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 flex-col lg:flex-row">
      <div className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-marca-navy px-6 py-8 text-white lg:w-[44%] lg:px-14 lg:py-14">
        {/* Clarão âmbar no canto — o navy sozinho, numa área desse tamanho,
            fica chapado. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 size-[28rem] rounded-full bg-marca-ambar/10 blur-3xl"
        />

        <AnkoraWordmark className="relative h-7 self-start lg:h-9" />

        <div className="relative mt-8 hidden lg:block">
          <p className="font-heading text-3xl leading-tight font-semibold">
            Grandes resultados
            <br />
            são construídos
            <br />
            <span className="text-marca-ambar">com organização.</span>
          </p>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">
            Diário de obra, cronograma, orçamento e financeiro no mesmo lugar — para quem
            executa e para quem acompanha.
          </p>
        </div>

        <svg viewBox="0 0 64 28" aria-hidden className="relative mt-8 hidden h-7 w-auto self-start lg:block">
          <path d="M0,28 L17,4 L27,18 L34,9 L52,28 Z" className="fill-marca-ambar" opacity="0.85" />
          <path d="M30,28 L44,10 L64,28 Z" className="fill-marca-ambar" opacity="0.5" />
        </svg>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background p-6 lg:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
