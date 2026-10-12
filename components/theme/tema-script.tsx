/**
 * Aplica o tema salvo antes do primeiro pixel.
 *
 * Precisa ser um script síncrono no <head>: se a classe só entrasse depois da
 * hidratação, quem usa o tema escuro levaria um flash branco na cara a cada
 * navegação. Por isso o `dangerouslySetInnerHTML` — não há como fazer isso com
 * um componente React normal, que por definição roda tarde demais.
 *
 * O padrão é claro, de propósito: o tema escuro existe por inteiro nos tokens,
 * mas só entra quando o usuário pede. Não seguimos `prefers-color-scheme`
 * porque quem está de sistema escuro não escolheu o tema escuro DESTE app.
 */
const script = `(function(){try{var t=localStorage.getItem("vidal-tema");if(t==="escuro")document.documentElement.classList.add("dark")}catch(e){}})()`;

export function TemaScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
