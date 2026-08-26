# Production Responsive Web Application & User-Centered UX Standard

## 1. Purpose

This document is a reusable standard for an AI coding agent/model building or reviewing a production web application.

The goal is to make every page and component:

- Fully responsive across mobile, tablet, laptop, desktop, and large screens.
- Easy to understand and navigate.
- Easy to perform the primary task.
- Easy to access frequently used features.
- Visually uncluttered, especially on small screens.
- Accessible by keyboard, touch, and assistive technologies where applicable.
- Resistant to content overflow and layout breaking.
- Fast and efficient.
- Consistent across the application.
- Tested at component, page, responsive, accessibility, and user-flow levels.
- Production-ready rather than merely visually acceptable.

### Primary target

Aim for **90%+ usability, accessibility, responsiveness, task efficiency, and reliability** across supported devices.

---

# 2. Core Principle: Think Like the User

Before implementing or changing any page, the AI agent must temporarily think from the user's perspective.

Do not ask only:

> "Does this component look good?"

Ask:

> "If I were the user, what would I want to do here, and how quickly can I do it?"

For every page, determine:

1. What is the user trying to accomplish?
2. What is the most common action?
3. What is the most important action?
4. What information does the user need immediately?
5. What information can remain secondary?
6. What actions will users perform repeatedly?
7. What should be accessible without opening multiple menus?
8. What information should remain visible while performing the task?
9. What information can safely be hidden behind a drawer, modal, tab, or details view?
10. What could confuse the user?
11. What could cause the user to make a mistake?
12. What would make the task slower?
13. What happens if the user has no data?
14. What happens if the user has a very large amount of data?
15. What happens if an API fails?
16. What happens if the user's screen is very small?
17. What happens if the user is using touch instead of a mouse?
18. What happens if the user uses only a keyboard?

### User-first rule

> **Do not make users search for something that they reasonably expect to be immediately accessible.**

---

# 3. Information Priority

Every page should have a clear information hierarchy.

Classify content as:

### P0 — Critical

Required to complete the primary task.

Examples:

- Primary CTA
- Current status
- Important alerts
- Main data
- Save/Submit action

### P1 — Important

Frequently needed but not always required.

Examples:

- Search
- Filters
- Sorting
- Secondary actions
- Important metadata

### P2 — Secondary

Useful but not required immediately.

Examples:

- Additional metadata
- Advanced options
- Detailed explanations

### P3 — Optional

Rarely used information.

Examples:

- Advanced configuration
- Technical details
- Secondary statistics

On small screens, prioritize:

```text
P0
 ↓
P1
 ↓
P2
 ↓
P3
```

Do not give P3 content the same visual importance as P0.

---

# 4. User Task Efficiency

For important workflows, minimize unnecessary steps.

Example:

```text
Good:

Dashboard
   ↓
Create Project
   ↓
Form
   ↓
Save
```

Avoid unnecessary navigation:

```text
Dashboard
   ↓
Menu
   ↓
Submenu
   ↓
Another page
   ↓
Open modal
   ↓
Open another modal
   ↓
Perform action
```

### Ask before adding a step

> Does this step provide meaningful value to the user?

If not, remove or simplify it.

---

# 5. Easy Access Standard

Frequently used functionality should be easy to reach.

For each application identify:

- Most frequently used feature.
- Most important feature.
- Most frequently accessed page.
- Most important data.
- Most common user action.
- Most common search/filter.
- Most common create/edit action.
- Most common navigation destination.

These should require minimal reasonable interaction.

### Example

If users frequently:

- Search users
- Create users
- Filter users
- Edit users

then the users page should make these functions easy to access:

```text
Users

[ Search users................ ] [Filter]

[ + Add User ]

User table
```

Do not hide all of these inside separate menus unless there is a strong UX reason.

---

# 6. User Mental Model

Use terminology users understand.

Prefer:

- "Create Project"
- "Delete User"
- "Save Changes"
- "Download Report"

over ambiguous labels such as:

- "Execute"
- "Process"
- "Action"
- "Manage"

unless those terms are established by the application's domain.

The interface should match the user's mental model rather than the developer's implementation model.

---

# 7. Primary Action Rule

Every major page should have an obvious primary action when a primary action exists.

Example:

```text
Projects

Manage all projects.

[ + Create Project ]

[Search........................]
```

Do not give five buttons equal visual importance.

Use:

- Primary
- Secondary
- Tertiary
- Destructive

consistently.

---

# 8. Device Responsiveness

Every page must be tested at minimum at:

| Device category | Example viewport |
|---|---:|
| Small mobile | 320 × 568 |
| Standard mobile | 375 × 667 |
| Large mobile | 430 × 932 |
| Tablet portrait | 768 × 1024 |
| Tablet landscape | 1024 × 768 |
| Laptop | 1366 × 768 |
| Desktop | 1440 × 900 |
| Large desktop | 1920 × 1080 |

Also test intermediate widths:

```text
360px
390px
414px
480px
600px
720px
900px
1200px
1440px
1600px+
```

Do not design only around named breakpoints.

The layout must remain functional between breakpoints.

---

# 9. Mobile-First Principle

Build responsive components from the smallest practical viewport upward.

Preferred strategy:

```text
Mobile
  ↓
Large Mobile
  ↓
Tablet
  ↓
Laptop
  ↓
Desktop
  ↓
Large Desktop
```

Do not simply shrink the desktop design.

Determine:

1. What is essential?
2. What is secondary?
3. What can collapse?
4. What can move below primary content?
5. What can become a drawer?
6. What can become a modal?
7. What can become horizontally scrollable?
8. What can be hidden without affecting task completion?

---

# 10. Page Density

### Desktop

More information can be displayed simultaneously.

### Tablet

Reduce:

- Padding
- Gaps
- Number of columns
- Secondary navigation
- Unnecessary metadata

### Mobile

Prioritize:

```text
Primary action
↓
Primary information
↓
Secondary information
↓
Optional information
```

Never create a compressed desktop dashboard on mobile.

Avoid:

```text
[Card][Card][Card][Card]
[Card][Card][Card][Card]
[Filter][Filter][Filter][Filter]
[Huge table................]
```

Instead:

```text
[Primary Card]

[Primary Card]

[Primary Action]

[Filter]

[Important Data]
```

---

# 11. Homepage Standard

The homepage should immediately communicate:

1. What the application does.
2. What the user should do next.
3. Where important information is located.
4. What the primary action is.

Do not overcrowd the first screen.

Prioritize:

```text
Heading
Short explanation
Primary action
Important summary/content
```

Avoid excessive:

- Cards
- CTAs
- Paragraphs
- Animations
- Decorative elements
- Large empty spaces

especially on mobile.

---

# 12. Navigation

Navigation must be predictable.

### Desktop

Use:

- Full navigation where appropriate.
- Clear active state.
- Predictable placement.
- Accessible dropdowns.

### Mobile

Use:

- Hamburger menu.
- Drawer.
- Bottom navigation where appropriate.
- Collapsible navigation.

Do not allow navigation to:

- Wrap awkwardly.
- Overlap.
- Become too small.
- Disappear without replacement.

Interactive touch areas should generally have approximately **44 × 44 CSS pixels** of usable area.

---

# 13. Header

Check:

- Logo alignment.
- Navigation.
- Search.
- Profile.
- Notifications.
- Primary actions.
- Mobile menu.
- Header height.
- Sticky behavior.

Never allow the header to overflow the viewport.

---

# 14. Cards

Cards must remain readable at every width.

Typical layout:

```text
Desktop  → 3–4 columns
Tablet   → 2 columns
Mobile   → 1 column
```

Cards should have:

- Consistent padding.
- Consistent heading hierarchy.
- Readable content.
- Clear action.
- Predictable spacing.
- Controlled text overflow.

Avoid fixed heights when content can vary.

Prefer:

```css
min-height
```

over hard-coded:

```css
height: 300px;
```

when appropriate.

---

# 15. Tables

Tables are a major source of responsive failures.

Never allow a table to break the entire page.

### Desktop

Show the full table when practical.

### Mobile options

#### Option A — Contained horizontal scrolling

```text
← ───────── TABLE ───────── →
```

Only the table should scroll horizontally.

The entire page should not.

#### Option B — Responsive row cards

Transform rows into readable cards when column comparison is not essential.

#### Option C — Priority columns

Show only the most important columns and place secondary data under:

```text
View Details
```

Never let a wide table create page-level horizontal overflow.

---

# 16. Search

Search should remain easy to access.

### Desktop

```text
[ Search __________________ ] [Search]
```

### Mobile

```text
[ Search__________________ ]

[Filter] [Sort]
```

Do not force many controls onto one mobile row.

Search should support where appropriate:

- Clear button.
- Loading state.
- Empty state.
- Error state.
- Keyboard interaction.
- Accessible label.
- Debouncing.
- Search suggestions.

---

# 17. Filters

### Desktop

```text
[Search] [Status] [Date] [Category] [More Filters]
```

### Mobile

```text
[Search]

[Filters]
```

Use a drawer, bottom sheet, or modal for complex filters.

Provide:

- Apply.
- Clear/reset.
- Active-filter indication.
- Result count where useful.

---

# 18. Buttons

Buttons must be:

- Readable.
- Aligned.
- Accessible.
- Easy to tap.
- Consistent.

If buttons do not fit:

```text
[Cancel]
[Save]
```

or:

```text
[Cancel] [Save]
```

depending on available space.

Never allow:

```text
[Sa] [Can] [Del]
```

because of insufficient width.

---

# 19. Forms

Every field should have:

- Label.
- Input.
- Validation.
- Error message.
- Appropriate input type.
- Focus state.

Do not use placeholder text as the only label.

Errors must explain:

```text
What is wrong
+
How to fix it
```

On mobile:

- Use appropriate keyboard types.
- Avoid unnecessarily narrow inputs.
- Keep submit actions easy to access.
- Prevent accidental destructive actions.

---

# 20. Modals and Dialogs

Ensure:

- Modal fits viewport.
- Content can scroll.
- Buttons remain accessible.
- Close control is reachable.
- Keyboard focus is managed.
- Escape works where appropriate.
- Mobile layout is usable.

Do not create dialogs that require users to zoom or horizontally scroll.

---

# 21. Dropdowns

Dropdowns must not:

- Extend outside viewport.
- Open behind important content.
- Become inaccessible.
- Require impossible mouse positioning.

For complex mobile interactions, consider:

- Bottom sheet.
- Dialog.
- Native select.

---

# 22. Typography

Maintain hierarchy:

```text
H1
 ↓
H2
 ↓
H3
 ↓
Body
 ↓
Caption
```

Use responsive typography.

Avoid headings that cause:

- Horizontal overflow.
- Clipping.
- Excessive scrolling.
- Overlapping.

---

# 23. Spacing

Use a consistent spacing system, for example:

```text
4px
8px
12px
16px
24px
32px
48px
64px
```

Avoid arbitrary spacing values throughout the application.

---

# 24. Images

Images must:

- Scale responsively.
- Maintain aspect ratio.
- Have appropriate alternative text.
- Avoid layout shifts.
- Be optimized.

Prefer responsive constraints such as:

```css
width: 100%;
max-width: 500px;
height: auto;
```

---

# 25. Icons

Icons must have understandable meaning.

Where necessary, pair icons with text.

Ensure:

- Consistent size.
- Alignment.
- Accessible labels.
- Adequate touch area.

---

# 26. Loading States

Every asynchronous component should have a loading state.

Use:

- Skeletons.
- Spinners.
- Progress indicators.

Do not show a blank component while data is loading.

---

# 27. Empty States

Every data-driven component needs an appropriate empty state.

Good:

```text
No projects found.

Create your first project to get started.

[Create Project]
```

Bad:

```text
No data
```

when the user needs guidance.

---

# 28. Error States

Every API-dependent component should handle:

```text
Loading
Success
Empty
Error
Retry
```

Example:

```text
Unable to load projects.

Please try again.

[Retry]
```

Do not leave users with blank screens.

---

# 29. Long Content

Test:

- Very long names.
- Long email addresses.
- Long URLs.
- Large numbers.
- Large currency values.
- Long descriptions.
- Missing images.
- Missing values.
- Unexpected API content.

Never assume normal-length content is the maximum.

---

# 30. Overflow

Every page must be checked for:

- Horizontal overflow.
- Vertical overflow.
- Text overflow.
- Image overflow.
- Table overflow.
- Modal overflow.
- Dropdown overflow.
- Button overflow.

Critical rule:

> **No unexpected horizontal scrollbar on the entire page.**

The page should not become wider than the viewport because of a single component.

---

# 31. Accessibility

At minimum:

- Semantic HTML.
- Keyboard navigation.
- Visible focus.
- Form labels.
- Accessible buttons.
- Appropriate alt text.
- Adequate contrast.
- Correct heading hierarchy.
- ARIA only when necessary.
- Accessible loading/error states.

Do not rely only on color to communicate status.

---

# 32. Performance

Minimize:

- Unnecessary API requests.
- Unnecessary re-renders.
- Large JS bundles.
- Unoptimized images.
- Blocking resources.
- Expensive render-time computation.

Use where appropriate:

- Lazy loading.
- Pagination.
- Virtualization.
- Caching.
- Debouncing.
- Code splitting.
- Image optimization.

---

# 33. API/Data States

Every API-driven page must define:

```text
Initial loading
      ↓
Success
      ↓
Empty
      ↓
Error
      ↓
Retry
```

For large datasets use:

- Pagination.
- Infinite scrolling.
- Virtualized lists.

Do not load thousands of records into the browser unnecessarily.

---

# 34. User Flow Review

For every major workflow, calculate the reasonable number of steps.

Ask:

- Can the user complete it faster?
- Is any step unnecessary?
- Is the next action obvious?
- Is the current state visible?
- Can the user recover from mistakes?
- Can the user return to where they were?
- Is important information lost while navigating?

---

# 35. User Error Prevention

Design to prevent mistakes rather than merely reporting them.

Examples:

- Disable Submit when required data is missing.
- Validate fields clearly.
- Confirm destructive actions.
- Warn about important unsaved changes.
- Use sensible defaults.
- Preserve entered data after recoverable errors.

---

# 36. Destructive Actions

For actions such as:

- Delete account.
- Delete project.
- Remove user.
- Cancel subscription.

use appropriate confirmation.

Example:

```text
Are you sure you want to delete this project?

This action cannot be undone.

[Cancel] [Delete]
```

Do not make destructive actions easy to trigger accidentally.

---

# 37. Unsaved Changes

For important forms:

```text
User enters data
      ↓
Attempts to leave
      ↓
Warn about unsaved changes
```

Use this only where losing the data would genuinely matter.

---

# 38. Notifications

Notifications should:

- Remain readable.
- Not cover primary controls.
- Work on mobile.
- Have appropriate duration.
- Be accessible.

Do not allow a toast to cover:

- Submit button.
- Navigation.
- Important data.

---

# 39. Responsive Component Architecture

Create reusable components such as:

```text
Button
Card
Modal
Table
SearchBar
Filter
Pagination
Dropdown
FormField
Navbar
Sidebar
Toast
Loader
EmptyState
ErrorState
```

Each reusable component should own its responsive behavior where practical.

---

# 40. Breakpoint Strategy

Use a small predictable breakpoint system.

For example:

```text
sm
md
lg
xl
2xl
```

Components must also behave correctly between breakpoints.

Do not create excessive breakpoint hacks.

---

# 41. Component Testing

Every reusable component should be tested in:

### Normal

```text
Normal content
```

### Minimum

```text
A
```

### Maximum

```text
Very long content...
```

### Loading

```text
Loading...
```

### Empty

```text
No data
```

### Error

```text
Failed to load
```

### Disabled

```text
Disabled
```

### Interaction

Test:

- Click.
- Keyboard.
- Touch.
- Focus.
- Hover where applicable.
- Keyboard navigation.

---

# 42. Page-Level Testing

For every page:

### Layout

- [ ] No component overlap.
- [ ] No unexpected horizontal scrolling.
- [ ] No clipped content.
- [ ] No broken images.
- [ ] No unexpected blank spaces.
- [ ] Consistent spacing.

### Navigation

- [ ] Header works.
- [ ] Sidebar works.
- [ ] Mobile navigation works.
- [ ] Back navigation works.
- [ ] Links work.

### Data

- [ ] Loading works.
- [ ] Success works.
- [ ] Empty state works.
- [ ] Error state works.
- [ ] Retry works.

### Interactions

- [ ] Buttons work.
- [ ] Forms work.
- [ ] Search works.
- [ ] Filters work.
- [ ] Sorting works.
- [ ] Pagination works.
- [ ] Modals work.
- [ ] Dropdowns work.

---

# 43. Responsive Test Matrix

Every important page should be tested:

| Component/Page | 320 | 375 | 430 | 768 | 1024 | 1366 | 1440 | 1920 |
|---|---|---|---|---|---|---|---|---|
| Header | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Navigation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cards | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tables | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Search | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Filters | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Buttons | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Forms | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Modals | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Footer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

# 44. Browser Testing

Test modern:

- Chrome.
- Edge.
- Firefox.
- Safari.

Especially:

- Chrome Android.
- Safari iPhone/iPad.
- Desktop Chrome.
- Desktop Edge.
- Desktop Firefox.

---

# 45. Real Device Testing

Emulators are useful, but important workflows should also be tested on actual:

- Android phone.
- iPhone.
- Tablet where applicable.
- Laptop/desktop.

Check:

- Touch.
- Scrolling.
- Keyboard.
- Viewport behavior.
- Orientation.
- Mobile browser behavior.
- Safe-area issues.

---

# 46. Orientation

Test:

```text
Portrait
Landscape
```

especially on phones and tablets.

---

# 47. Special Cases

Test:

### Small screen

320px width.

### Zoom

200% browser zoom.

### Large text

Ensure content remains usable.

### Slow network

Ensure loading states work.

### Offline/network failure

Ensure appropriate error handling.

### Long content

Ensure wrapping and overflow are safe.

### Empty database

Ensure empty states are useful.

### Large database

Ensure pagination/performance.

---

# 48. Security UI

Never expose:

- API keys.
- Secrets.
- Database errors.
- Internal stack traces.
- Internal infrastructure information.

Do not show:

```text
SQLException: connection refused...
```

Show:

```text
Something went wrong.

Please try again.
```

Log technical details securely on the backend.

---

# 49. Visual Consistency

All pages should share:

- Typography.
- Colors.
- Spacing.
- Buttons.
- Border radius.
- Shadows.
- Icons.
- Form styles.
- Error styles.
- Success styles.

Use a shared design system.

---

# 50. Design Tokens

Centralize:

```text
Colors
Typography
Spacing
Radius
Shadows
Breakpoints
Z-index
Transitions
```

Do not invent new values for every component.

---

# 51. Z-Index

Use a predictable layering system:

```text
Base content
 ↓
Sticky header
 ↓
Dropdown
 ↓
Modal
 ↓
Toast
```

Avoid random extreme values such as:

```css
z-index: 999999;
```

throughout the application.

---

# 52. Animation

Animations should improve usability.

Avoid excessive:

- Bouncing.
- Scaling.
- Sliding.
- Auto-playing effects.

Respect:

```css
prefers-reduced-motion
```

where appropriate.

---

# 53. AI Agent Development Workflow

Whenever the AI agent creates or modifies a frontend page/component:

```text
1. Understand existing design system.
2. Understand the user's primary goal.
3. Identify frequent user actions.
4. Identify critical information.
5. Identify secondary information.
6. Determine mobile behavior.
7. Determine tablet behavior.
8. Determine desktop behavior.
9. Build responsive structure.
10. Implement component.
11. Handle loading state.
12. Handle empty state.
13. Handle error state.
14. Handle long content.
15. Handle missing data.
16. Handle interaction states.
17. Check accessibility.
18. Check overflow.
19. Test all important viewport sizes.
20. Test primary user workflow.
21. Review visual consistency.
22. Fix issues.
23. Only then mark the component complete.
```

---

# 54. AI Agent User Simulation

Before declaring a page complete, simulate realistic users.

### New user

Ask:

- Do I understand this page?
- Do I know what to do?
- Can I find the primary action?
- Are labels understandable?

### Frequent user

Ask:

- Can I perform my repeated task quickly?
- Are frequently used features easy to access?
- Do I have unnecessary steps?
- Can I search/filter quickly?

### Mobile user

Ask:

- Can I use everything with my thumb?
- Are buttons easy to tap?
- Is important content visible?
- Do I have to scroll unnecessarily?
- Is the page overcrowded?

### Power user

Ask:

- Can I efficiently search/filter?
- Can I access advanced actions?
- Is information density sufficient?
- Are keyboard interactions useful?

### Error scenario

Ask:

- What happens if the API fails?
- What happens if I submit invalid data?
- Can I recover?
- Will I lose my entered data?

---

# 55. User Journey Test

For every important feature, document:

```text
User Goal
    ↓
Starting Point
    ↓
Required Actions
    ↓
Expected Result
    ↓
Possible Errors
    ↓
Recovery Path
```

Example:

```text
Goal:
Create a project.

Starting Point:
Dashboard.

Actions:
1. Click Create Project.
2. Enter project name.
3. Select configuration.
4. Click Save.

Expected:
Project appears in project list.

Error:
API failure.

Recovery:
Show error + Retry while preserving form data.
```

---

# 56. "Easy to Find" Rule

If a feature is used frequently, it should not require excessive navigation.

Evaluate:

```text
How many clicks/taps?
How many screens?
How much scrolling?
How much typing?
How much visual searching?
```

Reduce unnecessary interaction.

But do not expose every feature simultaneously just to reduce clicks.

The objective is:

> **High discoverability + low task friction + low visual clutter.**

---

# 57. "Don't Make Me Think" Rule

Users should not have to understand the application's internal architecture.

Avoid exposing implementation concepts when user-friendly concepts exist.

The UI should answer:

```text
Where am I?
What can I do?
What should I do next?
What just happened?
How do I recover?
```

---

# 58. Production Definition of Done

A page is production-ready only when:

### Functional

- [ ] All actions work.
- [ ] API integration works.
- [ ] Forms validate.
- [ ] Search works.
- [ ] Filters work.
- [ ] Sorting works.
- [ ] Pagination works.
- [ ] Navigation works.

### Responsive

- [ ] 320px works.
- [ ] 375px works.
- [ ] 430px works.
- [ ] 768px works.
- [ ] 1024px works.
- [ ] 1366px works.
- [ ] 1440px works.
- [ ] 1920px works.
- [ ] Portrait works.
- [ ] Landscape works.

### User Experience

- [ ] Primary action is obvious.
- [ ] Page isn't overcrowded.
- [ ] Important information is prioritized.
- [ ] Frequently used features are easy to access.
- [ ] User can complete the primary task efficiently.
- [ ] Navigation is predictable.
- [ ] Errors are understandable.
- [ ] Recovery is possible.
- [ ] Users are not forced through unnecessary steps.

### Accessibility

- [ ] Keyboard navigation works.
- [ ] Focus is visible.
- [ ] Form labels exist.
- [ ] Images have appropriate alternatives.
- [ ] Contrast is adequate.
- [ ] Touch targets are usable.

### Technical

- [ ] No console errors.
- [ ] No unexpected horizontal overflow.
- [ ] No broken components.
- [ ] No unnecessary API requests.
- [ ] Loading states exist.
- [ ] Empty states exist.
- [ ] Error states exist.
- [ ] Performance is acceptable.

---

# 59. Final AI Self-Review

Before finishing any frontend task, the AI must answer:

```text
USER EXPERIENCE
1. What is the user's primary goal?
2. Is the primary action obvious?
3. Can the user access important functionality easily?
4. Can a new user understand the page?
5. Can a frequent user complete the task quickly?
6. Are unnecessary steps removed?
7. Can the user recover from mistakes?

RESPONSIVENESS
8. Does it work at 320px?
9. Does it work at 375px?
10. Does it work at 430px?
11. Does it work at 768px?
12. Does it work at 1024px?
13. Does it work at 1366px?
14. Does it work at 1440px?
15. Does it work at 1920px?
16. Does portrait work?
17. Does landscape work?

LAYOUT
18. Is there horizontal overflow?
19. Are buttons aligned?
20. Are cards readable?
21. Are tables usable?
22. Is search aligned?
23. Are filters usable?
24. Are forms usable?
25. Are modals usable?
26. Does navigation work?

DATA STATES
27. Is loading handled?
28. Is empty state handled?
29. Is error state handled?
30. Is retry handled?
31. Is long content handled?
32. Is missing data handled?

ACCESSIBILITY
33. Can keyboard users operate it?
34. Are touch targets sufficiently large?
35. Are labels accessible?
36. Is focus visible?
37. Is contrast adequate?
38. Does 200% zoom remain usable?

QUALITY
39. Are there console errors?
40. Are there broken components?
41. Are API calls efficient?
42. Is the page consistent with the design system?
43. Is the implementation reusable?
44. Is the primary user task fast and reliable?
```

If any important answer is **No**, the page/component should **not** be considered production-ready.

---

# 60. Golden Rule

> **Do not optimize the website for appearance alone. Optimize it for successful user task completion.**

The priority should be:

```text
User Goal
   ↓
Task Efficiency
   ↓
Usability
   ↓
Accessibility
   ↓
Responsiveness
   ↓
Reliability
   ↓
Performance
   ↓
Consistency
   ↓
Visual Polish
```

A beautiful page that is difficult to use is **not production-ready**.

A responsive page that breaks with real data is **not production-ready**.

A desktop page that works only at 1440px is **not production-ready**.

A mobile page that technically fits but requires excessive scrolling and searching is **not production-ready**.

The final application should make the user's **most important task obvious, accessible, fast, reliable, and easy to complete on every supported device**.
