# Freecycle - Local Free Stuff Platform

A production-ready microservices platform that lets people give away nearby items for free.

- **Backend:** Node.js + Express, six independent services
- **Frontend:** React 18 + Vite + React Router
- **Database:** PostgreSQL 15 + **PostGIS** for radius/distance queries
- **Realtime:** Socket.IO (chat, typing indicators, read receipts)
- **Event bus:** Redis pub/sub (event-driven notifications)
- **Storage:** AWS S3 for listing images
- **DevOps:** One Dockerfile per service, `docker compose` orchestration, Jenkins CI/CD
- **Deployment:** AWS (RDS Postgres + ElastiCache Redis + ECS Fargate + S3)

---

## 1. Repository layout

```
.
|-- docker-compose.yml          # spins up everything locally
|-- Jenkinsfile                 # CI/CD pipeline
|-- .env.example                # all environment variables
|-- database/
|   `-- init/                   # auto-loaded schema + seed (PostGIS image)
|       |-- 001_schema.sql
|       `-- 002_seed.sql
|-- shared/                     # @freecycle/shared (db, auth, events, errors)
|-- services/
|   |-- api-gateway/            # public entry point :8080
|   |-- user-service/           # auth, profiles                :4001
|   |-- listing-service/        # listings + S3 image upload    :4002
|   |-- location-service/       # PostGIS radius queries        :4003
|   |-- chat-service/           # Socket.IO + REST              :4004
|   `-- notification-service/   # Redis consumer + REST         :4005
`-- frontend/                   # React SPA  :5173 (nginx in prod)
```

Detailed docs:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - service responsibilities, communication, scaling
- [`docs/API.md`](docs/API.md) - every REST route + WebSocket events with sample payloads
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) - end-to-end AWS deployment instructions

---

## 2. Quick start (local, all in Docker)

> Requires Docker Desktop or Docker Engine 24+, no Node install needed.

```bash
cp .env.example .env
docker compose up --build
```

Then open:

| URL                            | What                          |
| ------------------------------ | ----------------------------- |
| http://localhost:5173          | React frontend                |
| http://localhost:8080/health   | API gateway health            |
| http://localhost:8080/api/...  | All REST endpoints            |
| ws://localhost:8080/socket.io  | Socket.IO chat (proxied)      |
| postgres://localhost:5432      | PostgreSQL (PostGIS enabled)  |

The PostGIS container auto-runs `database/init/001_schema.sql` and the seed file the first time it starts.

To wipe the DB and start fresh:

```bash
docker compose down -v
docker compose up --build
```

---

## 3. Quick start (run a single service locally)

```bash
cd services/user-service
npm install
POSTGRES_HOST=localhost JWT_SECRET=dev npm run dev
```

The shared package is consumed via `file:../../shared` so no workspace install is required.

---

## 4. AWS S3 for images (optional in dev)

The listing service uploads to S3 using AWS SDK v3.

For local dev without an AWS account, point at MinIO:

```bash
docker run -d --name minio -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minio -e MINIO_ROOT_PASSWORD=minio12345 \
  minio/minio server /data --console-address ":9001"
```

Then in `.env`:

```
AWS_ACCESS_KEY_ID=minio
AWS_SECRET_ACCESS_KEY=minio12345
S3_BUCKET=freecycle-listings-images
S3_ENDPOINT=http://host.docker.internal:9000
```

For real AWS deployment leave `S3_ENDPOINT` empty.

---

## 5. Useful commands

```bash
# Tail logs of one service
docker compose logs -f listing-service

# Run a psql shell inside the postgres container
docker compose exec postgres psql -U freecycle -d freecycle

# Rebuild a single service
docker compose build listing-service && docker compose up -d listing-service

# Run unit tests across the monorepo
npm test --workspaces --if-present
```

---

## 6. Tech & design choices in 30 seconds

- **PostGIS** with GiST index on `GEOGRAPHY(POINT, 4326)` for fast radius queries via `ST_DWithin` and ordering with the `<->` operator (KNN).
- **JWT** signed in user-service, **verified at the API gateway** so downstream services trust the forwarded `Authorization` header.
- **Redis pub/sub** decouples writes (listing/chat services) from notification fan-out (notification service consumer).
- **One container per service** - each has its own Dockerfile and can be scaled independently behind ALB target groups / ECS services.
- **Stateless services** - all state in PostgreSQL or Redis, so horizontal scaling is trivial. Socket.IO uses sticky sessions or the Redis adapter (see ARCHITECTURE.md).
- **Image uploads** never go through the database; they are streamed by the listing service to S3 and only the URL is persisted.

---

## 7. License

MIT
