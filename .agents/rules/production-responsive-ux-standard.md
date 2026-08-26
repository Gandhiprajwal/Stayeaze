---
description: Universal UX, responsiveness, and ergonomic sizing standard for StayEaze web applications.
always_on: true
---

# Production Responsive Web App & User-Centered UX Standard

## 1. Core Principle: Think Like the User
Before changing or implementing any page/component:
- Identify the user's primary task and P0 actions.
- Never make users search for something that should reasonably be immediately accessible.
- Minimize unnecessary navigation steps.
- The interface must match the user's mental model rather than the developer's implementation model.

---

## 2. Information Priority Hierarchy
- **P0 (Critical)**: Primary CTA, current status, important alerts, main data, save/submit action buttons.
- **P1 (Important)**: Search bar, active filters, sorting, high-frequency actions, essential metadata.
- **P2 (Secondary)**: Additional metadata, batch export, column configuration, detailed breakdowns.
- **P3 (Optional)**: Infrequently accessed technical logs or advanced configurations.

On small screens, strictly prioritize P0 -> P1 -> P2 -> P3. Never give P3 items equal visual importance to P0.

---

## 3. Sizing & Ergonomic Invariants

### A. Search Bars (Non-Compressible)
- **Desktop ($\ge$ 1024px)**: Dedicated width (`w-80` to `w-96 shrink-0` / 320px–384px), height 42px–44px (`h-10.5` to `h-11`). Never allow adjacent flex items to compress the search input.
- **Mobile / Tablet (< 1024px)**: Dedicated full-width row (`w-full h-11 text-base`) with a 1-tap clear button (`✕`).

### B. Filter Dropdowns & Toolbar Breathing Room
- **Selects**: Minimum width 150px–165px (`min-w-[150px]` to `min-w-[160px]`) and height 42px (`h-10.5`) so option labels like `"Status: Checked In (Active)"` or `"Property: All"` are never truncated with ellipses.
- **Action Tools**: Standard 42px height (`h-10.5 px-3.5 text-sm font-medium`) for Export, Columns, and secondary buttons.

### C. Data Presentation (Desktop Tables vs Mobile Cards)
- **Desktop ($\ge$ 1024px)**: High-density tables with comfortable padding (`py-3.5 px-4 text-sm`), column minimum widths (`min-w-[140px]` to `min-w-[200px]`), and smooth horizontal scrolling when needed.
- **Mobile (< 768px)**: Stacked interactive cards with primary entity, room badge, metadata grid, and 1-tap Call/WhatsApp actions.

### D. Modals & Dialogs (Keyboard-Safe)
- Fixed scrollable body (`max-h-[65vh] sm:max-h-[70vh]`).
- **Sticky Footer Actions**: "Cancel" and "Save Changes" buttons permanently pinned above mobile soft keyboards.
- Inputs standardized to comfortable 44px height (`h-11 text-sm rounded-xl`) with 14px font size to prevent mobile browser zoom clipping.
