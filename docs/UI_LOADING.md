# UI Loading & Skeleton Design Standards

## 1. Overview & Core Philosophy
Mzuri Unisex Salon Management System enforces standard visual feedback across all five operational roles (`owner`, `manager`, `hr`, `receptionist`, `staff`) and paired devices (`/desk`, `/display/queue`).
- **Zero layout shift**: Skeletons strictly mimic the structural dimensions and proportions of the data cards they replace.
- **No empty flashes**: While fetching or performing background mutations, current data remains rendered on screen until fresh data seamlessly updates.
- **Instant feedback**: Mutation buttons show inline spinners (`Spinner`) with disabled states to prevent double submissions.
- **Accessibility**: Loading states expose `aria-busy="true"`. Skeletons respect `prefers-reduced-motion` and disable animations in favor of static neutral blocks.

---

## 2. Shared Loading Primitives (`src/shared/views/ui/loading-primitives.tsx`)

### `Skeleton`
Basic animated placeholder with quiet neutral shimmer.
```tsx
import { Skeleton } from '@/shared/views/ui/loading-primitives';

<Skeleton className="h-8 w-32" />
```

### `Spinner`
Accent blue spinning indicator (`#1F4FD8`), available in `sm`, `md`, and `lg`.
```tsx
import { Spinner } from '@/shared/views/ui/loading-primitives';

<Spinner size="sm" />
```

### `ButtonLoading`
Interactive button that displays a spinner, custom working label (e.g., `"Recording payment..."`), and automatically prevents multi-clicks by disabling.
```tsx
import { ButtonLoading } from '@/shared/views/ui/loading-primitives';

<ButtonLoading isLoading={isSubmitting} loadingText="Saving...">
  Save Changes
</ButtonLoading>
```

### `StatTileSkeleton`, `TableSkeleton`, `ListSkeleton`, `ChartSkeleton`
Pre-built layout skeletons that match the exact geometry of dashboards, reports, and table views.

### `ImageSkeleton`
Used on kiosk and catalogue service cards. Renders a quiet placeholder until the remote photo finishes loading, fading in smoothly without jumping the grid.

---

## 3. Rules & Application Matrix

| Surface | Loading Experience | Error / Retry Behavior |
| :--- | :--- | :--- |
| **Route Navigation** | Next.js `loading.tsx` per route with structured skeletons | Clear error message + Retry trigger |
| **Owner Detail Modals** | Instant modal frame with inline tab skeletons | Quiet empty state with zero content flashes |
| **Action Submissions** | Button disables, spinner appears, prevents repeat clicks | Inline alert message in neutral red (`#B42318`) |
| **Kiosk Photo Tiles** | 4:3 fixed aspect ratio with lazy-loading fade | Neutral placeholder icon fallback |
| **Realtime Board** | Live 1s poll maintains active items without flashing | Gentle yellow reconnecting tag if disconnected |

---

## 4. CI Guardrail (`npm run check:loading`)
To ensure loading coverage never regresses, `scripts/check-loading.js` runs across all 56 routes with `page.tsx` and validates the presence of an active `loading.tsx` and `error.tsx`.
