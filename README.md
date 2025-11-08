# js-kt

A modern, type-safe Node.js framework for building scalable web servers with built-in support for HTTP routing, WebSocket channels, event-driven communication, and automatic type generation. Inspired by file-based routing patterns, js-kt simplifies server development with TypeScript-first design.

## Features

- **File-Based Routing**: Define routes, channels, and events directly in your file system structure.
- **Type-Safe**: Full TypeScript support with automatic type generation from your handlers.
- **WebSocket Channels**: Built-in support for real-time communication via Socket.IO.
- **Event System**: Define and emit events with type-safe payloads.
- **Dual Protocol Support**: Routes can be served via both HTTP and WebSocket connections using the `serveVia` property.
- **CLI Tools**: Powerful command-line interface for development, building, and maintenance.
- **Auto-Generated Documentation**: Generate Markdown documentation for your API endpoints.
- **Flexible Configuration**: Customize routing, middleware, and more via config files.
- **Startup Scripts**: Organize and run initialization code easily.
- **Type-Safe API Client**: Use `js-kt-client` for fully type-safe API interactions with autocomplete and performance optimizations. Visit the [js-kt-client repository](https://github.com/almoatamed/js-kt-client) for more information.

## Installation

### Prerequisites

- Node.js 18+ or Bun
- TypeScript 5+

### Install js-kt

```bash
npm install js-kt
# or
bun add js-kt

## Quick Start
```

#### 1. **Create a new project:**

```bash
mkdir my-js-kt-app
cd my-js-kt-app
npm init -y
npm install js-kt # plus peer dependencies
```

#### 2. **Set up your project structure:**

```txt
my-js-kt-app/
├── src/
│   ├── routes/
│   │   └── index.router.ts
│   └── router.kt.config.ts
├── package.json
└── tsconfig.json
```

#### 3. **Create your first route** (`src/routes/index.router.ts`)

```typescript
import { createHandler } from "js-kt";

export default createHandler({
    method: "GET",
    handler: (context) => {
        return context.respond.json({ message: "Hello, js-kt!" });
    },
});
```

#### 4. **Create configuration** (`src/router.kt.config.ts`)

use the command `npx kt-cli create-config` or create it manually

you dont have to create it but it will come handy to define many things and configure them to your needs.

```typescript
import type { RoutingConfig } from "js-kt";

export default {
    // Configuration options will be detailed later
} satisfies RoutingConfig;
```

#### 5. **Run the server:**

```bash
npx kt-cli dev
```

Your server will start at `http://localhost:3000` with the route available at `/`.

## Configuration

Create a `router.kt.config.ts` file in your source directory to configure js-kt.

### Basic Configuration

```typescript
import type { RoutingConfig } from "js-kt";

export default {
    // Directory where routes are located (relative to config file)
    routerDirectory: "./routes",

    // API prefix for all routes
    apiPrefix: "/api",

    // Port to run the server on
    port: 3000,

    // CORS options
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
    },

    // Static file directories
    staticDirs: [
        {
            local: "./public",
            remote: "/static",
        },
    ],

    // Maximum JSON payload size
    maxJsonSize: "10mb",

    // Auto-generate descriptions in development
    autoDescribe: true,

    // Secret for accessing description endpoints in production
    allDescriptionsSecret: "your-secret-key",

    // File suffixes for different components
    routerSuffixRegx: "\\.router\\.(?:js|ts)x?$",
    descriptionSuffixRegx: "\\.description\\.[a-zA-Z]{1,10}$",
    middlewareSuffixRegx: "\\.middleware\\.(?:js|ts)$",
    directoryAliasSuffixRegx: "\\.directoryAlias\\.(?:js|ts)$",

    // Description file prefix
    descriptionPreExtensionSuffix: ".description",

    // Types placement directory
    typesPlacementDir: "./types",

    // Startup directory
    startupDirPath: "./startup",

    // Threading mode (single or multi)
    runSingle: true,
} satisfies RoutingConfig;
```

## Routing

js-kt uses file-based routing. Create `.router.ts` files in your routes directory to define HTTP endpoints.

### Basic Route

```typescript
import { createHandler } from "js-kt";

export default createHandler({
    method: "GET",
    serveVia: ["Http"], // Can be "Http", "Socket", or both ["Http", "Socket"]
    handler: (context, body, query, params, headers) => {
        // context: HandlerContext
        // body: Request body (parsed JSON)
        // query: Query parameters
        // params: URL parameters
        // headers: Request headers

        return context.respond.json({ success: true });
    },
});
```

**Note:** Routes can be served via both HTTP and WebSocket connections. Configure this using the `serveVia` property, which accepts an array of `"Http"`, `"Socket"`, or both. This allows the same route logic to work seamlessly across different transport protocols.

### Route with Type Definitions

type of response body will be inferred automatically form you response, for example hera the response will be `{ message: string; user: RequestBody }`

if you have `autoDescribe` (which is on by default) it will automatically be described into the types json and its own markdown file that can be accessed on the `<route-path>/describe` on the server

additionally you only have to specify the body type or what matters to you to be inferred correctly

same can be applied for `channelHandlers` definitions

```typescript
import { createHandler } from "js-kt";

interface RequestBody {
    name: string;
    age: number;
}

interface ResponseData {
    message: string;
    user: RequestBody;
}

export default createHandler({
    method: "POST",
    handler: (
        context,
        body: RequestBody,
        query: { debug?: boolean }, // for example only define what you need
        params: { id: string },
        headers
    ) => {
        /**
         * type of response body will be inferred automatically form you response; 
         * for example hera the response will be `{ message: string; user: RequestBody }`
         * 
         * if you have `autoDescribe` (which is on by default) it will automatically be described into the types json and its own markdown file that can be accessed on the <route-path>/describe on the server
         */
        return context.respond.json({
            message: `Hello ${body.name}!`,
            user: body,
        });
    },
});
```

### Route Methods

Supported HTTP methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`, `HEAD`, `ALL`.

### Dynamic Routes

Create folders for dynamic segments:

```txt
routes/
├── users/
│   ├── index.router.ts      # GET /users
│   └── details.router.ts      
└── posts/
    └── details/
        └── comments.router.ts
```

### Middleware

Create `.middleware.ts` files in your routes directory:

```typescript
import { createHandler } from "js-kt";

export default defineMiddleware(async (context, body, query, params, headers) => {
    // Authentication logic
    const authHeader = headers.authorization;
    if (!authHeader) {
        // this method wil throw proper error
        throwRequestError(401, "Missing auth header"); // respond directly 
    } 

    // Add user to context
    context.locals.user = { id: 123 };
});
```

## Channels (WebSocket)

js-kt provides built-in WebSocket support via Socket.IO for real-time communication.

### Defining a Channel Handler

```typescript
import { defineChannelHandler } from "js-kt";
import type { Respond } from "js-kt";

export const handler = defineChannelHandler((socket) => {
    console.log("Client connected:", socket.id);

    return {
        handler(
            body: { message: string },
            respond?: Respond<{ reply: string }>
        ) {
            console.log("Received:", body.message);

            respond?.({
                reply: `Echo: ${body.message}`,
            });
        },
    };
});
```

### Channel File Structure

Channels are defined in the same directory structure as routes, using `.router.ts` files that export a `handler` constant.

### Client-Side Usage

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.emit('message', { message: 'Hello Server!' });

socket.on('reply', (data) => {
    console.log(data.reply); // "Echo: Hello Server!"
});
```

For a superior development experience, use the official `js-kt-client` library which provides:

- **Full Type Safety**: Autocomplete and type checking for all API interactions
- **Adaptive Transport**: Automatically switches between HTTP and WebSocket based on route configuration
- **Performance Optimizations**: Intelligent caching and connection management
- **Seamless Integration**: Works with all js-kt features out of the box

Visit the [js-kt-client repository](https://github.com/almoatamed/js-kt-client) for installation and usage instructions.

## Events

Define events that can be emitted from your server or client.

### Defining an Event

```typescript
import { defineEmittedEvent } from "js-kt";

defineEmittedEvent<
    { msg: string },      // Event body type
    { reply: string }     // Expected response type
>("hello");
```

### Emitting Events

```typescript
import { emitEvent } from "js-kt";

// Server-side emission
await emitEvent("hello", { msg: "Hello World!" }, (response) => {
    console.log(response.reply);
});
```

## CLI Commands

js-kt comes with a powerful CLI for development and maintenance.

### Development Server

```bash
npx kt-cli dev
```

Starts the server in development mode with hot reloading.

### Production Server

```bash
npx kt-cli start
```

Starts the server in production mode.

### Type Scanning

```bash
npx kt-cli scan-types
```

Scans your routes and generates TypeScript types in `./types/apiTypes.json`.
and also generate `*.md` description files for each route.

### Organize Routes

```bash
npx kt-cli put-routes-in-directories
```

Moves route files into their own directories (e.g., `user.router.ts` → `user/index.router.ts`).

### Create Config

```bash
npx kt-cli create-config
```

Creates a default `router.kt.config.ts` file.

## Type Generation

js-kt can automatically generate TypeScript types from your route definitions.

### Generated Types

After running `scan-types`, you'll get:

- routes types
  - Request body types
  - Query parameter types
  - URL parameter types
  - Response types
  - Header types

- emitted events types
  - body types, emitted body
  - expected reply types, if expected a response and what that response could be

- channels types (listened on events)
  - body types, expected body
  - reply types, if the server will reply and what the reply will be (body)

## Auto-Generated Documentation

js-kt can generate Markdown documentation for your API.

### Description Files

Create `.description.md` files alongside your route files:

```markdown
<!-- --start-- / -->

# Route Description 
No description Text Provided

## Route Path: 
/

## Route Method:
GET




## route Request Headers type definition:
type RequestHeader = unknown

## route Request Params type definition
type RequestQueryParams = unknown

## route Request Body type definition

type RequestBody = {
  msg: "Hello, World!"
}

## Response Content Mimetype

application/json

## Response Content Type Definition

type Response = string

<!-- --end-- / -->

<!-- --start--event-- hello -->

## Event Description

No description Text Provided

## Event

hello

## Event Body type definition

type EventBody = {
  msg: string
}

## Expected Response Content Type Definition

type ExpectedResponseBody = {
  reply: string
}

<!-- --end--event-- hello -->
```

### Accessing Descriptions

- In development: Visit `/describe` on any route
- JSON API: `/__describe-json` (requires secret in production if configured)

## Startup Scripts

Organize initialization code in the `startup` directory.

### Startup File Structure

```txt
src/
└── startup/
    ├── 01-seed.run.ts
    ├── 02-cache.run.ts
    └── 03-jobs.run.ts
```

### Startup Script Example

```typescript
// 01-database.run.ts
import { Application } from "express";

export const run = async (app: Application) => {
    // Initialize database connection
    await connectToDatabase();

    // Add database middleware
    app.use(databaseMiddleware);
};
```

## Examples

### Complete API Example

**Project Structure:**

```txt
src/
├── routes/
│   ├── index.router.ts
│   ├── users/
│   │   ├── isAuthorized.middleware.ts      
│   │   ├── index.router.ts
│   │   └── id.router.ts
│   ├── auth.router.ts
│   │    
│   └──chat.router.ts
│
├── startup/
│   └── database.run.ts
│
└── router.kt.config.ts
```

**Route Examples:**

```typescript
// src/routes/index.router.ts
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

```typescript
// src/routes/users/index.router.ts
import { createHandler } from "js-kt";

export default createHandler({
    method: "GET",
    handler: (context) => {
        // Return list of users
        return context.respond.json([
            { id: 1, name: "John Doe", email: "john@example.com" }
        ]);
    },
});
```

```typescript
// src/routes/users/id.router.ts
import { createHandler } from "js-kt";

export default createHandler({
    method: "GET",
    handler: (context, _body, query: { id: string }) => {
        const userId = parseInt(query.id);
        // Fetch user by ID
        return context.respond.json({ id: userId, name: "John Doe", email: "john@example.com" });
    },
});
```

**Channel Example:**

```typescript
// src/routes/chat.router.ts
import { type Respond,  defineChannelHandler } from "js-kt";



export const handler = defineChannelHandler((socket) => {
    // this listener can be defined here but it can be defined into the before-mounted interceptor for better code and concern separation
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
    });

    return {
        handler(
            body: { message: string; roomId: string },
            respond: Respond<{success}>,
        ) {
            // Broadcast to room
            socket.to(body.roomId).emit('message', {
                from: socket.id,
                message: body.message
            });

            respond?.({ success: true });
        },
    };
});


```

**Event Example:**

```typescript
// src/routes/notifications.router.ts
import { defineEmittedEvent, emitEvent } from "js-kt";

defineEmittedEvent<{ title: string; body: string }, { sent: boolean }>("notification");

export default createHandler({
    method: "POST",
    handler: async (context, body: { userId: string; title: string; body: string }) => {
        // Send notification
        await emitEvent("notification", {
            title: body.title,
            body: body.body
        });

        return context.respond.json({ sent: true });
    },
});
```

## Advanced Features

### Directory Aliases

Create `.directoryAlias.ts` files to alias route directories:

```typescript
import { RouterAlias } from "js-kt";

const alias: RouterAlias = {
    path: "/api/v1/users",
    includeOriginalMiddlewares: true,
};

export default alias;
```

### Custom Middleware

```typescript
// src/routes/auth.middleware.ts
import { createHandler } from "js-kt";

export default createMiddleware( (context, body, query, params, headers) => {
    const token = headers.authorization?.replace('Bearer ', '');
    if (!token) {
        throwUnauthorizedError("No token provided");

        // or 

        throw createRequestError(401, "Unauthorized")    
    }

    // Verify token and set user
    context.locals.user = verifyToken(token);    
});
```

### Error Handling

js-kt provides built-in error handling. Throw errors in your handlers:

```typescript
export default createHandler({
    method: "POST",
    handler: (context, body) => {
        if (!body.email) {
            throw createRequestError(400, "Email is required");
        }

        // Handler logic
    },
});
```

### Context Extensions

Extend the handler locals context with custom properties:

```typescript
declare module "js-kt" {
    interface Locals {
        user?: {
            id: number;
            role: string;
        };
    }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/almoatamed/js-kt/issues)
- Documentation: [Full API Reference](https://your-docs-site.com)
