# Deploy — Revenue Copilot

## Opciones de Deploy

### Opción A: Docker Compose (VPS / servidor propio)

La más simple. Un solo servidor con todo.

```bash
# 1. Clonar y configurar
cp .env.example .env
# Editar .env con valores reales (JWT_SECRET, ENCRYPTION_KEY, OPENAI_API_KEY)

# 2. Levantar todo
docker compose up -d --build

# 3. Ejecutar migraciones
docker compose exec web npx prisma migrate deploy

# 4. Verificar
curl http://localhost:3000/api/auth/login  # debería dar 400
curl http://localhost:8000/health          # debería dar {"status":"ok"}
```

**Costo estimado:** $5-10/mes en un VPS (DigitalOcean, Hetzner, Contabo)

---

### Opción B: Cloud separado (recomendada para producción)

| Servicio | Plataforma | Tier |
|----------|-----------|------|
| Frontend (Next.js) | **Vercel** | Hobby (gratis) o Pro ($20/mes) |
| Engine (FastAPI) | **Railway** | Starter ($5/mes) |
| PostgreSQL | **Railway** o **Supabase** | Gratis hasta 500MB |
| Redis | **Upstash** | Gratis hasta 10K cmd/día |

#### Paso 1: PostgreSQL (Supabase)
1. Ir a [supabase.com](https://supabase.com) → New Project
2. Copiar la `DATABASE_URL` (Connection string → URI)
3. Ejecutar migraciones: `npx prisma migrate deploy`

#### Paso 2: Redis (Upstash)
1. Ir a [upstash.com](https://upstash.com) → Create Database
2. Copiar la `REDIS_URL`

#### Paso 3: Engine en Railway
1. Ir a [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Seleccionar el repo, root directory: `apps/engine`
3. Variables de entorno:
   - `DATABASE_URL` (de Supabase)
   - `REDIS_URL` (de Upstash)
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL=gpt-4o-mini`
4. Railway detecta el Dockerfile automáticamente

#### Paso 4: Frontend en Vercel
1. Ir a [vercel.com](https://vercel.com) → Import Project
2. Root directory: `apps/web`
3. Framework preset: Next.js
4. Variables de entorno:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `JWT_SECRET` (generar: `openssl rand -base64 32`)
   - `ENCRYPTION_KEY` (exactamente 32 caracteres)
   - `ENGINE_URL` (URL de Railway, ej: `https://rc-engine-xxx.railway.app`)
   - `WHATSAPP_VERIFY_TOKEN`
5. Build command: `npx prisma generate && next build`

---

### Opción C: Todo en Railway (más simple que B)

Railway soporta monorepos. Un solo proyecto con 4 servicios:
1. PostgreSQL (plugin)
2. Redis (plugin)
3. Engine (desde `apps/engine`)
4. Web (desde `apps/web`)

Todo se configura en un dashboard y comparten la network interna.

---

## Variables de Entorno (producción)

```bash
# Obligatorias
DATABASE_URL=postgresql://user:pass@host:5432/revenue_copilot
REDIS_URL=redis://default:pass@host:6379
JWT_SECRET=<generar con: openssl rand -base64 32>
ENCRYPTION_KEY=<exactamente 32 caracteres alfanuméricos>
OPENAI_API_KEY=sk-...
ENGINE_URL=https://tu-engine.railway.app

# Opcionales (se configuran en onboarding)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=revenue-copilot-verify
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## Post-deploy

1. **Migrar DB:** `npx prisma migrate deploy`
2. **Verificar health:** `GET /health` en el engine, `GET /api/auth/login` en web
3. **Crear primer tenant:** `POST /api/auth/register` con email/password
4. **Completar onboarding:** Ir a `/onboarding` y seguir los 4 pasos
5. **Configurar WhatsApp webhook:** En Meta Business → Webhook URL: `https://tu-app.vercel.app/api/webhooks/whatsapp`

## Dominio personalizado

En Vercel: Settings → Domains → Agregar tu dominio.
El DNS apunta a Vercel (CNAME o A record).
