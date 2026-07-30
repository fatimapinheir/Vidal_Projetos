-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type user_role as enum ('engenheiro', 'cliente');
create type obra_tipo as enum ('residencial', 'comercial');
create type obra_status as enum ('planejamento', 'em_andamento', 'pausada', 'concluida');
create type presenca_status as enum ('presente', 'falta', 'meia_diaria');
create type fechamento_status as enum ('aberto', 'pago');
create type forma_pagamento as enum ('dinheiro', 'pix', 'boleto', 'cartao_credito', 'cartao_debito', 'transferencia', 'cheque', 'outro');
create type compra_status as enum ('cotada', 'aprovada', 'recusada', 'paga');
create type parcela_status as enum ('pendente', 'paga', 'vencida');
