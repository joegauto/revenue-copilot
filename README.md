# Revenue Copilot

Agente de IA autónomo SaaS multi-tenant para gestión comercial de PYMEs y agencias.

## Estructura del Monorepo

```
revenue-copilot/
├── apps/
│   ├── web/          # Next.js 14 + TypeScript + Tailwind CSS (Frontend + API)
│   └── engine/       # FastAPI + Python (Motor de IA)
├── packages/
│   └── shared/       # Tipos e interfaces compartidas (TypeScript)
├── prisma/           # Schema y migraciones de base de datos
├── docker-compose.yml
└── package.json
```

## Requisitos

- Node.js >= 18
- Python >= 3.11
- Docker & Docker Compose

## Inicio Rápido

1. **Clonar e instalar dependencias:**
   ```bash
   npm install
   cd apps/engine && pip install -r requirements.txt
   ```

2. **Levantar servicios (PostgreSQL + Redis):**
   ```bash
   docker-compose up -d
   ```

3. **Configurar variables de entorno:**
   ```bash
   cp apps/web/.env.example apps/web/.env
   cp apps/engine/.env.example apps/engine/.env
   ```

4. **Ejecutar en desarrollo:**
   ```bash
   # Frontend (Next.js)
   npm run dev:web

   # Backend (FastAPI)
   npm run dev:engine
   ```

## Stack Tecnológico

| Componente | Tecnología |
|-----------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend API | FastAPI (Python) |
| Base de datos | PostgreSQL + Prisma |
| Caché/Colas | Redis |
| IA | LangChain + LLM (Claude/GPT) |
