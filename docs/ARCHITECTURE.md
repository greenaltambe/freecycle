# Architecture

```
                     +-----------------+
                     |    Frontend     |   React + Vite, served by nginx in prod
                     |   (React SPA)   |
                     +--------+--------+
                              |
                              | HTTPS  (REST + WebSocket on /socket.io)
                              v
                     +-----------------+
                     |   API Gateway   |   express + http-proxy-middleware
                     |   :8080         |   - JWT verify
                     +--------+--------+   - Rate limit /auth
                              |             - WS upgrade -> chat-service
            +-----------------+-----------------+----------------+--------------------+
            |                 |                 |                |                    |
            v                 v                 v                v                    v
  +------------------+ +------------------+ +-----------------+ +-----------------+ +-----------------------+
  |  user-service    | | listing-service  | | location-svc    | |  chat-service   | | notification-service  |
  |   :4001          | |  :4002           | |  :4003          | |  :4004 (HTTP+WS)| |  :4005                |
  |  - register      | |  - CRUD listings | |  - nearby items | |  - 1:1 chats    | |  - REST: list/unread  |
  |  - login (JWT)   | |  - S3 upload     | |  - nearby users | |  - WS messaging | |  - Redis consumer     |
  |  - profile       | |  - publish event | |  (PostGIS)      | |  - publish msg  | |  - DB writes          |
  +--------+---------+ +--------+---------+ +--------+--------+ +--------+--------+ +-----------+-----------+
           |                    |                    |                   |                       ^
           |                    |                    |                   |                       |
           |                    |   publish          |                   | publish               | subscribe
           |                    +-----+              |                   +-----+                 |
           |                          v              |                         v                 |
           |                   +------+--------------+-------------------------+--------+        |
           |                   |                          REDIS                         |--------+
           |                   |  channels: listing.created, listing.taken,             |
           |                   |            chat.message_sent                           |
           |                   +--------------------------+-----------------------------+
           |                                              |
           v                                              v
                          +------------------------+----------------------+
                          |    PostgreSQL 15 + PostGIS 3.x                |
                          |  users / listings / images / chats / messages |
                          |  notifications / categories                   |
                          +-----------------------------------------------+
                                              |
                                              v
                                    +-------------------+
                                    |     AWS S3        |  listing images
                                    +-------------------+
```

---

## 1. Service responsibilities

| Service              | Owns               | Reads from        | Writes to         | Talks to             |
|----------------------|--------------------|-------------------|-------------------|----------------------|
| api-gateway          | routing, auth gate | -                 | -                 | all services         |
| user-service         | users              | users             | users             | -                    |
| listing-service      | listings, images   | listings, images  | listings, images  | S3, Redis (publish)  |
| location-service     | geo queries        | listings, users   | -                 | -                    |
| chat-service         | chats, messages    | chats, messages   | chats, messages   | Redis (publish)      |
| notification-service | notifications      | users, listings   | notifications     | Redis (subscribe)    |

A service NEVER reaches into another service's tables for writes. Reads of geo data are deliberately permitted because PostGIS spatial indexes shouldn't be duplicated. If you needed strict ownership you would split the database too (one DB per service) and have services expose dedicated APIs.

## 2. How services communicate

### Synchronous (REST)
- The frontend talks **only** to the API gateway. The gateway proxies each `/api/...` prefix to the responsible service over the `freecycle` Docker network (or the AWS service-discovery DNS in production).
- The gateway verifies the JWT once and forwards the original `Authorization` header. Downstream services use the same shared `auth.authRequired` middleware to re-verify cheaply, defense-in-depth.

### Asynchronous (events)
- Producers `publish('listing.created', payload)` to Redis after committing to Postgres.
- The notification-service is the only subscriber today; new subscribers (email service, push service) can be added without modifying producers.
- Failure handling: publish errors are logged but never block the API response - the user-facing write already succeeded in Postgres. For at-least-once semantics, swap Redis pub/sub for Kafka (or Redis Streams with consumer groups) - see "Future scaling" below.

### Realtime (WebSockets)
- Socket.IO lives in chat-service. The gateway proxies `/socket.io` upgrade requests to it.
- On `connection`, the server validates the JWT from `socket.handshake.auth.token` and joins the personal room `user:<id>`. Joining a chat additionally joins `chat:<chatId>` so room broadcasts work.
- A new message goes Postgres -> emit to `chat:<id>` -> publish `chat.message_sent` to Redis -> notification-service writes a row -> client polls or refreshes count.

## 3. Data model highlights

- `users.location` and `listings.location` are `GEOGRAPHY(POINT, 4326)` so distance returns metres regardless of latitude. GiST indexes power both `ST_DWithin` (radius filter) and the `<->` operator (KNN ordering by distance).
- `chats` enforces `user_a_id < user_b_id` and a uniqueness constraint on `(user_a_id, user_b_id, listing_id)`, so opening a chat twice for the same listing is idempotent.
- `notifications.payload` is `JSONB`, allowing each notification type to carry its own structured data without table churn.

## 4. Security

- Passwords are hashed with bcrypt (cost 10).
- JWT secret is **mandatory** in production - the gateway and every service refuse requests without a valid token.
- All requests pass through helmet (security headers) and CORS.
- Auth endpoints are rate-limited at the gateway (30 req / 15 min / IP).
- The S3 bucket should have **public read** for listing images but **private write** (only the listing-service IAM role can `PutObject`).

## 5. Scaling

| Concern                          | Strategy                                                                 |
|----------------------------------|--------------------------------------------------------------------------|
| Stateless service replicas       | Each service in its own ECS service / target group; scale by CPU & RPS.  |
| Sticky sessions for Socket.IO    | Use ALB stickiness or run socket.io with the **Redis adapter**.          |
| Database hot reads               | RDS read replicas + pgBouncer; route GETs to a replica via env URL.      |
| Geo queries                      | Already O(log n) via the GiST index; partition by region if > 10M rows.  |
| Image traffic                    | CloudFront in front of the S3 bucket; bucket stays private.              |
| Event durability                 | Replace Redis pub/sub with **Redis Streams** (consumer groups + ACKs)    |
|                                  | or Kafka if you need replay / multiple consumer fan-out.                 |
| Notification fan-out             | The consumer is independent and idempotent on (`user_id`, `listingId`)   |
|                                  | so it can run as N replicas with a Redis Streams consumer group.         |

## 6. Local development tips

- All inter-service URLs are environment variables (`USER_SERVICE_URL`, etc). When running a single service against the rest in Docker, point those vars at `host.docker.internal`.
- Migrations are simple SQL files in `database/init/`. For schema changes after the first boot, manually apply the SQL or add a migration tool such as `node-pg-migrate` (see DEPLOYMENT.md).
