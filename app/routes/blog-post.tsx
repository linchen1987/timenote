import { Link, useParams } from "react-router";

export default function BlogPost() {
  const params = useParams();
  const postId = params.id;

  // 模拟博客文章数据
  const posts = {
    "1": {
      title: "Getting Started with React Router v7",
      content: `React Router v7 introduces a new framework mode that combines the best of React Router and Remix. This comprehensive guide will walk you through the new features and how to get started with the latest version.

## Key Features

- **File-based routing**: Configure routes in a central routes.ts file
- **Route modules**: Each route has its own module with loader, action, and component
- **Type safety**: Full TypeScript support with auto-generated types
- **Data loading**: Built-in data loading with suspense boundaries
- **Form handling**: Enhanced form handling with progressive enhancement

## Getting Started

To get started with React Router v7, you can create a new project using the CLI:

\`\`\`bash
npx create-react-router@latest
\`\`\`

This will set up a new project with the recommended structure and configuration.

## Routing Configuration

Routes are configured in the \`routes.ts\` file:

\`\`\`typescript
import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("./home.tsx"),
  route("about", "./about.tsx"),
] satisfies RouteConfig;
\`\`\`

## Route Modules

Each route file exports a default component and optional functions like loader:

\`\`\`typescript
import type { Route } from "./+types/about";

export function meta() {
  return [{ title: "About Page" }];
}

export default function About() {
  return <h1>About Us</h1>;
}
\`\`\`

This makes React Router v7 a powerful choice for building modern web applications.`,
      author: "John Doe",
      date: "2024-01-15"
    },
    "2": {
      title: "Tailwind CSS Best Practices",
      content: `Tailwind CSS has become one of the most popular CSS frameworks for modern web development. Let's explore some best practices to get the most out of this utility-first CSS framework.

## What is Tailwind CSS?

Tailwind CSS is a utility-first CSS framework that provides low-level utility classes to build custom designs directly in your markup. Unlike traditional CSS frameworks like Bootstrap or Foundation, Tailwind doesn't provide pre-built components.

## Best Practices

### 1. Use Components for Repeated Patterns

While Tailwind encourages utility classes, don't repeat the same combinations over and over:

\`\`\`jsx
// Bad - repeating classes
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
  Button 1
</button>
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
  Button 2
</button>

// Good - create a component
function Button({ children, ...props }) {
  return (
    <button 
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      {...props}
    >
      {children}
    </button>
  );
}
\`\`\`

### 2. Use the @apply Directive Wisely

The \`@apply\` directive can be useful for creating custom utility classes:

\`\`\`css
.btn-primary {
  @apply px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600;
}
\`\`\`

### 3. Configure Your Theme

Customize Tailwind's configuration to match your brand:

\`\`\`javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        }
      }
    }
  }
}
\`\`\`

### 4. Use Responsive Design Prefixes

Tailwind provides responsive prefixes for different screen sizes:

\`\`\`jsx
<div className="w-full md:w-1/2 lg:w-1/3">
  Responsive column
</div>
\`\`\`

### 5. Leverage Dark Mode

Tailwind makes dark mode implementation simple:

\`\`\`jsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Dark mode content
</div>
\`\`\`

## Performance Considerations

### 1. Purge Unused CSS

Configure Tailwind to purge unused styles in production:

\`\`\`javascript
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  // ...
}
\`\`\`

### 2. Use JIT Mode (Tailwind CSS v3+)

The Just-In-Time compiler generates styles on demand, resulting in smaller CSS files.

## Conclusion

Tailwind CSS provides a powerful and flexible way to style web applications. By following these best practices, you can create maintainable and efficient stylesheets while taking full advantage of the utility-first approach.`,
      author: "Jane Smith",
      date: "2024-01-10"
    },
    "3": {
      title: "TypeScript Tips and Tricks",
      content: `TypeScript has become an essential tool for building robust JavaScript applications. Here are some tips and tricks to help you write better TypeScript code.

## 1. Use Utility Types Effectively

TypeScript provides several utility types that can make your code more expressive:

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

// Pick only specific properties
type UserWithoutPassword = Pick<User, 'id' | 'name' | 'email'>;

// Omit specific properties
type UserPublicInfo = Omit<User, 'password'>;

// Make all properties optional
type PartialUser = Partial<User>;
\`\`\`

## 2. Use Generic Constraints

When working with generics, you can constrain the types:

\`\`\`typescript
interface Lengthwise {
  length: number;
}

function logLength<T extends Lengthwise>(arg: T): void {
  console.log(arg.length);
}

logLength("hello"); // OK
logLength([1, 2, 3]); // OK
logLength(42); // Error: number doesn't have length
\`\`\`

## 3. Use Conditional Types

Conditional types allow you to create type logic:

\`\`\`typescript
type NonNullable<T> = T extends null | undefined ? never : T;

type ApiResponse<T> = T extends string 
  ? { message: T } 
  : { data: T };
\`\`\`

## 4. Use Mapped Types

Mapped types transform one type into another:

\`\`\`typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

type Optional<T> = {
  [P in keyof T]?: T[P];
};
\`\`\`

## 5. Use Template Literal Types

TypeScript 4.1 introduced template literal types:

\`\`\`typescript
type EventName<T extends string> = \`on\${Capitalize<T>}\`;

type ButtonEvents = EventName<'click' | 'hover'>;
// 'onClick' | 'onHover'
\`\`\`

## 6. Use Type Guards

Type guards help TypeScript narrow down types:

\`\`\`typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function processValue(value: unknown) {
  if (isString(value)) {
    // TypeScript knows value is string here
    return value.toUpperCase();
  }
  return null;
}
\`\`\`

## 7. Use Discriminated Unions

Discriminated unions help model different states:

\`\`\`typescript
type LoadingState = 
  | { status: 'loading' }
  | { status: 'success'; data: string }
  | { status: 'error'; error: string };

function handleState(state: LoadingState) {
  switch (state.status) {
    case 'loading':
      return 'Loading...';
    case 'success':
      return state.data; // TypeScript knows data exists
    case 'error':
      return state.error; // TypeScript knows error exists
  }
}
\`\`\`

## 8. Use Branded Types

Branded types add type safety to primitive types:

\`\`\`typescript
type UserId = string & { readonly brand: unique symbol };
type Email = string & { readonly brand: unique symbol };

function createUser(id: UserId, email: Email) {
  // Implementation
}

// This prevents accidental mixing
const id = '123' as UserId;
const email = 'user@example.com' as Email;
createUser(id, email); // OK
createUser(email, id); // Error - type mismatch
\`\`\`

## Conclusion

These TypeScript tips and tricks can help you write more type-safe, maintainable, and expressive code. The key is to leverage TypeScript's type system to catch errors at compile time rather than runtime.`,
      author: "Bob Johnson",
      date: "2024-01-05"
    }
  };

  const post = posts[postId as keyof typeof posts];

  if (!post) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <nav className="mb-8">
            <Link
              to="/blog"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← Back to Blog
            </Link>
          </nav>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Post Not Found
            </h1>
            <p className="text-gray-700 dark:text-gray-300">
              The blog post with ID "{postId}" could not be found.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <nav className="mb-8">
          <Link
            to="/blog"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Blog
          </Link>
        </nav>
        
        <article className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {post.title}
            </h1>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span>{post.author}</span>
              <span className="mx-2">•</span>
              <span>{post.date}</span>
            </div>
          </header>
          
          <div className="prose prose-lg dark:prose-invert max-w-none">
            {post.content.split('\n').map((paragraph, index) => {
              if (paragraph.startsWith('## ')) {
                return (
                  <h2 key={index} className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">
                    {paragraph.replace('## ', '')}
                  </h2>
                );
              } else if (paragraph.startsWith('# ')) {
                return (
                  <h1 key={index} className="text-3xl font-bold text-gray-900 dark:text-white mt-8 mb-4">
                    {paragraph.replace('# ', '')}
                  </h1>
                );
              } else if (paragraph.startsWith('### ')) {
                return (
                  <h3 key={index} className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                    {paragraph.replace('### ', '')}
                  </h3>
                );
              } else if (paragraph.startsWith('```')) {
                const code = paragraph.replace('```', '');
                return (
                  <pre key={index} className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto my-4">
                    <code className="text-sm text-gray-800 dark:text-gray-200">{code}</code>
                  </pre>
                );
              } else if (paragraph.startsWith('- ')) {
                return (
                  <li key={index} className="ml-4 text-gray-700 dark:text-gray-300 mb-2">
                    {paragraph.replace('- ', '')}
                  </li>
                );
              } else if (paragraph.trim() === '') {
                return <div key={index} className="h-4"></div>;
              } else {
                return (
                  <p key={index} className="text-gray-700 dark:text-gray-300 mb-4">
                    {paragraph}
                  </p>
                );
              }
            })}
          </div>
        </article>
      </div>
    </main>
  );
}