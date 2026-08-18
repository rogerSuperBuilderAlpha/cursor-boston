# Shared UI primitives

Diátaxis: Reference.

This page documents the four primitives under `components/ui/`. It describes only what those files export and implement. For client-island filter and live-region patterns, see [A11Y_PATTERNS.md](A11Y_PATTERNS.md).

| File | Exports | `"use client"` |
|---|---|---|
| [`components/ui/FormField.tsx`](../components/ui/FormField.tsx) | `FormInput`, `FormTextarea`, `ToggleSwitch` | No |
| [`components/ui/Modal.tsx`](../components/ui/Modal.tsx) | `Modal` | Yes |
| [`components/ui/Skeleton.tsx`](../components/ui/Skeleton.tsx) | `Skeleton` | Yes |
| [`components/ui/ValidatedInput.tsx`](../components/ui/ValidatedInput.tsx) | `ValidatedInput` | No |

There is no `FormField` component. Import the named exports from that file.

---

## FormField (`FormInput`, `FormTextarea`, `ToggleSwitch`)

Labeled form controls used on profile settings. Native inputs get a dark-theme class from `CLASS_GROUPS.form`. Extra HTML attributes spread onto the control.

### `FormInput`

Purpose: single-line labeled `<input>` with optional error text.

| Prop | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | Yes | Used as the input `id` and as `{id}-error` when `error` is set. |
| `label` | `string` | No | When set, renders `<label htmlFor={id}>` above the input. No label element when omitted. |
| `error` | `string \| null` | No | When a non-empty string, renders `<p id="{id}-error" role="alert">`. `null` and omission render no alert. |
| `...props` | `InputHTMLAttributes<HTMLInputElement>` | No | Spread onto the `<input>` after `id`, `className`, and `aria-describedby`. |

Accessibility and behavior:

- `aria-describedby` is `{id}-error` only while `error` is truthy.
- The spread comes **after** `aria-describedby`, so a caller-supplied `aria-describedby` replaces the error association.
- This control does **not** set `aria-invalid`. Use `ValidatedInput` when you need that.

```tsx
import { FormInput } from "@/components/ui/FormField";

<FormInput
  id="displayName"
  label="Display name"
  value={name}
  onChange={(event) => setName(event.target.value)}
  error={nameError}
/>
```

### `FormTextarea`

Purpose: labeled `<textarea>` with the same error pattern as `FormInput`.

| Prop | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | Yes | Same error-id pattern as `FormInput`. |
| `label` | `string` | No | Same as `FormInput`. |
| `error` | `string \| null` | No | Same as `FormInput`. |
| `rows` | `number` | No | Defaults to `3`. |
| `...props` | `TextareaHTMLAttributes<HTMLTextAreaElement>` | No | Spread onto the `<textarea>` after `id`, `className`, `aria-describedby`, and `rows`. |

Constraints from the implementation: the textarea always includes `resize-none` on top of the shared input class.

```tsx
import { FormTextarea } from "@/components/ui/FormField";

<FormTextarea
  id="bio"
  label="Bio"
  value={bio}
  onChange={(event) => setBio(event.target.value)}
  rows={6}
/>
```

### `ToggleSwitch`

Purpose: controlled checkbox styled as a switch. The native checkbox is `sr-only`; a sibling `div` draws the track.

| Prop | Type | Required | Notes |
|---|---|---|---|
| `checked` | `boolean` | Yes | Controlled checked state. |
| `onChange` | `(checked: boolean) => void` | Yes | Called with `event.target.checked`. |
| `size` | `"sm" \| "md"` | No | `"sm"` is `w-9 h-5`; `"md"` is `w-11 h-6`. Default `"sm"`. |
| `label` | `string` | No | Applied as `aria-label` on the checkbox. Default visible text is not rendered. When omitted, `aria-label` is `"Toggle"`. |
| `disabled` | `boolean` | No | Default `false`. Disables the checkbox and switches the wrapper from pointer to disabled styling. |

```tsx
import { ToggleSwitch } from "@/components/ui/FormField";

<ToggleSwitch
  checked={emailPublic}
  onChange={setEmailPublic}
  label="Show email on profile"
  size="md"
/>
```

The checkbox uses `peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400` on the track. There is no visible text label in this component; pass `label` so screen readers have a name.

---

## Modal

Purpose: shared dialog shell. Owns the backdrop, focus management, Escape and backdrop dismissal, body scroll lock, and optional corner close button. Renders `null` when `isOpen` is false. You supply header, body, and footer as `children`. The shell does not impose a header/footer layout.

This is a client component (`"use client"`).

| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `isOpen` | `boolean` | Yes | | Closed state returns `null`. |
| `onClose` | `() => void` | Yes | | Close button, Escape, and backdrop click (when enabled) all call this. |
| `children` | `ReactNode` | Yes | | Dialog contents. |
| `size` | `"sm" \| "md" \| "lg" \| "xl"` | No | `"md"` | Maps to `max-w-sm`, `max-w-md`, `max-w-lg`, `max-w-2xl`. |
| `titleId` | `string` | No | | Sets `aria-labelledby`. Prefer this and give the heading the same `id`. |
| `ariaLabel` | `string` | No | | Used as `aria-label` only when `titleId` is omitted. |
| `className` | `string` | No | | Appended to the panel. |
| `backdropClassName` | `string` | No | `bg-black/80 backdrop-blur-sm` | **Replaces** the default backdrop classes when provided. |
| `padded` | `boolean` | No | `true` | Default panel padding is `p-6 md:p-8`. Pass `false` to own padding. |
| `defaultPanelChrome` | `boolean` | No | `true` | Default rounding, border, background, and shadow. Pass `false` to own chrome. |
| `panelScroll` | `boolean` | No | `true` | When true, panel is `max-h-[90vh] overflow-y-auto`. |
| `showCloseButton` | `boolean` | No | `true` | Corner close control. |
| `closeButtonLabel` | `string` | No | `"Close"` | `aria-label` on the close button. |
| `closeOnBackdropClick` | `boolean` | No | `true` | Backdrop `onClick` is omitted when false. |
| `closeOnEsc` | `boolean` | No | `true` | Document-level `keydown` listener. |
| `lockBodyScroll` | `boolean` | No | `true` | Sets `document.body.style.overflow` to `"hidden"` while open, then restores the previous value. |

Accessibility and keyboard behavior (from the implementation):

- Outer wrapper: `role="dialog"`, `aria-modal="true"`.
- `aria-labelledby={titleId}` always; `aria-label` is set only when `titleId` is falsy.
- Backdrop is `aria-hidden="true"`.
- Panel has `tabIndex={-1}` and `data-modal-content`.
- On open, focus moves to the first focusable descendant, or the panel if none exist. On close/unmount, the previously focused element is restored.
- Tab / Shift+Tab wrap inside the panel. Escape dismisses via a document listener so it still works if focus leaves the dialog subtree.
- Focusable query: links, un-disabled form controls, iframes, `contenteditable="true"`, and `[tabindex]` other than `-1`, excluding `aria-hidden="true"`.

```tsx
import { Modal } from "@/components/ui/Modal";

<Modal isOpen={open} onClose={() => setOpen(false)} titleId="edit-profile-title">
  <h2 id="edit-profile-title">Edit profile</h2>
  {/* body */}
</Modal>
```

Callers that manage their own scroll region pass `panelScroll={false}` (for example `EditProfileModal`).

---

## Skeleton

Purpose: decorative loading placeholder. A `div` with `animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800`. Prefer content-shaped sizes via `className` over a spinner.

This is a client component (`"use client"`).

| Prop | Type | Required | Notes |
|---|---|---|---|
| `className` | `string` | No | Merged with the pulse / rounded / background classes. |
| `...props` | `HTMLAttributes<HTMLDivElement>` | No | Spread onto the `div` after `aria-hidden="true"`. |

Accessibility: the base element sets `aria-hidden="true"`. Because `...props` is spread after that attribute, a caller can override it.

Page-level loading screens in `components/skeletons/` compose this primitive (for example `MembersPageSkeleton`, `QuestionsPageSkeleton`).

```tsx
import { Skeleton } from "@/components/ui/Skeleton";

<Skeleton className="h-4 w-32" />
```

---

## ValidatedInput

Purpose: labeled `<input>` with helper text, error text, and optional status icons. Used on login and signup. Label is required. Extra input attributes spread onto the control, then the component overwrites `id`, `aria-describedby`, `aria-invalid`, and `className`.

| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | `string` | Yes | | Input `id` and prefix for helper/error ids. |
| `label` | `string` | Yes | | Always rendered as `<label htmlFor={id}>`. |
| `error` | `string \| null` | No | | When truthy, renders `<p id="{id}-error" role="alert">` and sets `aria-invalid="true"`. |
| `helperText` | `ReactNode` | No | | When set, renders `<p id="{id}-helper">`. |
| `showStatusIcon` | `boolean` | No | `false` | When true, shows a red `CircleAlert` if `error` is set, or a green `CheckCircle2` if there is no error and `value` is truthy. Icons are `aria-hidden`. Also adds `pr-11` to the input. |
| `className` | `string` | No | | Merged onto the input after the shared class. |
| `aria-describedby` | `string` | No | | Prepended to the computed helper/error ids. |
| `...props` | `InputHTMLAttributes<HTMLInputElement>` | No | | Spread first; `id`, described-by, `aria-invalid`, and `className` from the component win. |

`aria-describedby` is the space-joined list of caller `aria-describedby`, `{id}-helper` (if helper text), and `{id}-error` (if error). `aria-invalid` is `"true"` only when `error` is truthy; otherwise the attribute is omitted.

This control does **not** validate. You compute `error` / `helperText` and pass them in.

```tsx
import { ValidatedInput } from "@/components/ui/ValidatedInput";

<ValidatedInput
  id="email"
  label="Email"
  type="email"
  value={email}
  onChange={(event) => setEmail(event.target.value)}
  error={emailError}
  helperText="Use the email on your account."
  showStatusIcon
  required
/>
```

---

## Choosing `FormInput` vs `ValidatedInput`

| | `FormInput` | `ValidatedInput` |
|---|---|---|
| Label | Optional | Required |
| Helper text | No | `helperText` |
| `aria-invalid` | Not set | `"true"` when `error` is set |
| Status icons | No | Optional via `showStatusIcon` |
| Theme class | `CLASS_GROUPS.form.inputDark` | `CLASS_GROUPS.form.inputLightDark` |
| Attribute spread vs a11y | Caller spread can override `aria-describedby` | Component `aria-describedby` / `aria-invalid` win |

Use `FormInput` / `FormTextarea` for profile-style fields. Use `ValidatedInput` when you need helper copy, `aria-invalid`, or status icons.
