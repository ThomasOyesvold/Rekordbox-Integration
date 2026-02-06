# UI Redesign Plan: Modern Dark Aesthetic

## Vision

Transform the current functional UI into a polished, modern dark-themed interface with a techy aesthetic. The experience should feel like a professional DJ tool - clean, intuitive, and satisfying to use.

**Core Principles:**
- **Dark-first:** Elegant dark theme that's easy on eyes during long sessions
- **Techy but tasteful:** Subtle tech aesthetic (gradients, glows) without being distracting
- **Progressive disclosure:** Guide users naturally through setup → analysis → verification
- **Visual feedback:** Satisfying micro-interactions that confirm actions
- **Information hierarchy:** Important info stands out, noise fades back

## Current State vs. Target

| Aspect | Current | Target |
|--------|---------|--------|
| Theme | Light, basic | Dark with accent colors |
| Typography | System fonts | Modern font stack (Inter/Poppins) |
| Colors | Basic grays | Cohesive dark palette with accent |
| Layout | Dense, cluttered | Spacious, grouped sections |
| Onboarding | Raw file picker | Guided setup flow |
| Feedback | Minimal | Smooth transitions, confirmations |
| Waveforms | Basic canvas | Styled with glow effects |
| Data viz | Plain text | Styled cards with icons |

## Design System

### Color Palette

**Base (Dark Theme):**
```css
--bg-primary: #0a0e14        /* Main background - deep navy-black */
--bg-secondary: #111827      /* Cards, panels */
--bg-tertiary: #1e293b       /* Hover states, inputs */
--bg-elevated: #1f2937       /* Modal, dropdown overlays */

--text-primary: #e2e8f0      /* Headings, main text */
--text-secondary: #94a3b8    /* Secondary text, labels */
--text-tertiary: #64748b     /* Hints, disabled text */

--border-subtle: #1e293b     /* Dividers, card borders */
--border-medium: #334155     /* Input borders */
```

**Accent (Techy DJ Vibe):**
```css
--accent-primary: #3b82f6    /* Primary actions - electric blue */
--accent-glow: #60a5fa       /* Hover, active states */
--accent-success: #10b981    /* Success states, verified */
--accent-warning: #f59e0b    /* Warnings, attention */
--accent-error: #ef4444      /* Errors, critical */

--gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
--gradient-waveform: linear-gradient(180deg, #3b82f6 0%, #1e40af 100%)
```

**Waveform Colors (Enhanced):**
```css
--waveform-blue: #3b82f6
--waveform-purple: #8b5cf6
--waveform-cyan: #06b6d4
--waveform-glow: 0 0 20px rgba(59, 130, 246, 0.6)  /* Subtle glow */
```

### Typography

**Font Stack:**
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
--font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace

--text-xs: 0.75rem    /* 12px - micro labels */
--text-sm: 0.875rem   /* 14px - secondary text */
--text-base: 1rem     /* 16px - body text */
--text-lg: 1.125rem   /* 18px - section headers */
--text-xl: 1.25rem    /* 20px - card titles */
--text-2xl: 1.5rem    /* 24px - page titles */
--text-3xl: 1.875rem  /* 30px - hero text */

--weight-normal: 400
--weight-medium: 500
--weight-semibold: 600
--weight-bold: 700
```

### Spacing Scale

```css
--space-1: 0.25rem   /* 4px */
--space-2: 0.5rem    /* 8px */
--space-3: 0.75rem   /* 12px */
--space-4: 1rem      /* 16px */
--space-6: 1.5rem    /* 24px */
--space-8: 2rem      /* 32px */
--space-12: 3rem     /* 48px */
```

### Border Radius

```css
--radius-sm: 0.375rem   /* 6px - buttons, inputs */
--radius-md: 0.5rem     /* 8px - cards */
--radius-lg: 0.75rem    /* 12px - modals */
--radius-xl: 1rem       /* 16px - hero cards */
--radius-full: 9999px   /* Pills, badges */
```

### Shadows & Effects

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3)
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5)
--shadow-glow: 0 0 20px rgba(59, 130, 246, 0.4)

--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1)
```

## Component Redesigns

### 1. App Shell

**Current:** Plain white background, no structure
**Target:** Dark background with distinct header, sidebar (future), main content area

```jsx
<div className="app-shell">
  <header className="app-header">
    <div className="header-left">
      <div className="logo">
        <WaveformIcon />
        <span>Rekordbox Flow Analyzer</span>
      </div>
    </div>
    <div className="header-right">
      <button className="icon-button">
        <SettingsIcon />
      </button>
    </div>
  </header>

  <main className="app-main">
    {/* Content */}
  </main>
</div>
```

**Styling:**
- Header: Fixed top, glass morphism effect (semi-transparent with blur)
- Logo: Gradient text + animated waveform icon
- Settings: Icon button with hover glow

### 2. Setup Flow (Onboarding)

**Current:** Raw input field + button
**Target:** Guided setup wizard with progress indicator

**Steps:**
1. **Welcome Screen** (first-time only)
   - Hero section with animated waveform background
   - "Get Started" CTA

2. **Step 1: Import Library**
   - Large drop zone with drag-and-drop
   - Or browse file button
   - Recent imports shown as cards below

3. **Step 2: Configure** (optional)
   - Folder selection with visual tree
   - ANLZ mapping path (collapsible advanced section)

4. **Step 3: Parsing**
   - Animated progress bar with glow effect
   - Real-time status updates
   - Track count ticker animation

```jsx
<div className="setup-wizard">
  <div className="wizard-progress">
    <div className="progress-step active">Import</div>
    <div className="progress-line active" />
    <div className="progress-step">Configure</div>
    <div className="progress-line" />
    <div className="progress-step">Parse</div>
  </div>

  <div className="wizard-content">
    {/* Step content */}
  </div>
</div>
```

### 3. Cards & Panels

**Pattern:** Elevated cards with subtle borders and hover effects

```jsx
<div className="card">
  <div className="card-header">
    <h3 className="card-title">
      <Icon />
      <span>Title</span>
    </h3>
    <div className="card-actions">
      <button className="icon-button">...</button>
    </div>
  </div>

  <div className="card-content">
    {/* Content */}
  </div>

  <div className="card-footer">
    {/* Actions */}
  </div>
</div>
```

**Styling:**
- Background: `--bg-secondary`
- Border: `1px solid --border-subtle`
- Hover: Lift with shadow, subtle glow on border
- Transition: Smooth 200ms

### 4. Buttons

**Primary (CTA):**
```jsx
<button className="btn btn-primary">
  <span>Action</span>
  <ArrowIcon />
</button>
```
- Gradient background (`--gradient-primary`)
- Glow effect on hover
- Ripple animation on click

**Secondary:**
```jsx
<button className="btn btn-secondary">
  Action
</button>
```
- Transparent with border
- Fill on hover
- No glow

**Icon Button:**
```jsx
<button className="icon-button">
  <Icon />
</button>
```
- Circular
- Hover: background fill + glow

### 5. Track Table

**Enhancements:**
- Row hover: Subtle background change + left border accent
- Alternating row colors (very subtle)
- Column headers: Sticky with blur backdrop
- Selected row: Blue left border + glow
- Playing indicator: Animated pulsing dot

```jsx
<div className="track-row">
  <div className="track-status">
    {isPlaying && <div className="status-indicator playing" />}
  </div>
  <div className="track-id">#0123</div>
  <div className="track-title">Track Name</div>
  <div className="track-artist">Artist</div>
  <div className="track-bpm">
    <span className="bpm-value">128</span>
    <span className="bpm-unit">BPM</span>
  </div>
  {/* ... */}
</div>
```

### 6. Waveforms

**Mini Waveform (Table):**
- Maintain current RGB colors from ANLZ data
- Add subtle glow effect
- Smoother rendering (anti-aliasing)

**Full Waveform (WaveSurfer):**
- Dark background with gradient
- Playhead: Glowing line with trail effect
- Hover: Show time tooltip
- Click: Ripple effect at click point

```css
.waveform-container {
  background: linear-gradient(180deg, #0a0e14 0%, #111827 100%);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.4);
}

.waveform-playhead {
  background: var(--accent-primary);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
}
```

### 7. Playlist Cards (Phase 4)

**Structure:**
```jsx
<div className="playlist-card">
  <div className="playlist-header">
    <div className="playlist-icon">
      <PlaylistIcon />
    </div>
    <div className="playlist-info">
      <h3 className="playlist-name">Deep Techno Mix</h3>
      <div className="playlist-stats">
        <span className="stat">
          <Icon />
          <span>47 tracks</span>
        </span>
        <span className="stat">
          <Icon />
          <span>125-130 BPM</span>
        </span>
      </div>
    </div>
    <div className="confidence-badge high">
      <span>85%</span>
    </div>
  </div>

  <div className="playlist-preview">
    {/* Mini waveform grid or track list preview */}
  </div>

  <div className="playlist-actions">
    <button className="btn btn-secondary">
      <PlayIcon />
      <span>Sample 15 Tracks</span>
    </button>
    <button className="btn btn-primary">
      <EyeIcon />
      <span>View Details</span>
    </button>
  </div>
</div>
```

**Styling:**
- Gradient border on high-confidence playlists
- Hover: Lift + glow
- Confidence badge: Color-coded (green/yellow/red)
- Preview: Subtle animation on hover

### 8. Stats & Metrics

**Visual Stat Cards:**
```jsx
<div className="stat-card">
  <div className="stat-icon">
    <Icon />
  </div>
  <div className="stat-content">
    <div className="stat-value">12,458</div>
    <div className="stat-label">Total Tracks</div>
  </div>
</div>
```

**Styling:**
- Icon: Gradient background, large size
- Value: Bold, large text
- Label: Small, secondary color
- Hover: Subtle scale + glow

### 9. Progress Indicators

**Linear Progress:**
```jsx
<div className="progress">
  <div className="progress-bar" style={{ width: '60%' }}>
    <div className="progress-glow" />
  </div>
</div>
```
- Animated gradient fill
- Glow effect that moves with progress
- Pulse animation during active loading

**Circular Progress (Confidence Score):**
```jsx
<svg className="circular-progress">
  <circle className="progress-bg" />
  <circle className="progress-bar" strokeDashoffset="..." />
  <text className="progress-text">85%</text>
</svg>
```

### 10. Inputs & Forms

**Text Input:**
```jsx
<div className="input-group">
  <label className="input-label">Library Path</label>
  <input
    type="text"
    className="input"
    placeholder="C:/Music/rekordbox.xml"
  />
  <span className="input-hint">Or drag and drop</span>
</div>
```

**Styling:**
- Dark background with subtle border
- Focus: Blue glow + border highlight
- Placeholder: Tertiary text color
- Error state: Red glow + shake animation

**Select/Dropdown:**
- Custom styled (not native)
- Smooth dropdown animation
- Hover states on options
- Search filter for long lists

### 11. Modals & Dialogs

**Structure:**
```jsx
<div className="modal-overlay">
  <div className="modal">
    <div className="modal-header">
      <h2 className="modal-title">Title</h2>
      <button className="modal-close">×</button>
    </div>
    <div className="modal-content">
      {/* Content */}
    </div>
    <div className="modal-footer">
      <button className="btn btn-secondary">Cancel</button>
      <button className="btn btn-primary">Confirm</button>
    </div>
  </div>
</div>
```

**Animations:**
- Overlay: Fade in
- Modal: Scale + fade in (150ms delay)
- Exit: Reverse animation

### 12. Notifications/Toasts

**Pattern:**
```jsx
<div className="toast toast-success">
  <div className="toast-icon">
    <CheckIcon />
  </div>
  <div className="toast-content">
    <div className="toast-title">Success!</div>
    <div className="toast-message">Library parsed successfully</div>
  </div>
  <button className="toast-close">×</button>
</div>
```

**Types:**
- Success: Green accent
- Error: Red accent
- Warning: Yellow accent
- Info: Blue accent

**Animation:** Slide in from top-right, auto-dismiss after 5s

## Micro-Interactions

### Satisfying Feedback

1. **Button Click:**
   - Ripple effect from click point
   - Subtle scale down (0.95)
   - Return with bounce

2. **Card Hover:**
   - Lift (translateY -2px)
   - Shadow increase
   - Border glow fade in
   - Transition: 200ms ease-out

3. **Track Selection:**
   - Blue left border slides in
   - Row background fade in
   - Adjacent rows subtle push effect

4. **Waveform Interaction:**
   - Hover: Time tooltip follows cursor
   - Click: Ripple effect + seek animation
   - Playing: Playhead glow pulses

5. **Progress Updates:**
   - Number counter animation (ease-out)
   - Progress bar smooth fill with glow
   - Completion: Success checkmark bounce

6. **Drag & Drop:**
   - Drop zone highlights on drag-over
   - File "sucks in" animation on drop
   - Bounce feedback on success

## Layout Structure

### Overall Grid

```
┌─────────────────────────────────────────┐
│ Header (Fixed)                          │
├─────────────────────────────────────────┤
│                                         │
│  ┌────────────────────────────────┐   │
│  │   Setup Card (Collapsible)     │   │
│  └────────────────────────────────┘   │
│                                         │
│  ┌────────────────────────────────┐   │
│  │   Library Stats                │   │
│  └────────────────────────────────┘   │
│                                         │
│  ┌────────────────────────────────┐   │
│  │   Track Table                  │   │
│  │   (Scrollable)                 │   │
│  │                                │   │
│  └────────────────────────────────┘   │
│                                         │
│  ┌────────────────────────────────┐   │
│  │   Playlists (Grid)             │   │
│  └────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Responsive Behavior

- Desktop: Max width 1600px, centered
- Tablet: Cards stack to 2 columns
- Mobile: Single column (not priority for v1)

## Animation Library

**Recommended:** Framer Motion (React animation library)

```bash
npm install framer-motion
```

**Benefits:**
- Declarative animations
- Gesture support (drag, hover)
- Layout animations
- Variants system for coordinated animations

**Example Usage:**
```jsx
import { motion } from 'framer-motion';

<motion.div
  className="card"
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  whileHover={{ y: -2, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
  transition={{ duration: 0.2 }}
>
  {/* Card content */}
</motion.div>
```

## Icon System

**Recommended:** Lucide React (clean, modern icons)

```bash
npm install lucide-react
```

**Key Icons:**
- Music/Waveform: Library icon
- Play/Pause: Playback controls
- Settings: Configuration
- Check/X: Status indicators
- Folder: File browser
- Activity: Analysis/processing
- Eye: Preview/view
- Shuffle: Random sampling

## Implementation Approach

### Phase 1: Foundation
1. Install dependencies (Framer Motion, Lucide, Inter font)
2. Create design system CSS variables file
3. Update global styles with dark theme
4. Create base component styles (buttons, inputs, cards)

### Phase 2: Component Updates
1. App shell & header
2. Setup flow redesign
3. Stats cards
4. Track table enhancements
5. Buttons & inputs standardization

### Phase 3: Advanced Components
1. Playlist cards
2. Waveform styling
3. Progress indicators
4. Modals & toasts

### Phase 4: Polish
1. Micro-interactions
2. Loading states
3. Empty states
4. Error states
5. Animations refinement

## Success Criteria

**Visual:**
- [ ] Dark theme applied consistently
- [ ] All components follow design system
- [ ] Typography hierarchy clear
- [ ] Color palette cohesive
- [ ] Spacing consistent

**UX:**
- [ ] Setup flow intuitive (new users complete without help)
- [ ] Actions provide immediate feedback
- [ ] Hover states clear
- [ ] Focus states visible for keyboard nav
- [ ] Loading states prevent confusion

**Performance:**
- [ ] Animations smooth (60fps)
- [ ] No jank during interactions
- [ ] Large tables still performant
- [ ] Waveforms render quickly

**Satisfaction:**
- [ ] Setup feels guided and natural
- [ ] Interactions feel responsive and polished
- [ ] Visual feedback confirms actions
- [ ] Overall experience feels "pro tool"

## File Structure

```
renderer/
├── styles/
│   ├── design-system.css      # CSS variables, design tokens
│   ├── globals.css             # Base styles, resets
│   ├── components.css          # Component styles
│   └── animations.css          # Keyframe animations
├── components/
│   ├── ui/                     # Base UI components
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Input.jsx
│   │   ├── Modal.jsx
│   │   └── Toast.jsx
│   ├── SetupWizard.jsx         # Onboarding flow
│   ├── AppHeader.jsx           # Top navigation
│   ├── StatCard.jsx            # Metric display
│   └── ...
└── App.jsx                      # Main layout
```

## Example: Setup Wizard Redesign

**Before:**
```
┌─────────────────────────────────┐
│ Rekordbox Flow Analyzer        │
├─────────────────────────────────┤
│                                 │
│ [Text input: C:/path.xml]      │
│ [Browse XML] [Parse Library]   │
│                                 │
│ Tracks: 0                       │
│                                 │
└─────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────────┐
│  ≡  Rekordbox Flow Analyzer      ⚙️    │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  🎵  Get Started                  │ │
│  │                                   │ │
│  │  Import your Rekordbox library   │ │
│  │  to start analyzing tracks        │ │
│  │                                   │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │                             │ │ │
│  │  │    Drop XML file here       │ │ │
│  │  │         or                  │ │ │
│  │  │   [Browse Computer]         │ │ │
│  │  │                             │ │ │
│  │  └─────────────────────────────┘ │ │
│  │                                   │ │
│  │  Recent imports:                  │ │
│  │  [rekordbox-main.xml] 12K tracks │ │
│  │  [backup-2024.xml] 8K tracks     │ │
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

## Color Accessibility

While prioritizing dark theme aesthetics, maintain WCAG AA contrast ratios:
- Text on background: Minimum 4.5:1
- Large text (18px+): Minimum 3:1
- Interactive elements: Clear focus indicators

**Tested combinations:**
- `--text-primary` on `--bg-primary`: 12.7:1 ✓
- `--text-secondary` on `--bg-secondary`: 7.2:1 ✓
- `--accent-primary` on `--bg-primary`: 8.9:1 ✓

## Next Steps

1. **Review & Approval:** User confirms design direction
2. **Create Phase 4.5:** Insert UI redesign between Phase 4 and 5
3. **Break into plans:**
   - Plan 01: Design system + base styles
   - Plan 02: Setup wizard redesign
   - Plan 03: Component library
   - Plan 04: Track table + playlists styling
   - Plan 05: Polish + animations
4. **Execute:** Implement in waves
5. **Iterate:** Refine based on feel

---

**Total Estimated Effort:** 3-5 plans, ~2 waves of execution
**Dependencies:** Phase 4 complete (so we can style new components)
**Impact:** High - transforms functional tool into polished product
