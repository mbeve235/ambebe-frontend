# Ambebe Frontend

Frontend em Next.js 16 para o e-commerce Ambebe.

## Requisitos

- Node.js 20.9+ (recomendado Node.js 20 LTS)
- npm 10+

## Variaveis de ambiente

Copie `.env.example` para `.env.local` no ambiente local:

```bash
cp .env.example .env.local
```

Defina os valores reais:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPPORT_WHATSAPP`
- `NEXT_PUBLIC_SUPPORT_EMAIL`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Deploy no Vercel

1. Importe o repositorio no Vercel.
2. Se o repositorio tiver `backend/` e `frontend/`, configure `Root Directory` como `frontend`.
3. Em `Environment Variables`, adicione:
   - `NEXT_PUBLIC_API_BASE_URL`
   - `NEXT_PUBLIC_SUPPORT_WHATSAPP`
   - `NEXT_PUBLIC_SUPPORT_EMAIL`
4. Build command: `npm run build` (ja definido em `vercel.json`).
5. Install command: `npm ci` (ja definido em `vercel.json`).
6. Deploy.

## Observacoes

- O arquivo `.env` nao deve ser versionado.
- Para alterar backend por ambiente (preview/producao), configure valores diferentes no painel do Vercel.
