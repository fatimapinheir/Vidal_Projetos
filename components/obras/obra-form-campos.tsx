"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import {
  CATEGORIAS_OBRA,
  FAIXAS_TEMPLATE,
  PADROES_ACABAMENTO,
  UFS,
  formatarCep,
} from "@/lib/obra-cadastro";
import { NovoTipoObraDialog } from "./novo-tipo-obra-dialog";

const classeSelect =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export type TipoObra = { id: string; nome: string };

/** Só os campos do cadastro que o formulário preenche — o resto da obra não interessa aqui. */
export type ObraCampos = {
  nome: string;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  link_maps: string | null;
  setor: string | null;
  quadra: string | null;
  lote: string | null;
  cadastro_municipal: string | null;
  alvara_construcao: string | null;
  art_rrt_execucao: string | null;
  cno: string | null;
  categoria: string;
  tipo_obra_id: string | null;
  metragem_quadrada: number | null;
  padrao_acabamento: string | null;
  faixa: string | null;
  quartos: number;
  suites: number;
  banheiros: number;
  financiada: boolean;
};

/**
 * Campos do cadastro da obra, compartilhados por "nova obra" e "editar obra".
 *
 * São 24 campos. Mantidos em duas cópias, a primeira coisa que acontece é
 * alguém acrescentar um campo só na tela de criar e a edição passar a apagá-lo
 * silenciosamente ao salvar — a action lê o formulário inteiro de uma vez.
 */
export function ObraFormCampos({
  obra,
  tipos,
}: {
  obra?: Partial<ObraCampos>;
  tipos: TipoObra[];
}) {
  // Controlados porque a busca por CEP os preenche; o resto fica solto no DOM.
  const [logradouro, setLogradouro] = useState(obra?.logradouro ?? "");
  const [bairro, setBairro] = useState(obra?.bairro ?? "");
  const [cidade, setCidade] = useState(obra?.cidade ?? "");
  const [uf, setUf] = useState(obra?.uf ?? "");
  const [cep, setCep] = useState(obra?.cep ?? "");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [avisoCep, setAvisoCep] = useState<string | null>(null);

  /**
   * Preenche o endereço pelo CEP, via ViaCEP.
   *
   * Falha em silêncio proposital: CEP é conveniência, não obrigação. Se o
   * serviço estiver fora ou o CEP não existir, o engenheiro digita à mão — o
   * que não pode é o cadastro travar por causa de um serviço de terceiro.
   */
  async function buscarCep(valor: string) {
    const digitos = valor.replace(/\D/g, "");
    if (digitos.length !== 8) return;

    setBuscandoCep(true);
    setAvisoCep(null);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const dados = await r.json();
      if (dados.erro) {
        setAvisoCep("CEP não encontrado — preencha o endereço à mão.");
        return;
      }
      setLogradouro(dados.logradouro ?? "");
      setBairro(dados.bairro ?? "");
      setCidade(dados.localidade ?? "");
      setUf(dados.uf ?? "");
    } catch {
      setAvisoCep("Não deu para consultar o CEP agora — preencha à mão.");
    } finally {
      setBuscandoCep(false);
    }
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="nome">Nome da obra</FieldLabel>
        <Input id="nome" name="nome" required defaultValue={obra?.nome ?? ""} placeholder="Residência Silva" />
      </Field>

      <Field orientation="responsive">
        <div className="w-full">
          <FieldLabel htmlFor="data_inicio">Início previsto</FieldLabel>
          <Input id="data_inicio" name="data_inicio" type="date" defaultValue={obra?.data_inicio ?? ""} />
        </div>
        <div className="w-full">
          <FieldLabel htmlFor="data_fim_prevista">Fim previsto</FieldLabel>
          <Input id="data_fim_prevista" name="data_fim_prevista" type="date" defaultValue={obra?.data_fim_prevista ?? ""} />
        </div>
      </Field>

      <FieldSet>
        <FieldLegend variant="label">Localização</FieldLegend>

        <Field>
          <FieldLabel htmlFor="cep">CEP</FieldLabel>
          <Input
            id="cep"
            name="cep"
            inputMode="numeric"
            placeholder="00000-000"
            className="max-w-40"
            value={cep}
            onChange={(e) => {
              const formatado = formatarCep(e.target.value);
              setCep(formatado);
              // Dispara sozinho ao completar os 8 dígitos: esperar o blur faria
              // o engenheiro sair do campo sem saber que havia busca.
              if (formatado.replace(/\D/g, "").length === 8) buscarCep(formatado);
            }}
          />
          {buscandoCep && <FieldDescription>Buscando endereço...</FieldDescription>}
          {avisoCep && <FieldDescription>{avisoCep}</FieldDescription>}
        </Field>

        <Field>
          <FieldLabel htmlFor="logradouro">Logradouro</FieldLabel>
          <Input
            id="logradouro"
            name="logradouro"
            placeholder="Rua, Av., Travessa..."
            value={logradouro}
            onChange={(e) => setLogradouro(e.target.value)}
          />
        </Field>

        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="numero">Número</FieldLabel>
            <Input id="numero" name="numero" placeholder="Nº" defaultValue={obra?.numero ?? ""} />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="complemento">Complemento</FieldLabel>
            <Input id="complemento" name="complemento" placeholder="Apto, Sala, Bloco..." defaultValue={obra?.complemento ?? ""} />
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="bairro">Bairro</FieldLabel>
          <Input id="bairro" name="bairro" placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
        </Field>

        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="cidade">Cidade</FieldLabel>
            <Input id="cidade" name="cidade" placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
          </div>
          <div className="w-full sm:max-w-28">
            <FieldLabel htmlFor="uf">UF</FieldLabel>
            <select id="uf" name="uf" className={classeSelect} value={uf} onChange={(e) => setUf(e.target.value)}>
              <option value="">UF</option>
              {UFS.map((sigla) => (
                <option key={sigla} value={sigla}>
                  {sigla}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="link_maps">Link do Google Maps</FieldLabel>
          <Input
            id="link_maps"
            name="link_maps"
            placeholder="Cole o link do pin (maps.app.goo.gl ou maps.google.com/...)"
            defaultValue={obra?.link_maps ?? ""}
          />
          <FieldDescription>
            Opcional. No Google Maps: compartilhar → copiar link. Se ficar vazio, o mapinha usa o
            endereço acima.
          </FieldDescription>
        </Field>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Dados municipais (habite-se / alvará)</FieldLegend>
        <FieldDescription>
          Opcionais. Quando preenchidos, alimentam automaticamente os requerimentos gerados para
          esta obra.
        </FieldDescription>

        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="setor">Setor</FieldLabel>
            <Input id="setor" name="setor" defaultValue={obra?.setor ?? ""} />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="quadra">Quadra</FieldLabel>
            <Input id="quadra" name="quadra" defaultValue={obra?.quadra ?? ""} />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="lote">Lote</FieldLabel>
            <Input id="lote" name="lote" defaultValue={obra?.lote ?? ""} />
          </div>
        </Field>

        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="cadastro_municipal">Cadastro municipal</FieldLabel>
            <Input id="cadastro_municipal" name="cadastro_municipal" defaultValue={obra?.cadastro_municipal ?? ""} />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="alvara_construcao">Nº do alvará de construção</FieldLabel>
            <Input id="alvara_construcao" name="alvara_construcao" defaultValue={obra?.alvara_construcao ?? ""} />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="art_rrt_execucao">ART/RRT de execução</FieldLabel>
            <Input id="art_rrt_execucao" name="art_rrt_execucao" defaultValue={obra?.art_rrt_execucao ?? ""} />
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="cno">CNO (Cadastro Nacional de Obras)</FieldLabel>
          <Input id="cno" name="cno" placeholder="00.000.00000/00" className="max-w-56" defaultValue={obra?.cno ?? ""} />
        </Field>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Características</FieldLegend>

        <Field>
          <FieldLabel htmlFor="categoria">Categoria</FieldLabel>
          <select id="categoria" name="categoria" className={classeSelect} defaultValue={obra?.categoria ?? CATEGORIAS_OBRA[0]}>
            {CATEGORIAS_OBRA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <div className="flex items-end justify-between gap-2">
            <FieldLabel htmlFor="tipo_obra_id">Tipo de obra</FieldLabel>
            <NovoTipoObraDialog />
          </div>
          <select id="tipo_obra_id" name="tipo_obra_id" className={classeSelect} defaultValue={obra?.tipo_obra_id ?? ""}>
            <option value="">Selecione...</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </Field>

        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="metragem_quadrada">Metragem quadrada (m²)</FieldLabel>
            <Input
              id="metragem_quadrada"
              name="metragem_quadrada"
              inputMode="decimal"
              placeholder="Ex: 120,50"
              defaultValue={obra?.metragem_quadrada ?? ""}
            />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="padrao_acabamento">Padrão de acabamento</FieldLabel>
            <select id="padrao_acabamento" name="padrao_acabamento" className={classeSelect} defaultValue={obra?.padrao_acabamento ?? ""}>
              <option value="">Selecione...</option>
              {PADROES_ACABAMENTO.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="faixa">Faixa (template residencial)</FieldLabel>
          <select id="faixa" name="faixa" className={classeSelect} defaultValue={obra?.faixa ?? ""}>
            <option value="">Não definida</option>
            {FAIXAS_TEMPLATE.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>

        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="quartos">Quartos</FieldLabel>
            <Input id="quartos" name="quartos" type="number" min={0} defaultValue={obra?.quartos ?? 0} />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="suites">Suítes</FieldLabel>
            <Input id="suites" name="suites" type="number" min={0} defaultValue={obra?.suites ?? 0} />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="banheiros">Banheiros</FieldLabel>
            <Input id="banheiros" name="banheiros" type="number" min={0} defaultValue={obra?.banheiros ?? 0} />
          </div>
        </Field>

        <Field orientation="horizontal">
          <Checkbox id="financiada" name="financiada" defaultChecked={obra?.financiada ?? false} />
          <FieldLabel htmlFor="financiada" className="font-normal">
            Obra financiada
          </FieldLabel>
        </Field>
      </FieldSet>
    </FieldGroup>
  );
}
