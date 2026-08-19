# UI primitives

Diátaxis: Reference.

Usage examples and prop descriptions for the shared components in
[`components/ui/`](../components/ui/). These are the building blocks other
features compose — check here before writing a one-off input, modal, or
loading state.

## FormInput, FormTextarea, ToggleSwitch

Source: [`components/ui/FormField.tsx`](../components/ui/FormField.tsx)

Three small form primitives. `FormInput` and `FormTextarea` share the same
label/error layout; `ToggleSwitch` is a styled checkbox.

### `FormInput`

Wraps a native `<input>` with an optional label and error message. Extends
`InputHTMLAttributes<HTMLInputElement>`, so any native input prop (`type`,
`placeholder`, `value`, `onChange`, ...) passes through.

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Required. Used for the `<label htmlFor>` / `<input id>` pairing and to derive the error message's id. |
| `label` | `string?` | Text rendered above the input. Omit to render an unlabeled input (e.g. when a visually-hidden label is provided elsewhere). |
| `error` | `string \| null?` | When set, renders red error text below the input and wires `aria-describedby` to it. |

```tsx
import { FormInput } from "@/components/ui/FormField";

<FormInput
  id="email"
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={emailError}
/>
```

### `FormTextarea`

Same shape as `FormInput`, for multi-line text. Extends
`TextareaHTMLAttributes<HTMLTextAreaElement>`. Defaults `rows` to `3`.

```tsx
import { FormTextarea } from "@/components/ui/FormField";

<FormTextarea
  id="bio"
  label="Bio"
  rows={5}
  value={bio}
  onChange={(e) => setBio(e.target.value)}
/>
```

### `ToggleSwitch`

A styled checkbox rendered as a track-and-thumb switch.

| Prop | Type | Description |
|---|---|---|
| `checked` | `boolean` | Required. Current on/off state. |
| `onChange` | `(checked: boolean) => void` | Required. Called with the new state on toggle. |
| `size` | `"sm" \| "md"` | Defaults to `"sm"`. `"md"` is a larger track. |
| `label` | `string?` | Accessible label read by screen readers (the switch has no visible text of its own). Defaults to `"Toggle"` if omitted — pass a real label for anything but a generic on/off control. |
| `disabled` | `boolean?` | Defaults to `false`. |

```tsx
import { ToggleSwitch } from "@/components/ui/FormField";

<ToggleSwitch
  checked={emailNotifications}
  onChange={setEmailNotifications}
  label="Email notifications"
/>
```

## Modal

Source: [`components/ui/Modal.tsx`](../components/ui/Modal.tsx)

Shared dialog shell: backdrop, focus trap, Escape/backdrop-click dismissal,
body scroll-lock, and an optional corner close button. Renders `null` when
closed. The caller supplies the dialog content — header, body, footer — as
`children`; the shell doesn't impose a layout beyond optional padding and
panel chrome.

| Prop | Type | Description |
|---|---|---|
| `isOpen` | `boolean` | Required. |
| `onClose` | `() => void` | Required. Called on Escape, backdrop click, or the close button. |
| `size` | `"sm" \| "md" \| "lg" \| "xl"` | Defaults to `"md"`. Controls panel max-width. |
| `titleId` | `string?` | Id of the heading rendered inside the modal. Preferred over `ariaLabel` — wires `aria-labelledby` to the actual visible heading. |
| `ariaLabel` | `string?` | Accessible label when there's no visible heading to reference. Provide `titleId` or `ariaLabel`, not both. |
| `className` | `string?` | Extra classes appended to the panel. |
| `backdropClassName` | `string?` | Replaces (not merges with) the default `bg-black/80 backdrop-blur-sm` backdrop. |
| `padded` | `boolean?` | Defaults to `true`. Pass `false` when the caller owns its own padding/layout. |
| `defaultPanelChrome` | `boolean?` | Defaults to `true`. Pass `false` when the caller owns panel rounding/shadow/border. |
| `panelScroll` | `boolean?` | Defaults to `true`. Panel scrolls internally up to `90vh`. Pass `false` when the caller manages its own scroll region. |
| `showCloseButton` | `boolean?` | Defaults to `true`. |
| `closeButtonLabel` | `string?` | Defaults to `"Close"`. |
| `closeOnBackdropClick` | `boolean?` | Defaults to `true`. |
| `closeOnEsc` | `boolean?` | Defaults to `true`. |
| `lockBodyScroll` | `boolean?` | Defaults to `true`. |
| `children` | `ReactNode` | Required. |

```tsx
import { Modal } from "@/components/ui/Modal";

<Modal isOpen={isOpen} onClose={() => setIsOpen(false)} titleId="confirm-title" size="sm">
  <h2 id="confirm-title" className="text-lg font-semibold">Delete this post?</h2>
  <p className="mt-2 text-neutral-400">This can't be undone.</p>
  <div className="mt-6 flex justify-end gap-2">
    <button onClick={() => setIsOpen(false)}>Cancel</button>
    <button onClick={handleDelete}>Delete</button>
  </div>
</Modal>
```

## Skeleton

Source: [`components/ui/Skeleton.tsx`](../components/ui/Skeleton.tsx)

Base loading-state block: a pulsing, rounded rectangle. `aria-hidden="true"`
by default since it's decorative — pair it with a `role="status"` /
visually-hidden "Loading…" text nearby if the loading state itself needs to
be announced. Extends `HTMLAttributes<HTMLDivElement>`, so `style`,
`onClick`, etc. all pass through.

| Prop | Type | Description |
|---|---|---|
| `className` | `string?` | Set width/height and any other sizing to match the content being replaced, e.g. `h-4 w-32` for a line of text. |

```tsx
import { Skeleton } from "@/components/ui/Skeleton";

// A card-shaped loading placeholder
<div className="flex items-center gap-3">
  <Skeleton className="h-10 w-10 rounded-full" />
  <div className="flex-1 space-y-2">
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-3 w-2/3" />
  </div>
</div>
```

## ValidatedInput

Source: [`components/ui/ValidatedInput.tsx`](../components/ui/ValidatedInput.tsx)

A labeled input built for validation feedback: error text, helper text, and
optional status icons. Extends `InputHTMLAttributes<HTMLInputElement>`.

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Required. |
| `label` | `string` | Required (not optional, unlike `FormInput`). |
| `error` | `string \| null?` | Renders red error text below the input, sets `aria-invalid`, and (with `showStatusIcon`) an alert icon. |
| `helperText` | `ReactNode?` | Muted helper text below the input, shown when there's no error. |
| `showStatusIcon` | `boolean?` | Defaults to `false`. When `true`, shows a status icon inside the input: an alert icon on error, a checkmark when the field has a value and no error. |

```tsx
import { ValidatedInput } from "@/components/ui/ValidatedInput";

<ValidatedInput
  id="username"
  label="Username"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
  error={usernameError}
  helperText="Letters, numbers, and hyphens only."
  showStatusIcon
/>
```
