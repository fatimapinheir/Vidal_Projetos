import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Planilhas SINAPI reais têm milhares de linhas — o padrão de 1MB
      // corta o upload (arquivo + itens) no meio do envio.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
