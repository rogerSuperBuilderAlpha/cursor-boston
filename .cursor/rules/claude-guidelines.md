# Claude Guidelines for Cursor Boston

This document provides context and guidelines for AI assistants working on the Cursor Boston website.

## Project Overview

Cursor Boston is a community website for Cursor users in the Boston area. Built with:
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Firebase** (Authentication + Firestore)

## Architecture

```
app/
├── (auth)/           # Auth pages (login, signup, profile)
├── about/            # About page
├── blog/             # Blog listing and [slug] pages
├── events/           # Events listing and request form
├── talks/            # Talks listing and submit form
├── globals.css       # Global styles and CSS variables
├── layout.tsx        # Root layout with AuthProvider
└── page.tsx          # Homepage

components/
├── Navigation.tsx    # Header with responsive mobile menu
└── Footer.tsx        # Site footer with links

contexts/
└── AuthContext.tsx   # Firebase auth context provider

lib/
├── blog.ts           # Blog post utilities (markdown parsing)
├── firebase.ts       # Firebase configuration
└── submissions.ts    # Form submission handlers

content/
├── blog/             # Markdown blog posts
├── events.json       # Event data
└── talks.json        # Talk data
```

## Design System

### Color Tokens

| Purpose | Class | Hex |
|---------|-------|-----|
| Background | `bg-black` | #000000 |
| Surface | `bg-neutral-900` | #171717 |
| Alt Surface | `bg-neutral-950` | #0a0a0a |
| Border | `border-neutral-800` | #262626 |
| Primary text | `text-white` | #ffffff |
| Secondary text | `text-neutral-300` | #d4d4d4 |
| Tertiary text | `text-neutral-400` | #a3a3a3 |
| Muted text | `text-neutral-500` | #737373 |
| Brand accent | `emerald-500` | #10b981 |
| Discord brand | `#5865F2` | |

### Component Patterns

**Primary Button:**
```tsx
<button className="px-6 py-3 md:px-8 md:py-4 bg-emerald-500 text-white rounded-lg text-base font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
  Button Text
</button>
```

**Card:**
```tsx
<div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 hover:border-neutral-700 transition-colors">
  {/* content */}
</div>
```

**Badge:**
```tsx
<span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 text-sm font-medium rounded-full">
  Badge Text
</span>
```

### Accessibility Requirements

1. **All interactive elements must have focus states** using `focus-visible:` classes
2. **External links** need `aria-label="... (opens in new tab)"`
3. **Mobile menu** needs `aria-expanded`, `aria-controls`, and dynamic `aria-label`
4. **Form errors** need `aria-invalid` and `aria-describedby`
5. **Decorative icons** need `aria-hidden="true"`

## Code Standards

### TypeScript

- Use strict types, avoid `any`
- Define interfaces for form data, API responses
- Use type guards for error handling

### React Patterns

- Use React Server Components where possible
- Client components only when needed (interactivity, hooks)
- Use `"use client"` directive at file top

### Form Handling

```tsx
// Pre-fill from user profile
useEffect(() => {
  if (user) {
    const userName = user.displayName || userProfile?.displayName || "";
    setFormData((prev) => ({
      ...prev,
      email: prev.email || user.email || "",
      name: prev.name || userName,
    }));
  }
}, [user, userProfile]);

// Trim inputs before submit
const trimmedData = {
  ...formData,
  name: formData.name.trim(),
  email: formData.email.trim(),
};

// Pass userId for tracking
await submitFunction(trimmedData, user?.uid);
```

### Firebase Error Handling

```tsx
function getErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  
  if (message.includes("auth/invalid-credential")) {
    return "Invalid email or password. Please try again.";
  }
  // ... more mappings
  
  return "Something went wrong. Please try again.";
}
```

### Security

1. **XSS Prevention** - Escape HTML in email templates:
```tsx
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

2. **Firestore Rules** - Require auth for writes:
```
match /talkSubmissions/{id} {
  allow create: if request.auth != null;
}
```

## External Services

- **Firebase**: Auth (Email, Google, GitHub) + Firestore
- **Luma**: Event calendar (lu.ma/cursor-boston)
- **Discord**: Community chat (discord.gg/Wsncg8YYqc)

## Common Tasks

### Adding a new page

1. Create `app/[route]/page.tsx`
2. Add metadata export for SEO
3. Follow section spacing patterns (`py-16 md:py-24 px-6`)
4. Add to Navigation if needed
5. Add to Footer if appropriate

### Adding a form

1. Create form state with `useState`
2. Add pre-fill effect from `useAuth()`
3. Add unsaved changes warning
4. Create submission handler in `lib/submissions.ts`
5. Map Firebase errors to friendly messages
6. Add loading states and success/error UI

### Updating styles

1. Check `.cursor/rules/ui-ux-guidelines.mdc` for patterns
2. Maintain consistency with existing components
3. Always add focus states for accessibility
4. Test responsive behavior (mobile, tablet, desktop)

## Testing Checklist

- [ ] All buttons have visible focus states
- [ ] External links have aria-labels
- [ ] Forms show friendly error messages
- [ ] Mobile navigation works correctly
- [ ] Pages load without console errors
- [ ] Authentication flows complete properly
- [ ] Form submissions reach Firestore
