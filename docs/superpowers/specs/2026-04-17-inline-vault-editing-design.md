# Inline Vault Editing Design

## Goal

Replace the separate `/edit/:id` page with inline expand-in-place editing directly from the vault list. Search results persist across edits, scroll position is preserved, and all row actions (edit, duplicate, delete) are available without leaving the list.

## Architecture

**Tech Stack:** React, TypeScript, TanStack Query, Tailwind CSS, existing `useVaultMutations` hooks.

**Approach:** `VaultPage` tracks a `Set<string>` of expanded row IDs. `RowList` passes expansion state down. Each row renders as either a collapsed summary card or an expanded edit form. The `/edit/:id` route and `EditRowPage` are removed entirely.

---

## Interaction Model

### Expand / Collapse

- Clicking anywhere on a collapsed row expands it in-place, revealing editable Group, Name, and Note fields.
- Clicking the row header again collapses it.
- Multiple rows can be open simultaneously — there is no limit.

### Auto-Save on Collapse

- When a row collapses, if any field has changed from the original value, `useUpdateRow()` fires automatically.
- On success: a "Saved ✓" badge flashes on the collapsed card for 2 seconds, then disappears.
- On failure (e.g. version conflict): the row stays expanded and shows the error message inline. The user must resolve it before the row can be collapsed.

### Add New Row

- The "+ Add row" button sets a `showNewRow: boolean` flag in `VaultPage`.
- When `showNewRow` is true, a blank expanded `RowItem` with `id="new"` is rendered at the top of the list, above all search results.
- On collapse with at least one non-empty field: `useAddRow()` fires, `showNewRow` becomes false, the new row appears in the list.
- On collapse with all fields empty: `showNewRow` becomes false, the card is discarded silently.
- An explicit **[Discard]** button inside the new row card also discards it immediately without collapsing (for clarity).

### Duplicate

- An expanded row shows a **[Duplicate]** button.
- Clicking it calls `useAddRow()` with the current field values (as displayed — including any unsaved edits in the open form).
- On success, the new row's ID (returned from Supabase after `invalidateQueries` resolves) is added to `expandedIds` so the duplicate appears expanded directly below the original.
- Implementation detail: `useAddRow` must return the new row's `id` from its `mutationFn` so the `onSuccess` callback can call `toggleExpanded(newId)`.

### Delete

- An expanded row shows a **[Delete]** button.
- Clicking it reveals a one-line inline confirmation inside the card: `"Delete this row? [Yes] [Cancel]"` — no full-page dialog.
- Confirming calls `useDeleteRow()`. On success the row is removed from the list.

### Copy

- Removed. The Note field is a selectable textarea — users select and copy text manually.

### Keyboard Navigation

- Arrow Up / Down: move selection highlight between rows (unchanged).
- `Enter`: toggle expand/collapse the currently selected row (was: navigate to edit page).
- `/`: focus the search bar (unchanged).
- Keyboard shortcut for copy note (`Ctrl+C` / `Cmd+C` on selected row) is removed alongside the Copy button.

### Conflict on Auto-Save

When `useUpdateRow()` throws a `ConflictError` (another session saved the row first):
- The row stays expanded.
- An inline banner appears inside the expanded card: `"Someone else saved changes. [Overwrite] [Discard mine]"`.
- **Overwrite:** re-fires `useUpdateRow()` with the bumped version from the conflict payload, then collapses.
- **Discard mine:** resets local field state to the server's latest values, then collapses (no save).
- The existing `ConflictModal` component in `EditRowPage` is deleted along with that page; conflict UI lives inline in `RowItem`.

### Search Persistence

- Search query and scope remain in `VaultPage` React state (as today).
- They persist for the lifetime of the tab session.
- They are not stored in the URL.

---

## Visual Layout

### Collapsed Card

```
┌─────────────────────────────────────┐
│ Google Workspace                    │
│ Work · admin@co / pass123           │
└─────────────────────────────────────┘
```

- Row name in bold, group · note preview in muted text below.
- Clicking anywhere on the card expands it.

### Expanded Card

```
┌─────────────────────────────────────┐
│ ▲ Google Workspace                  │  ← click header to collapse + auto-save
├─────────────────────────────────────┤
│ GROUP  [Work                      ] │
│ NAME   [Google Workspace          ] │
│ NOTE   [admin@co / pass123        ] │
│        [                          ] │
│                                     │
│ [Duplicate]          [Delete]       │
└─────────────────────────────────────┘
```

- Header row shows a collapse indicator (▲) and the row name.
- Group and Name are single-line inputs.
- Note is a multi-line textarea (monospace, resizable).
- No Save button — saving happens on collapse.

### Saved Confirmation Flash

```
┌─────────────────────────────────────┐
│ Google Workspace    Saved ✓         │
│ Work · admin@co / pass123           │
└─────────────────────────────────────┘
```

- "Saved ✓" appears in muted green text for 2 seconds after a successful auto-save.

### New Row Card

```
┌─────────────────────────────────────┐
│ ▲ New entry                         │
├─────────────────────────────────────┤
│ GROUP  [                          ] │
│ NAME   [                          ] │
│ NOTE   [                          ] │
│                                     │
│                          [Discard]  │
└─────────────────────────────────────┘
```

- Rendered at the top of the list, above search results.
- No Duplicate button (not yet saved).
- [Discard] discards immediately without collapsing.

### Delete Confirmation (inline)

```
┌─────────────────────────────────────┐
│ ▲ Google Workspace                  │
├─────────────────────────────────────┤
│ GROUP  [Work                      ] │
│ NAME   [Google Workspace          ] │
│ NOTE   [admin@co / pass123        ] │
│                                     │
│ Delete this row? [Yes]  [Cancel]    │
└─────────────────────────────────────┘
```

- Delete button replaced by inline confirmation row.
- [Cancel] returns to normal expanded state.

---

## Files Changed

| Action | File |
|--------|------|
| Modify | `src/pages/VaultPage.tsx` |
| Replace | `src/vault/RowCard.tsx` → `src/vault/RowItem.tsx` |
| Modify | `src/vault/RowList.tsx` |
| Delete | `src/pages/EditRowPage.tsx` |
| Modify | `src/App.tsx` |

### `VaultPage.tsx` changes
- Add `expandedIds: Set<string>` state — toggled on row click.
- Add `showNewRow: boolean` state — set true by "+ Add row" button.
- Pass `expandedIds`, `toggleExpanded`, `showNewRow`, `onDiscardNew` down to `RowList`.

### `RowItem.tsx` (new, replaces `RowCard.tsx`)
- Props: `row: VaultRow | null` (null = new row), `isExpanded: boolean`, `onToggle: () => void`, `onDuplicateSaved: (newId: string) => void`.
- Collapsed state: renders name + group/note preview, click calls `onToggle`.
- Expanded state: renders Group input, Name input, Note textarea, Duplicate button, Delete button.
- Tracks local field state (`localGroup`, `localName`, `localNote`) and a `conflictError: ConflictError | null` state.
- On `onToggle` when expanded: compares local state to original; if changed fires `useUpdateRow()`, awaits result, then calls parent toggle. If `ConflictError` is thrown, sets `conflictError` and does NOT collapse.
- For new rows (`row === null`): fires `useAddRow()` on collapse if any field non-empty, otherwise discards.
- On Duplicate click: fires `useAddRow()` with current local values; on success calls `onDuplicateSaved(newId)`.
- `useAddRow` mutationFn must return the inserted row's `id` (select the inserted row in the Supabase insert call).

### `RowList.tsx` changes
- Remove `navigate` call on row click.
- Pass `isExpanded` and `onToggle` to each `RowItem`.
- Render `RowItem id="new"` at top when `showNewRow` is true.

### `App.tsx` changes
- Remove the `/edit/:id` route.
- Remove import of `EditRowPage`.

---

## Error Handling

- **Auto-save conflict:** Row stays expanded, shows conflict message inline. User can overwrite or discard their changes manually.
- **Auto-save network error:** Row stays expanded, shows error message. User retries by collapsing again.
- **Delete failure:** Inline error replaces the confirmation row.
- **New row save failure:** New row stays expanded, shows error.
