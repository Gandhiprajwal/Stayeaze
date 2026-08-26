# Production Frontend Engineering Standard

## 1. Core Principle

A production frontend must be:

- Responsive
- Accessible
- Fast
- Secure
- Reliable
- Maintainable
- Testable
- Scalable
- Observable
- SEO-friendly where applicable
- Easy for users to understand

The AI must think from three perspectives:

1. **User** — "I want to complete my task easily."
2. **Developer** — "I want to maintain and extend this application safely."
3. **Operator** — "I want to know when something breaks and why."

---

## 2. User-First Engineering

Before implementing a component, ask:

- What is the user's goal?
- What is the most common workflow?
- What information does the user need?
- What action should be easiest to access?
- What can be removed or hidden without hurting the workflow?

Optimize for less confusion, less unnecessary interaction, less waiting, less scrolling, and less cognitive load.

Do not optimize simply for more visual elements, buttons, animations, or information.

---

## 3. Visual Hierarchy

Every page should clearly communicate:

1. Where am I?
2. What is this page for?
3. What is the primary action?
4. What information is important?
5. What can I do next?

Primary actions should visually dominate secondary actions.

---

# 4. Responsive Design

The application must work across:

- 320px
- 375px
- 390px
- 430px
- 480px
- 600px
- 768px
- 820px
- 1024px
- 1280px
- 1366px
- 1440px
- 1920px

Also test intermediate widths because breakpoint bugs can occur between standard device sizes.

Do not simply make desktop smaller. Determine how each component should **behave** at different widths.

### For every component evaluate

- Width
- Height
- Padding
- Margin
- Gap
- Font size
- Line height
- Alignment
- Wrapping
- Overflow
- Visibility
- Stacking
- Touch usability
- Keyboard interaction
- Accessibility

Prefer responsive CSS techniques such as:

```css
width: 100%;
max-width: ...;
min-width: ...;
clamp(...);
minmax(...);
flex;
grid;
flex-wrap;
```

Avoid unnecessary fixed dimensions and absolute positioning for content-driven layouts.

---

# 5. Frontend Performance

Performance optimization must be based on measurement rather than assumptions.

Inspect:

- JavaScript bundle size
- CSS size
- Images
- Fonts
- API calls
- Rendering
- DOM size
- Third-party scripts
- Caching
- Network requests

Use appropriate:

- Tree shaking
- Code splitting
- Route-level lazy loading
- Dynamic imports
- Image optimization
- Caching
- Request deduplication
- Pagination
- Virtualization where justified

Do not blindly optimize every component.

---

# 6. JavaScript Bundle Optimization

Review:

- Duplicate dependencies
- Large libraries
- Unused imports
- Dead code
- Third-party packages
- Unnecessary polyfills

Before adding a dependency, ask:

- Is it necessary?
- Is the functionality already available?
- How large is it?
- Is it maintained?
- Does it introduce security or maintenance risk?

---

# 7. Code Splitting and Lazy Loading

Large features should not necessarily be loaded during the initial page load.

Use lazy loading when it provides a meaningful performance benefit.

Do not lazy-load everything blindly because excessive lazy loading can introduce interaction latency and complexity.

---

# 8. Images

Images should be optimized for their actual display size.

Use:

- Correct dimensions
- Responsive images
- Modern formats where appropriate
- Compression
- Lazy loading for below-the-fold images
- Proper caching
- Reserved dimensions to prevent layout shift

Do not load a 4000x4000 image when the UI displays it at 200x200 without a justified reason.

---

# 9. Fonts

Avoid loading unnecessary font families, weights, styles, and character sets.

Consider `font-display`, preloading critical fonts, and font subsetting where appropriate.

---

# 10. Layout Stability

Prevent unexpected layout shifts.

Reserve space for:

- Images
- Async content
- Dynamic components

Use skeletons or placeholders where appropriate.

---

# 11. Core Web Vitals

Consider:

- **LCP** — Largest Contentful Paint
- **INP** — Interaction to Next Paint
- **CLS** — Cumulative Layout Shift

Do not optimize only for metrics. The real objective is to make the application feel fast and responsive.

---

# 12. Rendering Performance

For React or similar frameworks, inspect:

- State placement
- Context usage
- Props
- Component boundaries
- Effects
- Derived state
- Unnecessary re-renders

Do not blindly add:

```javascript
useMemo()
useCallback()
memo()
```

Performance optimizations should have a measurable or architectural reason.

---

# 13. DOM Size and Large Data

Avoid rendering enormous numbers of DOM elements unnecessarily.

For large datasets consider:

- Pagination
- Server-side filtering
- Server-side sorting
- Virtualization

10,000 records should not automatically become 10,000 DOM rows.

---

# 14. Search Performance

Avoid triggering an API request on every keystroke.

Consider:

- Debouncing
- Request cancellation
- Minimum search length
- Caching
- Request deduplication

Older search responses must not overwrite newer results.

---

# 15. API Request Optimization

Avoid unnecessary requests.

Check for:

- Duplicate requests
- Requests caused by unnecessary renders
- Requests for invisible content
- Requests that can be cached
- Requests that can be combined

Consider caching, prefetching, pagination, debouncing, request deduplication, and cancellation.

---

# 16. API State Handling

Every important asynchronous operation should account for:

```text
Idle
Loading
Success
Empty
Error
```

---

# 17. Error Handling

Do not expose raw technical errors to normal users.

Bad:

```text
AxiosError: Request failed with status code 500
```

Better:

```text
We couldn't load your projects.

Try again.
```

Provide recovery actions where possible.

---

# 18. Error Boundaries

For component-based frameworks, use appropriate error boundaries so a failure in one non-critical component does not unnecessarily destroy the entire application.

---

# 19. Network Failure

Test:

- Offline
- Slow network
- High latency
- Request timeout
- Server unavailable
- Intermittent connection

The UI should fail gracefully.

---

# 20. Authentication Failure

Handle appropriately:

- 401 Unauthorized
- 403 Forbidden
- Expired session
- Invalid token

If a session expires, explain what happened and provide a safe authentication path.

---

# 21. Security Principle

**Never trust the browser.**

Frontend controls are not security controls.

The backend must enforce authentication, authorization, data access, business rules, and validation.

Never assume that hiding or disabling a frontend element provides security.

---

# 22. XSS Protection

Treat user-generated content as untrusted.

Be particularly careful with:

- `innerHTML`
- `dangerouslySetInnerHTML`
- HTML rendering
- Markdown rendering
- Rich text
- URL parameters
- Query parameters

Do not inject arbitrary user-controlled HTML.

Sanitize content when HTML rendering is genuinely required.

---

# 23. Authentication Token Security

Choose authentication storage based on the application's threat model.

Do not automatically store sensitive authentication credentials in browser storage without evaluating the security implications.

For cookie-based authentication, consider appropriate:

- `Secure`
- `HttpOnly`
- `SameSite`

settings.

---

# 24. Sensitive Data Exposure

Only request and expose information that the user needs.

Never expose:

- Passwords
- Password hashes
- Private keys
- Internal credentials
- Secrets
- Unnecessary personal information
- Internal security information

---

# 25. URL Security

Review query parameters, path parameters, redirect URLs, and external URLs.

Validate redirect destinations where appropriate and avoid open redirects.

---

# 26. Third-Party Scripts

Every third-party script can increase performance, security, privacy, and reliability risk.

Before adding one, ask:

1. Is it necessary?
2. What data does it receive?
3. What permissions does it require?
4. How much performance does it consume?
5. What happens if it fails?

---

# 27. Content Security Policy

Where appropriate, implement a strong Content Security Policy.

CSP should be designed for the actual application rather than blindly copied from another project.

---

# 28. Dependency Security

Before adding a dependency, evaluate:

- Maintenance status
- Vulnerabilities
- Bundle size
- Transitive dependencies
- License
- Long-term maintenance cost

Regularly audit dependencies.

---

# 29. Accessibility

The application should be usable by people with different abilities.

Consider:

- Keyboard users
- Screen readers
- Low vision
- Color vision differences
- Motor limitations
- Reduced motion

---

# 30. Semantic HTML

Prefer semantic elements:

```html
<button>
<nav>
<main>
<header>
<footer>
<form>
<label>
<table>
```

Do not build everything using generic `<div>` elements with JavaScript click handlers.

---

# 31. Keyboard Accessibility

Interactive elements should be usable with the keyboard.

Test:

- Tab
- Shift + Tab
- Enter
- Space
- Escape
- Arrow keys where appropriate

Focus order must be logical.

---

# 32. Focus Management

For important interactions such as modals:

```text
Open modal
    ↓
Focus enters modal
    ↓
User interacts
    ↓
Close modal
    ↓
Focus returns to triggering element
```

---

# 33. Color and Contrast

Do not communicate information using color alone.

Use appropriate combinations of text, icons, labels, color, and accessible contrast.

---

# 34. Touch Usability

Interactive controls must be comfortably usable on touch devices.

Avoid tiny controls that require precise tapping.

---

# 35. Forms

Forms should provide:

- Labels
- Validation
- Helpful errors
- Required indicators where appropriate
- Loading state
- Success state
- Keyboard support

Preserve user input when validation fails.

---

# 36. Form Validation

Use:

```text
Client validation → User experience
Server validation → Security and correctness
```

Never rely exclusively on frontend validation.

---

# 37. Prevent Duplicate Actions

For operations such as Save, Create, Delete, Submit, Upload, and Payment, prevent accidental duplicate submissions.

For critical operations, consider backend idempotency as well.

---

# 38. Destructive Actions

For Delete, Remove, Cancel, Reset, and Deactivate, make consequences clear.

Use confirmation for genuinely high-risk operations.

Do not add confirmation dialogs to every trivial action.

---

# 39. Tables

Tables must work with:

- Mobile
- Tablet
- Desktop
- Long text
- Large datasets
- Many columns
- Empty state
- Loading
- Error state
- Sorting
- Filtering
- Pagination

Possible strategies:

- Horizontal scrolling
- Column prioritization
- Column hiding
- Card transformation
- Pagination
- Virtualization

Choose based on the table's purpose.

---

# 40. Search and Filters

Desktop may use:

```text
Search | Filter | Sort | Actions
```

Mobile may need:

```text
Search
Filter
Sort
Actions
```

Do not force every control into one row.

---

# 41. Modals

Modals must adapt to viewport size.

On mobile:

- Avoid oversized desktop layouts.
- Ensure content can scroll.
- Keep important actions accessible.
- Avoid unnecessary nested scrolling.
- Manage focus correctly.

---

# 42. Navigation

Navigation must remain usable at all supported sizes.

Depending on the application, consider:

- Desktop sidebar
- Collapsed sidebar
- Mobile drawer
- Bottom navigation

Do not hide critical functionality simply because the viewport is smaller.

---

# 43. State Management

Classify state appropriately:

- Local UI state
- Server state
- Global application state
- URL state
- Form state

Do not put all application state into one global store without a reason.

---

# 44. Server State

Avoid unnecessary duplication of server data.

Consider:

- Caching
- Invalidation
- Refetching
- Optimistic updates
- Stale data
- Request deduplication

---

# 45. URL State

State that should survive refresh, back navigation, or sharing may belong in the URL.

Examples:

```text
/search?q=java
/users?page=2
/orders?status=pending
```

---

# 46. Browser Navigation

Test:

- Back
- Forward
- Refresh
- Direct URL access
- Deep links
- Opening pages in a new tab

The application should behave predictably.

---

# 47. Internationalization

If multiple languages are possible, design for text expansion.

Consider where applicable:

- RTL languages
- Date formats
- Number formats
- Currency
- Time zones
- Locale-specific text

---

# 48. Time Zones

Do not assume the user's timezone equals the server timezone.

Explicitly define storage, API, user, business, and display timezones where relevant.

---

# 49. Data Formatting

Use locale-aware formatting where appropriate:

```javascript
Intl.DateTimeFormat
Intl.NumberFormat
```

---

# 50. Offline and Poor Network UX

For applications that require it, consider:

- Offline detection
- Cached data
- Retry
- Pending states
- Network status

Do not implement full offline functionality unless the product requires it.

---

# 51. Environment Configuration

Separate:

```text
Development
Testing
Staging
Production
```

Never accidentally point the production frontend to development APIs.

---

# 52. Frontend Environment Variables

Treat frontend environment variables as potentially public.

Never place secrets such as database passwords, private API secrets, JWT signing secrets, or private keys into frontend environment variables.

Anything bundled into frontend JavaScript can potentially be inspected by users.

---

# 53. Production Build

Production builds should:

- Minify
- Tree-shake
- Compress
- Remove unnecessary development code
- Optimize assets
- Use correct production configuration

Never deploy development builds as production builds.

---

# 54. Source Maps

Source maps can help debugging but may expose source code.

Choose a production source-map strategy appropriate for the application's security and debugging requirements.

---

# 55. Console Logs

Remove or control unnecessary production logging.

Never log:

- Tokens
- Passwords
- Personal information
- Private API responses
- Other sensitive data

---

# 56. Caching

Define caching intentionally across:

- Browser
- CDN
- API
- Application

Use asset hashing/versioning so users do not remain stuck on stale frontend assets after deployment.

---

# 57. CI/CD

A production frontend pipeline should generally include:

```text
Install dependencies
        ↓
Lint
        ↓
Unit tests
        ↓
Integration tests
        ↓
Security checks
        ↓
Production build
        ↓
Deploy
        ↓
Smoke test
```

Critical failures should stop deployment.

---

# 58. Smoke Testing

After deployment, verify:

- Website opens
- Authentication works
- API connectivity works
- Main page loads
- Important navigation works
- Critical user actions work

---

# 59. Monitoring and Observability

Monitor:

- JavaScript errors
- Unhandled promise rejections
- API failures
- Failed resource loads
- Page performance
- Core Web Vitals
- Browser/device-specific failures

---

# 60. Real User Monitoring

Synthetic testing shows what happens in a test environment.

Real-user monitoring shows what actual users experience.

Use it where appropriate to identify:

- Browser-specific bugs
- Device-specific issues
- Regional network issues
- Slow APIs
- JavaScript failures

---

# 61. Feature Flags

For larger applications, feature flags can enable safer rollout:

```text
New feature
    ↓
Small percentage of users
    ↓
Monitor
    ↓
Increase rollout
    ↓
Full release
```

Use feature flags where they reduce deployment risk.

---

# 62. Avoid Breaking Existing Functionality

When modifying the UI:

- Do not accidentally change business logic.
- Do not unnecessarily change API contracts.
- Do not remove existing states.
- Do not change permissions.
- Do not alter data behavior.

Separate UI refactoring from business-logic changes unless both are explicitly required.

---

# 63. Component Architecture

Create genuinely reusable components where appropriate:

- Button
- Input
- Select
- Modal
- Table
- Card
- Pagination
- SearchBar
- FilterPanel
- Toast

Avoid multiple slightly different versions of the same component without a real reason.

---

# 64. Design System

Maintain consistency for:

- Colors
- Typography
- Spacing
- Radius
- Shadows
- Buttons
- Inputs
- Cards
- Tables
- Modals
- Breakpoints

Prefer design tokens instead of arbitrary values.

---

# 65. CSS Quality

Avoid:

- Excessive `!important`
- Deep selector chains
- Duplicate styles
- Magic numbers
- Unnecessary absolute positioning
- Excessive breakpoint overrides

Prefer predictable component-level styling.

---

# 66. Magic Numbers

Avoid unexplained values such as:

```css
margin-left: 137px;
top: 83px;
width: 743px;
```

Ask:

> Why does this number exist?

If the answer is simply "to make it look right on my screen," reconsider the implementation.

---

# 67. Testing Matrix

Every important page should be tested against:

### Viewports

- Mobile
- Tablet
- Laptop
- Desktop
- Large desktop

### States

- Loading
- Success
- Empty
- Error
- Partial data
- Long data
- Large data

### Interaction

- Mouse
- Keyboard
- Touch
- Back/forward
- Refresh
- Deep link

---

# 68. Regression Testing

When changing a shared component, test all major pages using it.

A shared component change can break many pages.

---

# 69. Performance Testing

Measure:

- Initial page load
- Route navigation
- API impact
- Large lists
- Large tables
- Search
- Filtering
- Modal opening
- Form submission

Use realistic production-like data.

---

# 70. Security Testing

Before production, review:

- XSS
- Authentication bypass
- Authorization bypass
- Unsafe redirects
- Sensitive data exposure
- Improper error exposure
- Dependency vulnerabilities
- Unsafe file handling

Frontend security cannot replace backend security.

---

# 71. Production Readiness Rule

Do not consider a feature complete simply because it "looks good."

Before completion, verify:

```text
Functionality
    ↓
Responsiveness
    ↓
Accessibility
    ↓
Performance
    ↓
Security
    ↓
Error handling
    ↓
Loading states
    ↓
Empty states
    ↓
Realistic data
    ↓
Browser behavior
    ↓
Regression
    ↓
Production build
```

---

# 72. Final Frontend Production Checklist

## Responsiveness

- [ ] Mobile works
- [ ] Tablet works
- [ ] Desktop works
- [ ] Intermediate widths work
- [ ] No horizontal overflow
- [ ] No clipped content
- [ ] No broken fixed dimensions
- [ ] Touch controls are usable

## UX

- [ ] Primary task is obvious
- [ ] Navigation is predictable
- [ ] Search is easy to access
- [ ] Filters are easy to access
- [ ] Important actions are accessible
- [ ] Loading states exist
- [ ] Empty states exist
- [ ] Error states exist
- [ ] Recovery actions exist

## Performance

- [ ] Bundle size reviewed
- [ ] Images optimized
- [ ] Fonts optimized
- [ ] Code splitting considered
- [ ] Lazy loading used appropriately
- [ ] API requests minimized
- [ ] Duplicate requests prevented
- [ ] Search debounced where appropriate
- [ ] Large lists handled efficiently
- [ ] Layout shift minimized
- [ ] Rendering performance checked

## Security

- [ ] No secrets in frontend
- [ ] XSS risks addressed
- [ ] Unsafe HTML reviewed
- [ ] Redirects validated
- [ ] Sensitive data minimized
- [ ] Third-party scripts reviewed
- [ ] Dependencies reviewed
- [ ] Authentication UX handled
- [ ] Authorization is enforced by backend
- [ ] CSP considered

## Accessibility

- [ ] Semantic HTML
- [ ] Keyboard navigation
- [ ] Focus management
- [ ] Screen-reader labels
- [ ] Sufficient contrast
- [ ] Visible focus
- [ ] Touch-friendly controls
- [ ] Form labels/errors
- [ ] Reduced-motion consideration

## Reliability

- [ ] Network failures handled
- [ ] API errors handled
- [ ] Timeout states handled
- [ ] Session expiration handled
- [ ] Duplicate submissions prevented
- [ ] Browser refresh handled
- [ ] Back/forward navigation works

## Architecture

- [ ] Reusable components
- [ ] Consistent design system
- [ ] No unnecessary duplication
- [ ] State appropriately scoped
- [ ] CSS maintainable
- [ ] No unnecessary dependencies

## Testing

- [ ] Unit tests
- [ ] Component tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Responsive tests
- [ ] Accessibility tests
- [ ] Security tests
- [ ] Performance tests
- [ ] Regression tests

## Production

- [ ] Production build works
- [ ] CI/CD works
- [ ] Environment configuration correct
- [ ] API URLs correct
- [ ] Error monitoring enabled
- [ ] Performance monitoring enabled
- [ ] Deployment smoke test exists
- [ ] Rollback strategy exists

---

# 73. AI Frontend Engineering Instruction

> **Build for the real user, not for the developer's screen.**
>
> Before implementing a frontend feature, understand the user's goal, expected workflow, data, devices, network conditions, permissions, and failure scenarios.
>
> Before declaring a feature complete, evaluate it for:
>
> - Functionality
> - Responsiveness
> - Accessibility
> - Performance
> - Security
> - Reliability
> - Maintainability
> - Observability
> - Testability
>
> Do not optimize only for visual appearance.
>
> Do not optimize only for code quality.
>
> Do not optimize only for performance.
>
> The best implementation is the one that allows the user to complete the intended task safely, quickly, clearly, and reliably while remaining maintainable and scalable for the development team.
>
> Never assume that because a component works at one viewport, with one dataset, on one browser, and on one network, it is production-ready.

---

# 74. Production Frontend Philosophy

```text
                 USER GOAL
                     ↓
                 UX DESIGN
                     ↓
              RESPONSIVE UI
                     ↓
               ACCESSIBILITY
                     ↓
                PERFORMANCE
                     ↓
                  SECURITY
                     ↓
                RELIABILITY
                     ↓
              MAINTAINABILITY
                     ↓
               OBSERVABILITY
                     ↓
                  TESTING
                     ↓
                DEPLOYMENT
                     ↓
           REAL USER FEEDBACK
                     ↓
          CONTINUOUS IMPROVEMENT
```

The objective is not merely to make the frontend "work."

The objective is to make it **safe, fast, accessible, responsive, reliable, maintainable, and easy for real users to operate in production**.
