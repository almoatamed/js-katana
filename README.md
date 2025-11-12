# js-kt 🚀

> **The TypeScript-First Framework That Makes Building Web Servers a Joy**

Build scalable, type-safe Node.js servers with zero configuration overhead. js-kt combines the simplicity of file-based routing with the power of TypeScript, WebSockets, and automatic type generation—all while delivering production-ready performance out of the box.

---

## ✨ Why js-kt?

### 🎯 **Developer Experience First**
- **Zero Boilerplate**: Your file structure IS your API. No manual route registration needed.
- **Full Type Safety**: End-to-end TypeScript with automatic type inference and generation.
- **Hot Reload**: Instant feedback during development with automatic route discovery.
- **Auto-Documentation**: Beautiful, interactive API docs generated automatically from your code.

### ⚡ **Performance Built-In**
- **Optimized Routing**: O(1) lookups, pattern caching, and intelligent route matching.
- **Multi-Threading**: Built-in cluster support for maximum CPU utilization.
- **Redis-Ready**: Seamless Socket.IO scaling with Redis adapter support.
- **Smart Caching**: File stat caching, compiled pattern reuse, and efficient middleware execution.

### 🔄 **Unified Protocol Support**
- **Dual Transport**: Serve the same route logic via HTTP, WebSocket, or both—seamlessly.
- **Type-Safe WebSockets**: Real-time communication with the same type safety as REST APIs.
- **Event-Driven Architecture**: Built-in event system with type-safe payloads and responses.

### 🛠️ **Production-Ready Features**
- **Middleware System**: Hierarchical middleware with directory-based scoping.
- **Error Handling**: Structured error responses with automatic type inference.
- **Startup Scripts**: Organized initialization with dependency management.
- **Static File Serving**: Built-in support with optional middleware protection.

---

## 🚀 Quick Start

### Installation

```bash
npm install js-kt
# or
bun add js-kt
```

### Your First Server (30 seconds)

**1. Create a route file** (`src/routes/index.router.ts`):

```typescript
import { createHandler } from "js-kt";

export default createHandler({
    method: "GET",
    handler: (context) => {
        return context.respond.json({ 
            message: "Hello, js-kt! 🎉",
            timestamp: Date.now()
        });
    },
});
```

**2. Start the server**:

```bash
npx kt-cli dev
```

**That's it!** Your server is running at `http://localhost:3000` with full TypeScript support, hot reload, and automatic route registration.

---

## 📁 File-Based Routing

js-kt uses your file system structure to define your API. It's that simple.

### Route Structure

```
src/routes/
├── index.router.ts          → GET /
├── users/
│   ├── index.router.ts      → GET /users
│   ├── [id].router.ts       → GET /users/:id
│   └── profile.router.ts    → GET /users/profile
└── posts/
    └── [slug].router.ts     → GET /posts/:slug
```

### Dynamic Routes

Use brackets for URL parameters:

```typescript
// src/routes/users/[id].router.ts
export default createHandler({
    method: "GET",
    handler: (context, _body, _query, params: { id: string }) => {
        return context.respond.json({
            userId: params.id,
            message: `Fetching user ${params.id}`
        });
    },
});
```

---

## 🎨 Type Safety Made Simple

### Automatic Type Inference

js-kt infers types from your handlers automatically:

```typescript
interface CreateUserRequest {
    name: string;
    email: string;
    age: number;
}

export default createHandler({
    method: "POST",
    handler: (
        context,
        body: CreateUserRequest,  // ← Type inferred automatically
        query: { debug?: boolean },
        params: { id: string },
        headers
    ) => {
        // Response type is automatically inferred from your return statement
        return context.respond.json({
            success: true,
            user: {
                id: params.id,
                ...body,
                createdAt: new Date().toISOString()
            }
        });
    },
});
```

### Generated Types

Run `npx kt-cli scan-types` to generate:
- ✅ Request/response types for all routes
- ✅ WebSocket channel types
- ✅ Event emitter types
- ✅ Complete API type definitions in `./types/apiTypes.json`

Use these types with `js-kt-client` for end-to-end type safety from server to client!

---

## 🔌 WebSocket Channels

### Real-Time Communication, Type-Safe

Define WebSocket handlers with the same simplicity as HTTP routes:

```typescript
// src/routes/chat.router.ts
import { defineChannelHandler } from "js-kt";
import type { Respond } from "js-kt";

export const handler = defineChannelHandler((socket) => {
    console.log("Client connected:", socket.id);

    return {
        handler(
            body: { message: string; roomId: string },
            respond?: Respond<{ success: boolean; timestamp: number }>
        ) {
            // Broadcast to room
            socket.to(body.roomId).emit("message", {
                from: socket.id,
                message: body.message,
                timestamp: Date.now()
            });

            // Optional response
            respond?.({
                success: true,
                timestamp: Date.now()
            });
        },
    };
});
```

### Client Usage

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.emit('chat', { 
    message: 'Hello!', 
    roomId: 'room-1' 
}, (response) => {
    console.log('Server responded:', response);
    // response is fully typed: { success: boolean; timestamp: number }
});
```

### Middleware for Channels

```typescript
// src/routes/chat.middleware.ts
import { defineChannelHandler } from "js-kt";

export const channelBeforeMounted = defineChannelBeforeMounted(async (socket) => {
    // Authentication check before socket is fully connected
    const token = socket.handshake.auth.token;
    if (!token || !await validateToken(token)) {
        return "Authentication required"; // Reject connection
    }
    return true; // Accept connection
});

export const channelMiddleware = defineChannelHandler((socket) => {
    return {
        handler(body: any, respond, ev) {
            // Log all incoming events
            console.log(`[${socket.id}] Event: ${ev}`, body);
        }
    };
});

export const channelMounted = defineChannelMounted((socket) => {
    // Called after socket is successfully connected
    console.log(`Socket ${socket.id} is ready for events`);
});
```

---

## 🔄 Dual Protocol Support

Serve the same route logic via HTTP, WebSocket, or both:

```typescript
export default createHandler({
    method: "POST",
    serveVia: ["Http", "Socket"], // Works on both protocols!
    handler: (context, body: { action: string }) => {
        return context.respond.json({
            action: body.action,
            processed: true
        });
    },
});
```

**HTTP Request:**
```bash
curl -X POST http://localhost:3000/api/action \
  -H "Content-Type: application/json" \
  -d '{"action": "process"}'
```

**WebSocket Request:**
```javascript
socket.emit('/api/action', { action: 'process' }, (response) => {
    console.log(response); // Same response structure!
});
```

---

## 🎭 Middleware System

### Directory-Based Middleware

Middleware is automatically applied based on directory structure:

```
src/routes/
├── auth.middleware.ts        → Applied to all routes in this directory
├── users/
│   ├── admin.middleware.ts   → Applied to all routes in users/
│   ├── index.router.ts
│   └── [id].router.ts
```

### Middleware Example

```typescript
// src/routes/auth.middleware.ts
import { defineMiddleware } from "js-kt";
import { throwUnauthorizedError } from "js-kt";

export default defineMiddleware(async (context, _body, _query, _params, headers) => {
    const token = headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        throwUnauthorizedError("Missing authentication token");
    }

    // Verify token and attach user to context
    const user = await verifyToken(token);
    context.locals.user = user; // Available in all handlers
});
```

### Extending Context

```typescript
// Extend the Locals interface
declare module "js-kt" {
    interface Locals {
        user?: {
            id: string;
            email: string;
            role: string;
        };
    }
}

// Use in handlers
export default createHandler({
    method: "GET",
    handler: (context) => {
        const user = context.locals.user; // Fully typed!
        return context.respond.json({ user });
    },
});
```

---

## 🎯 Error Handling

### Structured Error Responses

```typescript
import { throwRequestError, createRequestError } from "js-kt";

export default createHandler({
    method: "POST",
    handler: (context, body: { email: string }) => {
        if (!body.email) {
            throwRequestError(400, [
                {
                    error: "Email is required",
                    errors: ["email field is missing"]
                }
            ]);
        }

        // Or create errors without throwing
        if (body.email.includes("test")) {
            return context.respond.json(
                createRequestError(422, [
                    { error: "Test emails are not allowed" }
                ])
            );
        }

        return context.respond.json({ success: true });
    },
});
```

### Error Response Format

```json
{
    "statusCode": 400,
    "errors": [
        {
            "error": "Email is required",
            "errors": ["email field is missing"],
            "data": {}
        }
    ]
}
```

---

## 📚 Auto-Generated Documentation

### Automatic API Documentation

With `autoDescribe: true` (default in development), js-kt automatically generates:
- 📄 Markdown documentation for each route
- 🔍 Interactive HTML docs at `/{route-path}/describe`
- 📦 Complete API types JSON at `/__describe-json`

### Accessing Documentation

**Development Mode:**
```bash
# Visit any route with /describe
http://localhost:3000/api/users/describe
```

**Production Mode:**
```bash
# Protected with secret
curl -H "Authorization: Secret your-secret-key" \
  http://localhost:3000/__describe-json
```

### Custom Descriptions

Create `.description.md` files alongside your routes for custom documentation that gets automatically merged with generated types.

---

## ⚙️ Configuration

Create `router.kt.config.ts` in your source directory:

```typescript
import type { RoutingConfig } from "js-kt";

export default {
    // Routes directory
    routerDirectory: "./routes",
    
    // API prefix
    apiPrefix: "/api",
    
    // Server port
    port: 3000,
    
    // CORS configuration
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    },
    
    // Static file directories
    staticDirs: [
        {
            local: "./public",
            remote: "/static",
            middlewares: [] // Optional middleware for static files
        },
    ],
    
    // JSON payload limit
    maxJsonSize: "10mb",
    
    // Auto-generate descriptions in development
    autoDescribe: true,
    
    // Secret for production documentation access
    allDescriptionsSecret: "your-secret-key",
    
    // File patterns
    routerSuffixRegx: "\\.router\\.(?:js|ts)x?$",
    middlewareSuffixRegx: "\\.middleware\\.(?:js|ts)$",
    
    // Types output directory
    typesPlacementDir: "./types",
    
    // Startup scripts directory
    startupDirPath: "./startup",
    
    // Single-threaded mode (false = multi-threaded with clustering)
    runSingle: false,
    
    // Redis configuration (optional, for Socket.IO scaling)
    redisClient: undefined, // Provide your Redis client instance
    socketPrefix: "/socket.io",
    
    // Server timeouts
    keepAliveTimeout: 65000,
    headersTimeout: 66000,
    
    // Maximum worker forks (for multi-threading)
    maxForks: 8,
} satisfies RoutingConfig;
```

---

## 🚀 Startup Scripts

Organize initialization code in the `startup` directory:

```
src/startup/
├── 01-database.run.ts
├── 02-cache.run.ts
└── 03-jobs.run.ts
```

### Startup Script Example

```typescript
// src/startup/01-database.run.ts
import { Application } from "express";
import { connectToDatabase } from "./db";

export const run = async (app: Application) => {
    // Initialize database connection
    await connectToDatabase();
    
    // Add global middleware
    app.use(customMiddleware);
    
    console.log("Database initialized!");
};
```

Startup scripts run in order (based on filename) before the server starts accepting requests.

---

## 🎪 Events System

### Define Events

```typescript
import { defineEmittedEvent } from "js-kt";

// Define event with type-safe payload and response
defineEmittedEvent<{ msg: string }, { reply: string }>("hello");
```

### Emit Events

```typescript
import { emitEvent } from "js-kt";

// Server-side emission
await emitEvent("hello", { msg: "Hello World!" }, (response) => {
    console.log(response.reply); // Fully typed!
});
```

Events are type-safe and work seamlessly with the type generation system.

---

## 📂 Directory Aliases

Create route aliases for flexible path mapping:

```typescript
// src/routes/api.directoryAlias.ts
import { createAlias } from "js-kt";

export default createAlias({
    path: "/api/v1/users",
    includeOriginalMIddlewares: true, // Include middlewares from original routes
});
```

This creates an alias that maps `/api/v1/users/*` routes to your existing user routes.

---

## 🛠️ CLI Commands

### Development

```bash
# Start development server with hot reload
npx kt-cli dev
```

### Production

```bash
# Start production server
npx kt-cli start
```

### Type Generation

```bash
# Generate TypeScript types from your routes
npx kt-cli scan-types
```

### Route Organization

```bash
# Organize routes into directories
npx kt-cli put-routes-in-directories
```

### Configuration

```bash
# Create default configuration file
npx kt-cli create-config
```

---

## 🎯 Complete Example

### Project Structure

```
my-app/
├── src/
│   ├── routes/
│   │   ├── index.router.ts
│   │   ├── auth.middleware.ts
│   │   ├── users/
│   │   │   ├── index.router.ts
│   │   │   ├── [id].router.ts
│   │   │   └── profile.router.ts
│   │   └── chat.router.ts
│   ├── startup/
│   │   └── 01-database.run.ts
│   └── router.kt.config.ts
├── package.json
└── tsconfig.json
```

### Example Routes

**Home Route** (`src/routes/index.router.ts`):
```typescript
import { createHandler } from "js-kt";

export default createHandler({
    method: "GET",
    handler: (context) => {
        return context.respond.json({
            message: "Welcome to js-kt API",
            version: "1.0.0"
        });
    },
});
```

**Users Route** (`src/routes/users/index.router.ts`):
```typescript
import { createHandler } from "js-kt";

interface User {
    id: string;
    name: string;
    email: string;
}

export default createHandler({
    method: "GET",
    handler: (context) => {
        const users: User[] = [
            { id: "1", name: "John Doe", email: "john@example.com" }
        ];
        return context.respond.json(users);
    },
});
```

**User Detail Route** (`src/routes/users/[id].router.ts`):
```typescript
import { createHandler } from "js-kt";
import { throwRequestError } from "js-kt";

export default createHandler({
    method: "GET",
    handler: (context, _body, _query, params: { id: string }) => {
        // Fetch user by ID
        const user = await getUserById(params.id);
        
        if (!user) {
            throwRequestError(404, [{ error: "User not found" }]);
        }
        
        return context.respond.json(user);
    },
});
```

**Chat Channel** (`src/routes/chat.router.ts`):
```typescript
import { defineChannelHandler } from "js-kt";
import type { Respond } from "js-kt";

export const handler = defineChannelHandler((socket) => {
    socket.on('join-room', (roomId: string) => {
        socket.join(roomId);
    });

    return {
        handler(
            body: { message: string; roomId: string },
            respond?: Respond<{ success: boolean }>
        ) {
            socket.to(body.roomId).emit('message', {
                from: socket.id,
                message: body.message
            });

            respond?.({ success: true });
        },
    };
});
```

---

## 🔥 Performance Features

### Built-In Optimizations

- **Pattern Caching**: Compiled route patterns are cached for instant matching
- **O(1) Lookups**: Exact route matches use Map-based lookups
- **Batch Operations**: File operations are batched for efficiency
- **Stat Caching**: File system stats are cached to reduce I/O
- **Middleware Deduplication**: Middleware results are cached per request
- **Cluster Support**: Multi-threading with intelligent load balancing

### Scaling

- **Redis Adapter**: Scale Socket.IO across multiple servers
- **Cluster Adapter**: Built-in support for Socket.IO clustering
- **Worker Management**: Automatic worker spawning and management
- **Connection Pooling**: Efficient resource utilization

---

## 🎨 Type-Safe Client

Use `js-kt-client` for end-to-end type safety:

```bash
npm install js-kt-client
```

```typescript
import { createClient } from 'js-kt-client';

const client = createClient('http://localhost:3000');

// Fully typed API calls with autocomplete!
const users = await client.get('/users');
const user = await client.get('/users/:id', { params: { id: '1' } });
const newUser = await client.post('/users', { 
    body: { name: 'John', email: 'john@example.com' }
});
```

Visit the [js-kt-client repository](https://github.com/almoatamed/js-kt-client) for more information.

---

## 📖 Advanced Features

### Custom Response Types

```typescript
export default createHandler({
    method: "GET",
    handler: (context) => {
        // JSON response
        return context.respond.json({ data: "json" });
        
        // HTML response
        return context.respond.html("<h1>Hello</h1>");
        
        // Text response
        return context.respond.text("Plain text");
        
        // File response
        return context.respond.file("/path/to/file.pdf");
    },
});
```

### Status Codes

```typescript
export default createHandler({
    method: "POST",
    handler: (context) => {
        context.setStatus(201); // Set status code
        return context.respond.json({ created: true });
    },
});
```

### Query Parameters

```typescript
export default createHandler({
    method: "GET",
    handler: (context, _body, query: { page?: number; limit?: number }) => {
        const page = query.page || 1;
        const limit = query.limit || 10;
        
        return context.respond.json({
            page,
            limit,
            data: await fetchData(page, limit)
        });
    },
});
```

---

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for more information.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 🆘 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/almoatamed/js-kt/issues)
- **Documentation**: Check the docs for detailed API reference
- **Community**: Join our community for discussions and support

---

## 🎉 Get Started Today

```bash
npm install js-kt
npx kt-cli create-config
npx kt-cli dev
```

**Build something amazing with js-kt! 🚀**
