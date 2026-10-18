---
name: Serene Traceability
colors:
  surface: '#ecfdf7'
  surface-dim: '#cdded8'
  surface-bright: '#ecfdf7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#e6f7f1'
  surface-container: '#e0f2eb'
  surface-container-high: '#dbece6'
  surface-container-highest: '#d5e6e0'
  on-surface: '#0f1e1b'
  on-surface-variant: '#3f4945'
  inverse-surface: '#24332f'
  inverse-on-surface: '#e3f5ee'
  outline: '#6f7975'
  outline-variant: '#bec9c4'
  surface-tint: '#206a58'
  primary: '#136150'
  on-primary: '#ffffff'
  primary-container: '#337a68'
  on-primary-container: '#c0ffeb'
  inverse-primary: '#8ed4bf'
  secondary: '#286a4f'
  on-secondary: '#ffffff'
  secondary-container: '#aef1ce'
  on-secondary-container: '#2f7054'
  tertiary: '#933927'
  on-tertiary: '#ffffff'
  tertiary-container: '#b3503c'
  on-tertiary-container: '#ffefec'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a9f1db'
  primary-fixed-dim: '#8ed4bf'
  on-primary-fixed: '#002019'
  on-primary-fixed-variant: '#005141'
  secondary-fixed: '#aef1ce'
  secondary-fixed-dim: '#92d4b3'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#065138'
  tertiary-fixed: '#ffdad3'
  tertiary-fixed-dim: '#ffb4a5'
  on-tertiary-fixed: '#3e0500'
  on-tertiary-fixed-variant: '#7f2a19'
  background: '#ecfdf7'
  on-background: '#0f1e1b'
  surface-variant: '#d5e6e0'
typography:
  headline-xl:
    fontFamily: DM Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: DM Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: DM Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: DM Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-lg:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: DM Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes a high-trust, systematic, and forensic workspace tailored for food safety directors, compliance officers, and supply chain investigators. During high-stakes product recalls, operational stress is elevated; the interface counteracts urgency-induced fatigue through an understated, clinical editorial atmosphere. 

The aesthetic is anchored in warm minimalism—replacing cold enterprise greys and clinical stark whites with a tactile, parchment-inspired palette. Layouts emphasize clarity, precise alignment, breathable negative space, and quiet structural lines rather than loud notifications or dramatic visual depth. Data integrity, tree-graph lineage, and audit trails remain the primary visual focus without distracting ornamentation, heavy drop shadows, neon accents, or glassmorphic blurs.

## Colors

The palette employs warm, earthy neutrals combined with distinct functional accents to map out complex product lineages. Dark mode is excluded by design to preserve an archival, paper-record ambiance.

### Primary & Functional Roles
- **Canvas / Page Background:** `#FAF6EC` (Warm archival parchment)
- **Surface / Card Background:** `#FFFFFF` (Pure white for clarity against the warm base)
- **Primary Accent:** `#337A68` (Deep teal green; used for primary actions, selected states, and key navigational pivots with `#FFFFFF` text)
- **Text (Primary):** `#24332F` (Deep spruce black, high-contrast readability without absolute black severity)
- **Text (Secondary):** `#69736E` (Muted lichen slate for metadata, table headers, and supporting descriptions)
- **Border / Divider:** `#E7E3D9` (Hairline framing token for subtle edge containment)

### Status & Lineage Tints
Status tokens are strictly paired with low-saturation 12% tinted backgrounds for chips, path nodes, and badges:
- **Affected Path (Alert / Contaminated):** Solid `#E77861` (Coral) | Tint Background: `rgba(231, 120, 97, 0.12)` | Text: `#B34732`
- **Record Verified (Cleared / Certified):** Solid `#579779` (Sage) | Tint Background: `rgba(87, 151, 121, 0.12)` | Text: `#34654F`
- **Needs Review (Pending / Discrepancy):** Solid `#D9A638` (Marigold) | Tint Background: `rgba(217, 166, 56, 0.12)` | Text: `#8F6617`
- **Unknown Link (Unverified Node):** Solid `#9682CE` (Lavender) | Tint Background: `rgba(150, 130, 206, 0.12)` | Text: `#5F4B96`

## Typography

The typography uses DM Sans exclusively across all levels to maintain a cohesive, clean, and unpretentious rhythm. Tracking is slightly tightened on larger display headers to preserve density, while smaller technical labels and table metadata employ increased tracking for legibility during batch log analysis. 

Numeric displays, batch identifiers, timestamp listings, and GTIN codes utilize tabular figure styling (`font-variant-numeric: tabular-nums;`) to ensure alignment across supply chain trees and ledger layouts.

## Layout & Spacing

The layout is built upon an adaptive 12-column fluid grid system pinned to a maximum content width of 1440px to ensure wide-screen readability of deep traceability matrices.

- **Desktop (>=1024px):** 12 columns with `1.5rem` (24px) gutters and `2rem` (32px) margins. Side panels for node inspection default to 380px fixed width, floating above or sitting alongside the responsive graph canvas.
- **Tablet (768px - 1023px):** 8 columns with `1.5rem` gutters and `1.5rem` margins. Side inspection docks collapse into sliding bottom-sheet drawers.
- **Mobile (<768px):** 4 columns with `1rem` (16px) gutters and `1rem` margins. Nested supply node graphs switch to linear card cascades.

Vertical cadence relies on a strict 8px increment. Generous padding inside containers isolates disparate facility records, preventing visual crowding during critical audits.

## Elevation & Depth

Visual hierarchy is maintained without heavy shadows, dark fills, or blur effects. Separation is achieved through distinct tonal layering and crisp, thin lines:

1. **Base Tier:** `#FAF6EC` serves as the canvas substrate.
2. **Surface Tier:** Card containers and data sheets sit flat on `#FFFFFF` with a 1px solid border in `#E7E3D9`.
3. **Elevated Overlays (Modals, Context Menus, Tooltips):** Background remains `#FFFFFF` bounded by a 1px solid `#E7E3D9` border, supported by an ambient low-opacity shadow tinted with the primary hue: `0 4px 16px rgba(36, 51, 47, 0.06)`. Heavy cast shadows are prohibited.

## Shapes

All interactive containers, surfaces, inputs, and alert panels utilize a unified 12px (`0.75rem`) border radius. This geometry softens the industrial nature of supply chain ledgers while maintaining sufficient structural rigidity for dense tabular data.

Exceptions:
- Micro-badges and status indicator chips use a pill geometry (`9999px`) to distinguish categorical indicators from actionable card surfaces.
- Small form controls (such as checkboxes) scale down to a proportional 4px radius.

## Components

### Buttons
- **Primary:** Filled `#337A68` with `#FFFFFF` text. Hover state: `#2B6758`. Active state: `#245447`. 12px radius, height 40px, horizontal padding `1.25rem`. No border.
- **Secondary / Outline:** Background `#FFFFFF`, 1px border `#E7E3D9`, text `#24332F`. Hover state: background `#FAF6EC`, border `#337A68`.
- **Ghost:** Transparent background, text `#69736E`. Hover state: background `rgba(51, 122, 104, 0.08)`, text `#337A68`.

### Status Badges & Chips
- Fully rounded pills (`border-radius: 9999px`) with 11px uppercase bold labels (`label-sm`), padding `4px 10px`.
- **Affected Path:** Background `rgba(231, 120, 97, 0.12)`, text `#B34732`, optional 6px inner dot `#E77861`.
- **Record Verified:** Background `rgba(87, 151, 121, 0.12)`, text `#34654F`, optional 6px inner dot `#579779`.
- **Needs Review:** Background `rgba(217, 166, 56, 0.12)`, text `#8F6617`, optional 6px inner dot `#D9A638`.
- **Unknown Link:** Background `rgba(150, 130, 206, 0.12)`, text `#5F4B96`, optional 6px inner dot `#9682CE`.

### Cards & Panels
- Background `#FFFFFF`, border `1px solid #E7E3D9`, 12px border radius, padding `1.5rem`.
- Header areas feature clean separation using an inner horizontal divider in `#E7E3D9`.

### Input Fields & Controls
- **Inputs & Selects:** Height 40px, background `#FFFFFF`, border `1px solid #E7E3D9`, radius 12px, text `#24332F`, placeholder `#69736E`. Focused state: border `#337A68`, outline `2px solid rgba(51, 122, 104, 0.2)`.
- **Checkboxes & Radios:** 18px size. Unchecked: `#FFFFFF` fill with `1px solid #E7E3D9`. Checked: `#337A68` fill with white checkmark/dot.

### Domain-Specific Components
- **Supply Mesh Node:** Canvas graph node rendered as a white 12px rounded card with an outer 1px border in `#E7E3D9`. Left border features a 4px colored accent strip denoting node status (Coral, Sage, Marigold, or Lavender).
- **Traceability Ledger Tables:** Borderless rows separated by `1px solid #E7E3D9`. Alternating row zebra striping is omitted; hover states softly tint the row background to `#FAF6EC`.