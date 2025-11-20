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

- **Bun Adapter**: Optional high-performance Bun runtime for exceptional speed and lower latency.
- **Optimized Routing**: O(1) lookups, pattern caching, and intelligent route matching.
- **Multi-Threading**: Built-in cluster support with intelligent worker scaling for maximum CPU utilization.
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

```txt
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

#### Under the Hood: Type Scanner

The background type scanner (`server/utils/typesScanner/server.ts`) keeps generation blazing fast even in large repos:

- An Express worker listens on port `3751` and batches requests (`/process`) so repeated triggers collapse into a single run.
- Every route file is hashed (`sha256`) and tracked; the scanner reuses a cached `ts.SourceFile` map and only re-creates the program when the file set or contents change.
- When a file changes or is deleted, matching `.description.md` artifacts are removed before `useContextToProcessTypes` reprocesses the minimal invalidated list—no stale docs survive.
- Because change detection happens before the expensive compiler work, full rescans only occur when the route graph actually changes, keeping dev feedback near-instant even with thousands of files.

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

### Source-Aware Handlers

Handlers can detect how a request arrived and use transport-specific helpers exposed by `HandlerContext` (`server/utils/router/index.ts`):

```typescript
import { createHandler } from "js-kt";

export default createHandler({
    method: "GET",
    handler: (context) => {
        if (context.servedVia === "http") {
            context.setHeader("x-powered-by", "js-kt");
            context.sourceStream; // Raw Node stream if you need it
            return context.respond.text("Hello HTTP!");
        }

        // Socket invocation carries the actual socket instance
        context.socket.emit("audit", { route: context.fullPath });
        return context.respond.json({ via: "socket", id: context.socket.id });
    },
});

```

This makes it trivial to branch logic, attach extra headers, or tap into the live `Socket` instance without duplicating handlers.

---

## 🎭 Middleware System

### Directory-Based Middleware

Middleware is automatically applied based on directory structure:

```txt
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
    
    // HTTP adapter: "bun" (recommended) or "express"
    // If not specified, automatically uses Bun if available, otherwise Express
    httpAdapter: "bun",
    
    // Single-threaded mode (false = multi-threaded with clustering)
    runSingle: false,
    
    // Maximum worker forks (for multi-threading)
    // Default: 6, or based on CPU count and available memory
    getMaxForks: async () => 8,
    
    // Redis configuration (optional, for Socket.IO scaling)
    redisClient: undefined, // Provide your Redis client instance
    socketPrefix: "/socket.io",
    
    // Server timeouts
    keepAliveTimeout: 65000,
    headersTimeout: 66000,
} satisfies RoutingConfig;
```

---

## 🚀 Startup Scripts

Organize initialization code in the `startup` directory:

```txt
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

```txt
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

## 📊 Performance Benchmarks

### Real-World Performance Metrics

We've benchmarked js-kt against popular server frameworks to measure real-world performance. The results speak for themselves—js-kt's dual-protocol architecture delivers **2-3x higher throughput** when leveraging WebSocket transport.

### Test Environment

All benchmarks ran on:
- **CPU**: Intel Xeon E3-1535M v6 @ 3.10GHz (4 cores, 8 threads)
- **Memory**: 32GB DDR4 @ 2400MHz
- **Runtime**: Bun 1.0+
- **Method**: Worker thread-based concurrent load testing (125,000 requests per worker)

### Benchmark Results

| Client Type | Bun Server | Express Server | KT Server (Bun) | KT Server (Express) |
|------------|------------|----------------|-----------------|---------------------|
| **Axios** | 10,000 req/s | 7,000 req/s | 10,000 req/s | 7,000 req/s |
| **Fetch** | 25,000 req/s | 19,000 req/s | 25,000 req/s | 19,000 req/s |
| **KT Auto (Dual)** | 25,000 req/s | 19,000 req/s | **57,000 req/s** ⚡ | **55,000 req/s** ⚡ |

### Key Insights

🚀 **Dual-Protocol Magic**: When using `js-kt-api-client` with automatic transport selection (`KT Auto`), js-kt leverages WebSocket transport for optimal performance, delivering **2.2-3x better throughput** compared to traditional HTTP-only servers.

⚡ **Adapter Parity**: js-kt maintains performance parity with native Bun and Express servers when using standard HTTP clients, ensuring you get the same performance with added framework benefits.

🎯 **Smart Transport Selection**: The `KT Auto` client intelligently uses WebSocket transport when available, automatically falling back to HTTP when needed—all while maintaining full type safety.

### Benchmark Methodology

Benchmarks use a worker thread-based approach with concurrent clients:

```typescript
// Each worker runs multiple concurrent requests
const promises = [];
for (let i = 0; i < numberOfRequestsPerClient; i++) {
    promises.push(client.api.get("/"));
}
await Promise.all(promises);
```

**Sample Server Implementation**:

```typescript
// Simple js-kt route used in benchmarks
export default createHandler({
    method: "GET",
    serveVia: ["Http", "Socket"], // Dual-protocol support
    handler: async (context) => {
        return context.respond.json({
            msg: "Ok"
        });
    },
});
```

**Note**: Multi-threaded benchmarks show similar performance characteristics, with js-kt's cluster support scaling linearly across workers. Single-threaded results shown above demonstrate per-core efficiency.

---

## ⚡ HTTP Adapters

js-kt supports multiple HTTP adapters, allowing you to choose the best runtime for your performance needs.

### Bun Adapter (Recommended)

The **Bun adapter** leverages Bun's native `serve` API for exceptional performance. When available, it provides:

- **Native Performance**: Direct integration with Bun's high-performance HTTP server
- **Lower Latency**: Reduced overhead compared to traditional Node.js servers
- **Memory Efficiency**: Optimized memory usage for better resource utilization
- **Automatic Detection**: js-kt automatically detects Bun and uses it by default

**Configuration:**

```typescript
export default {
    httpAdapter: "bun", // or "express"
    // ... other config
} satisfies RoutingConfig;
```

**Note**: If Bun is not installed, js-kt will automatically fall back to Express with a warning.

### Express Adapter

The **Express adapter** provides compatibility with the standard Node.js ecosystem:

- **Universal Compatibility**: Works on any Node.js runtime
- **Mature Ecosystem**: Access to the full Express middleware ecosystem
- **Production Proven**: Battle-tested in countless production deployments

**Configuration:**

```typescript
export default {
    httpAdapter: "express", // explicit Express mode
    // ... other config
} satisfies RoutingConfig;
```

### Adapter Selection Logic

js-kt intelligently selects the adapter based on:

1. Your explicit `httpAdapter` configuration
2. Whether Bun is installed and available
3. Automatic fallback to Express if Bun is unavailable

```typescript
// Priority order:
// 1. Explicit config: httpAdapter: "bun" or "express"
// 2. Auto-detect: If Bun is installed → use Bun
// 3. Fallback: Use Express if Bun unavailable
```

---

## 🔄 Multi-Threading & Clustering

js-kt includes built-in support for multi-threaded operation using Node.js cluster module, enabling you to fully utilize multi-core systems for maximum performance.

### How It Works

**Primary Process (Master):**

- Initializes the cluster and manages worker processes
- Runs startup scripts **before** workers start (ensuring DB connections, etc. are ready)
- Forks worker processes based on system resources and configuration
- Coordinates worker lifecycle and handles graceful shutdown
- Automatically restarts crashed workers

**Worker Processes:**

- Each worker runs an independent server instance
- Workers wait for the primary to complete startup before accepting requests
- Load is distributed across all workers automatically
- Each worker can handle requests independently

### Configuration

Control multi-threading behaviour in your `router.kt.config.ts`:

```typescript
export default {
    // Enable multi-threading (false = multi-threaded, true = single-threaded)
    runSingle: false,
    
    // Maximum number of worker processes to fork
    // Default: 6, or based on CPU count and available memory
    getMaxForks: async () => 8,
    
    // ... other config
} satisfies RoutingConfig;
```

### Intelligent Worker Scaling

js-kt automatically calculates the optimal number of workers based on:

```typescript
// Worker count formula:
Math.min(
    numberOfCPUs,           // System CPU cores
    Math.floor(mem / 0.5),   // Available memory (GB / 0.5GB per worker)
    maxForks                 // Your configured maximum
)
```

**Example**: On an 8-core system with 16GB RAM:

- CPU cores: 8
- Memory-based: floor(16 / 0.5) = 32 workers
- With `maxForks: 8`: Result = **8 workers**

### Single-Threaded Mode

For development or resource-constrained environments:

```typescript
export default {
    runSingle: true, // Disable clustering
    // ... other config
} satisfies RoutingConfig;
```

**When Single-Threaded Mode is Auto-Enabled:**

- System has only 1 CPU core
- Available memory is less than 0.5GB per worker
- You explicitly set `runSingle: true`

### Clustering with Bun

When using the Bun adapter with multi-threading:

```typescript
// Bun automatically uses reusePort for clustering
serve({
    reusePort: true,  // Enabled automatically in multi-threaded mode
    port: 3000,
    // ... other options
});
```

This allows multiple Bun processes to listen on the same port, with the OS kernel handling load balancing.

### Clustering with Express

When using the Express adapter with multi-threading:

- Each worker runs its own Express server instance
- Node.js cluster module handles process management
- Socket.IO uses cluster adapter for WebSocket scaling across workers
- Redis adapter (if configured) enables cross-server WebSocket communication

### Worker Lifecycle

1. **Initialization**: Primary process forks workers based on system resources
2. **Startup Coordination**:
   - Primary runs startup scripts (database seeds, cache, etc.)
   - Workers wait in a ready state
   - Primary signals workers to start after initialization
3. **Request Handling**: Workers independently handle incoming requests
4. **Failure Recovery**: If a worker crashes, a new one is automatically forked
5. **Graceful Shutdown**: All workers are terminated cleanly on process exit

### Production Recommendations

**For High-Traffic Applications:**

```typescript
export default {
    runSingle: false,
    getMaxForks: async () => {
        // Match your CPU cores for optimal performance
        const os = await import("os");
        return os.cpus().length;
    },
    httpAdapter: "bun", // Use Bun for best performance
    // ... other config
} satisfies RoutingConfig;
```

**For Development:**

```typescript
export default {
    runSingle: true, // Simpler debugging, faster startup
    // ... other config
} satisfies RoutingConfig;
```

**For Memory-Constrained Environments:**

```typescript
export default {
    runSingle: false,
    getMaxForks: async () => 2, // Limit workers to conserve memory
    // ... other config
} satisfies RoutingConfig;
```

### Monitoring & Debugging

- Each worker logs its PID for easy identification
- Primary process logs worker lifecycle events
- Worker crashes are automatically logged with exit codes
- Use process managers (PM2, systemd) for production monitoring

---

## 🎨 Type-Safe Client

`kt-client` is the official, type-safe bridge between your js-kt server and every JavaScript runtime. It marries a CLI that keeps your API contract fresh with a runtime client that speaks HTTP and Socket.IO using the exact same types.

### ⭐ Highlights

- **Server-Sourced Types**: Pull live route, channel, and event signatures straight from your running server.
- **Unified Transport**: Share configuration across HTTP and Socket.IO with identical method signatures.
- **Production-Ready UX**: Token hooks, scoped access, caching, and reconnection helpers built in.

### 🚀 Setup in Minutes

1. Install the package:

   ```bash
   npm install js-kt-api-client
   # or
   bun add js-kt-api-client
   ```

2. (Optional) add overrides to `package.json`:

   ```jsonc
   {
       "apiTypes": {
           "baseUrl": "http://localhost:3000",
           "apiPrefix": "/api",
           "scope": "dashboard"
       }
   }
   ```

3. Generate fresh types whenever the backend contract changes:

   ```bash
   npx kt-client load-types
   # short alias
   npx kt-client l
   ```

   The CLI discovers your project root, calls `/__describe-json`, and writes `apiTypes.d.ts`. Export `DESCRIPTION_SECRET` before running if your describe endpoint is protected.

### 🧰 Runtime Client Overview

```typescript
import createClient, { createWebStorage } from "kt-client";

const kt = createClient({
    baseUrl: "http://localhost:3000",
    getToken: () => process.env.USER_TOKEN,
    storage: createWebStorage(), // opt-in caching helper
});

const users = await kt.api.get("users/profile", {
    params: { includeStats: true },
});

const ack = await kt.socket.asyncEmit("chat/message", {
    roomId: "general",
    message: "Hello from kt-client!",
});

await kt.close();
```

- **`api`**: http client that respects generated route types and supports `requestVia` to pin HTTP or socket transports (by default if available will use socket for better performance).
- **`socket`**: Typed `asyncEmit`, `on`, and `off` helpers with acknowledgements and smart reconnection.
- **Lifecycle helpers**: `reloadConfig()` swaps runtime options on the fly, `close()` tears everything down cleanly.

### 🧊 Smart Caching & Transport Control

- Provide `createWebStorage()` (or your own storage) and use `sinceMins`, `now`, or `noCaching` to control reuse windows.
- HTTP calls opportunistically reuse the socket transport; fall back or force HTTP with `requestVia: ["http"]` or `httpOnly`.

### 🔄 Keep Types Fresh

- Re-run `npx kt-client load-types` after backend changes or wire it into `postinstall`/CI scripts.
- Include `apiTypes.d.ts` in your TypeScript config so editors pick up the generated definitions automatically.

read the full docs on <https://github.com/almoatamed/js-katana-api-client>

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

### Streaming FormData Uploads

`createFormDataHandler` (`server/utils/multipartProcessor/index.ts`) turns any route into a zero-copy multipart endpoint: it parses boundaries manually, writes file parts to temp files via streams (respecting per-field, per-file, and total size limits), and exposes a typed `context.files` map while merging simple fields back into `context.body`. Because writes happen directly to disk with backpressure support, uploads stay memory-safe even for multi-gig payloads.

```typescript
// src/routes/index.router.ts
import path from "path";
import { createFormDataHandler } from "js-kt";

export default createFormDataHandler({
    method: "POST",
    handler: async (context) => {
        for (const field in context.files) {
            for (const file of context.files[field]) {
                await file.move(path.join(import.meta.dirname, "./uploads"));
            }
        }

        return context.respond.json({ stored: true, fields: context.body });
    },
});
```

Each file entry includes `fileName`, `mimeType`, `size`, a temporary `path`, and a `move` helper you can point at your permanent storage directory.

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
