# API Reference

All endpoints are exposed through the API gateway under the `/api` prefix
(`http://localhost:8080` locally). The gateway strips the prefix before
forwarding, so e.g. `POST /api/auth/login` -> `POST /auth/login` on
user-service.

Authenticated routes require the `Authorization: Bearer <jwt>` header,
obtained from `/api/auth/login` or `/api/auth/register`.

Errors are always JSON:

```json
{ "error": "Human readable message", "details": ["validation messages"] }
```

---

## 1. Auth (user-service)

### POST `/api/auth/register`
```json
// request
{
  "email": "alice@example.com",
  "username": "alice",
  "password": "secret123",
  "fullName": "Alice Smith"
}
// 201 response
{
  "user":  { "id": "...", "email": "...", "username": "alice", ... },
  "token": "eyJhbGciOi..."
}
```

### POST `/api/auth/login`
```json
{ "email": "alice@example.com", "password": "secret123" }
```
Returns the same shape as register.

### POST `/api/auth/logout`
JWTs are stateless. The endpoint returns `{ "ok": true }` and the client
discards the token. (Hook in a token blacklist here if needed.)

---

## 2. Users (user-service)

| Method | Path                       | Auth | Notes                                |
|--------|----------------------------|------|--------------------------------------|
| GET    | `/api/users/me`            | yes  | Current user including coords        |
| PUT    | `/api/users/me`            | yes  | Body: `{ fullName?, avatarUrl? }`    |
| PUT    | `/api/users/me/location`   | yes  | Body: `{ latitude, longitude }`      |
| GET    | `/api/users/:id`           | no   | Public profile (no email)            |

---

## 3. Categories & Listings (listing-service)

### GET `/api/categories`
```json
{ "categories": [{ "slug": "furniture", "name": "Furniture" }, ...] }
```

### GET `/api/listings`
Query params: `page`, `pageSize`, `status`, `categorySlug`, `userId`, `q`.
```json
{
  "page": 1, "pageSize": 20,
  "listings": [
    {
      "id": "...", "userId": "...", "title": "Free chair",
      "description": "...", "status": "available",
      "addressText": "Midtown",
      "latitude": 40.748, "longitude": -73.985,
      "categorySlug": "furniture", "categoryName": "Furniture",
      "createdAt": "...", "updatedAt": "...",
      "images": [{ "id": "...", "url": "https://...", "position": 0 }]
    }
  ]
}
```

### GET `/api/listings/:id`
Returns `{ "listing": { ... } }` or 404.

### POST `/api/listings` (auth)
```json
{
  "title": "Free chair",
  "description": "Solid oak, light wear",
  "categorySlug": "furniture",
  "addressText": "Midtown, NYC",
  "latitude": 40.7484,
  "longitude": -73.9857
}
```
Publishes a `listing.created` event on Redis.

### PUT `/api/listings/:id` (auth, owner only)
Partial update of any creation field.

### PATCH `/api/listings/:id/status` (auth, owner only)
```json
{ "status": "taken" }   // or "available" | "removed"
```
A `taken` status publishes `listing.taken`.

### DELETE `/api/listings/:id` (auth, owner only)
Soft-deletes (status = `removed`).

### POST `/api/listings/:id/images` (auth, owner only)
`multipart/form-data` with `images` field (up to 6 files, 5 MB each).
The service streams each file to S3 and stores `(listing_id, url, s3_key)`.
```json
{ "images": [{ "id": "...", "url": "https://...", "position": 0 }] }
```

### DELETE `/api/listings/:listingId/images/:imageId` (auth, owner only)

---

## 4. Location (location-service)

### GET `/api/listings/nearby`
Query params (`latitude`, `longitude` required):

| Param         | Default | Range            |
|---------------|---------|------------------|
| latitude      | -       | -90..90          |
| longitude     | -       | -180..180        |
| radiusKm      | 5       | 0.1..200         |
| status        | available | available/taken |
| categorySlug  | -       |                  |
| page          | 1       |                  |
| pageSize      | 20      | 1..50            |

Listings are returned ordered **closest first**, with `distanceKm`
populated.

```json
{
  "page": 1, "pageSize": 20, "radiusKm": 5,
  "listings": [
    { "id": "...", "title": "Free chair", "distanceKm": 0.832, ... }
  ]
}
```

### GET `/api/users/nearby` (internal helper)
Used by notification-service (and any future "people nearby" feature).
```json
// GET /api/users/nearby?latitude=40.7&longitude=-74&radiusKm=5&excludeUserId=...
{ "userIds": ["uuid1", "uuid2", ...] }
```

---

## 5. Chats (chat-service)

### GET `/api/chats` (auth)
Returns chats the user is in, with last message preview and unread count.

### POST `/api/chats` (auth)
```json
{ "otherUserId": "uuid", "listingId": "uuid (optional)" }
```
Idempotent: returns the existing chat for that pair+listing if present.

### GET `/api/chats/:id/messages?limit=50&before=ISO-DATE` (auth)
Oldest first, newest last - paginate by passing the oldest message's
`createdAt` as `before` to fetch the previous page.

### POST `/api/chats/:id/messages` (auth)
```json
{ "body": "Hi, is this still available?" }
```
Persists, then publishes `chat.message_sent` to Redis.

### POST `/api/chats/:id/read` (auth)
Marks all incoming messages in the chat as read.

---

## 6. Notifications (notification-service)

### GET `/api/notifications?limit=30` (auth)
```json
{
  "notifications": [
    {
      "id": "...",
      "type": "new_message" | "new_nearby_listing" | "listing_taken",
      "payload": { "...": "type-specific" },
      "readAt": null,
      "createdAt": "..."
    }
  ]
}
```

### GET `/api/notifications/unread-count` (auth)
```json
{ "count": 3 }
```

### POST `/api/notifications/:id/read` (auth)
### POST `/api/notifications/read-all` (auth)

---

## 7. WebSocket (chat-service via gateway)

Connect with Socket.IO client to the gateway URL, path `/socket.io`:

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:8080', {
  path: '/socket.io',
  auth: { token: '<JWT>' },
});
```

### Client -> server events

| Event           | Payload                            | Ack                                |
|-----------------|------------------------------------|------------------------------------|
| `join_chat`     | `{ chatId }`                       | `{ ok: true }` or `{ error }`      |
| `leave_chat`    | `{ chatId }`                       | -                                  |
| `send_message`  | `{ chatId, body }`                 | `{ ok: true, message }`            |
| `typing`        | `{ chatId, isTyping }`             | -                                  |
| `mark_read`     | `{ chatId }`                       | `{ ok: true }`                     |

### Server -> client events

| Event              | Payload                                          |
|--------------------|--------------------------------------------------|
| `message_received` | full message object (`id, chatId, senderId,...`) |
| `typing`           | `{ chatId, userId, isTyping }`                   |
| `read_receipt`     | `{ chatId, userId }`                             |

---

## 8. Event bus (Redis pub/sub)

Internal contract; not exposed publicly.

| Channel              | Producer            | Consumer(s)            | Payload                                           |
|----------------------|---------------------|------------------------|---------------------------------------------------|
| `listing.created`    | listing-service     | notification-service   | `{ id, userId, title, latitude, longitude, ... }` |
| `listing.taken`      | listing-service     | notification-service   | `{ id, userId, title }`                           |
| `chat.message_sent`  | chat-service        | notification-service   | `{ chatId, senderId, recipientId, body, ... }`    |
