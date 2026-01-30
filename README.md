
# Ambebe Frontend 🚀

**Frontend** da aplicação e-commerce Ambebe, construído com **Next.js (App Router)** e **TypeScript**. Este repositório contém a interface do cliente, áreas administrativas e componentes compartilhados para o projeto.

---

## 🔍 Visão geral

- Estrutura baseada em `src/app` usando o App Router do Next.js
- Componentes reutilizáveis em `src/components`
- Hooks e integrações da API em `src/lib`

---

## ✨ Principais funcionalidades

- Páginas públicas (produtos, categorias, ajuda)
- Áreas protegidas para clientes, staff e admin
- Integração com API externa via `axios`
- Gerenciamento de autenticação via tokens no `localStorage`
- Estilização com Tailwind CSS

---

## 🧰 Stack tecnológica

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Axios, Zod, Radix UI

---

## 🏁 Começando (local)

### Requisitos

- Node.js (recomendado 18+)
- npm ou pnpm

### Instalação

1. Clone o repositório

```bash
git clone <repo-url>
cd frontend
```

2. Instale dependências

```bash
npm install
# ou
# pnpm install
```

3. Crie um arquivo `.env.local` na raiz com a variável mínima necessária:

```
NEXT_PUBLIC_API_BASE_URL=https://api.exemplo.com
```

> A aplicação usa `NEXT_PUBLIC_API_BASE_URL` para se comunicar com a API.

### Scripts úteis

- `npm run dev` — Executa o projeto em modo desenvolvimento
- `npm run build` — Gera a build de produção
- `npm run start` — Inicia o servidor de produção (após `build`)
- `npm run lint` — Executa o ESLint em `src`

---

## 🔧 Estrutura importante

- `src/app` — Rotas e layouts (separado por áreas: public, customer, staff, admin)
- `src/components` — Componentes UI e shells por área
- `src/hooks` — Hooks personalizados (auth, cart, notifications)
- `src/lib` — Utils, cliente da API, autenticação e formatação

---

## 📦 Deploy

Recomendado: Vercel (configurar `NEXT_PUBLIC_API_BASE_URL` nas variáveis de ambiente do projeto no provedor).

---

## 🤝 Contribuição

- Abra issues para bugs e melhorias
- Para mudanças, crie uma branch com nome claro e submeta PRs explicando as alterações

---

## 📝 Licença

Adicione um arquivo `LICENSE` se desejar uma licença explícita (por exemplo, MIT).

---

## 📬 Contato / Observações

Se precisar de ajuda para configurar variáveis de ambiente, deploy ou fluxo de CI/CD, abra uma issue e descreva o que precisa.

---

**Bom trabalho! ✅**
=======
# ambebe-frontend
aplicacao front-end de e-commerce
