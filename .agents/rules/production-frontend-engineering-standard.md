# Production Frontend Engineering Standard

## 1. Core Principles & Perspectives
Every frontend feature must be built from three simultaneous perspectives:
1. **User**: "I want to complete my task easily, quickly, and without confusion or cognitive load."
2. **Developer**: "I want to maintain, test, and extend this application safely without breaking existing features."
3. **Operator**: "I want observability to know immediately when something breaks, why it broke, and how to recover."

---

## 2. Responsive Design & Viewport Matrix
The application must work seamlessly across all standard and intermediate breakpoints without horizontal overflow or clipped content:
- **Ultra-Mobile**: 320px, 375px, 390px, 430px, 480px
- **Phablet & Tablet**: 600px, 768px, 820px
- **Laptop & Desktop**: 1024px, 1280px, 1366px, 1440px, 1920px

### Component Evaluation Rules
- Use responsive fluid utilities: `w-full`, `max-w-*`, `min-w-*`, `flex-wrap`, `grid`, `gap-*`, `clamp()`.
- Avoid arbitrary fixed widths (`w-[743px]`) or magic numbers.
- Ensure touch targets are at least 40px with comfortable spacing on mobile viewports.

---

## 3. Visual Hierarchy & UX Patterns
- **Primary Actions**: Primary CTAs must visually dominate secondary actions.
- **Search & Filters**: In-line on desktop/tablet landscape (`flex flex-wrap items-center gap-2.5`); responsive stacked/wrapped on mobile.
- **Tables**: Provide high-density card views on mobile ($< 768\text{px}$) and horizontal overflow wrappers on desktop.
- **Modals**: Must use `w-[calc(100vw-2rem)] max-w-lg rounded-2xl` with scrollable bodies (`max-h-[85vh]`) and `flex-col-reverse sm:flex-row` footers.
- **Destructive Actions**: Require clear confirmations only for irreversible, high-risk actions (e.g., delete, reset, revoke).
- **Duplicate Action Prevention**: Disable buttons and show spinners during active mutations (Save, Pay, Delete, Upload).

---

## 4. Performance & Resource Optimization
- **Core Web Vitals**: Optimize for LCP (Largest Contentful Paint), INP (Interaction to Next Paint), and zero CLS (Cumulative Layout Shift).
- **Bundle Optimization**: Use route-level code splitting (`React.lazy`), tree shaking, and dynamic imports. Never add large third-party libraries without evaluating necessity and size.
- **Search Debouncing**: Debounce search queries (300ms) with request cancellation and stale response discard.
- **Large Datasets**: Always use server-side pagination, sorting, and filtering instead of rendering thousands of DOM elements.
- **Layout Stability**: Reserve space for async content, images, and dynamic widgets with skeleton placeholders.

---

## 5. Security & Data Protection
- **Never Trust the Browser**: Frontend guards are for UX, not security. Backend must strictly enforce authentication, authorization, and data validation.
- **Zero Secrets**: Never embed database credentials, private API keys, or JWT signing secrets into frontend environment variables or bundles.
- **XSS Protection**: Treat all user input as untrusted. Never use `dangerouslySetInnerHTML` without strict sanitization.
- **Token Security**: Store tokens securely; handle 401/403 session expirations gracefully with automatic redirect to login.

---

## 6. Accessibility (A11y)
- **Semantic HTML**: Use `<button>`, `<nav>`, `<main>`, `<header>`, `<form>`, `<label>`, `<table>` instead of generic `<div>` with click handlers.
- **Keyboard Navigation**: Full Tab, Shift+Tab, Enter, Space, Escape, and Arrow key usability with visible focus rings.
- **Modal Focus Trap**: Focus enters modal on open and returns to the trigger element on close.
- **Color & Contrast**: Never communicate status via color alone; combine icons, text badges, and high-contrast color tokens.

---

## 7. State Management & Reliability
- **State Classification**:
  - *Local UI State*: `useState` for component toggles/drawers.
  - *Server State*: TanStack Query for caching, background refetching, and deduplication.
  - *URL State*: Query parameters for shareable search, filters, and pagination (`?page=2&status=ACTIVE`).
  - *Global State*: Zustand for authentication and theme.
- **Complete Async State Handling**: Every async operation must handle all 5 states: `Idle`, `Loading`, `Success`, `Empty`, `Error`.
- **Friendly Error Recovery**: Never expose raw Axios stack traces; provide friendly messages with retry buttons.

---

## 8. Production Readiness Verification Checklist
Before declaring any frontend feature complete, verify:
- [ ] Responsive at 320px, 375px, 768px, 1024px, 1440px.
- [ ] No horizontal overflow on any page.
- [ ] All 5 async states accounted for (Idle, Loading, Success, Empty, Error).
- [ ] Touch targets $\ge 40\text{px}$ on mobile.
- [ ] Keyboard navigable with visible focus.
- [ ] No hardcoded secrets or sensitive data exposure.
- [ ] Production build (`npm run build`) compiles with 0 errors.
