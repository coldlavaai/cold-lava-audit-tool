# Cold Lava Audit Tool - Design Implementation

This tool follows the **Cold Lava Design System v2.0** — fully branded with CYAN accent.

📖 **Full Design System Documentation:**
https://github.com/coldlavaai/cold-lava-platform/blob/main/DESIGN-SYSTEM.md

---

## Implementation Checklist

✅ **Colors**
- Dark theme (#030305 background)
- Cyan CTAs (#06B6D4)
- Card backgrounds (#111111)
- Border color (#1a1a1a)
- Grain overlay texture

✅ **Typography**
- Primary: Inter
- Mono: JetBrains Mono
- Headings: bold, white
- Body: regular weight

✅ **Components**
- Rounded corners (`rounded-xl` = 12px)
- Orange primary buttons with hover states
- Card hover effects (orange border tint)
- Trust indicators below CTAs

✅ **Animations**
- Fade-in on page load
- Staggered delays (0.1s increments)
- Smooth transitions on hover

✅ **Layout**
- Max width containers (1280px, 672px)
- Responsive grids (2 → 4 cols)
- Consistent padding/spacing

✅ **Branding**
- CL logo with gradient border
- "COLD LAVA" in JetBrains Mono
- Footer with copyright + version

---

## Files

- `tailwind.config.ts` — Custom color palette
- `app/globals.css` — Fonts, scrollbar, animations
- `app/page.tsx` — Main landing page (reference implementation)
- `app/audit/page.tsx` — Results page

---

## Quick Reference

### Color Palette
```css
bg-cl-bg        #030305  /* Page background */
bg-cl-card      #111111  /* Cards */
border-cl-border #1a1a1a /* Borders */
text-cl-cyan    #06B6D4  /* Primary action */
text-white      #FFFFFF  /* Primary text */
text-cl-muted   #86868B  /* Secondary text */
```

### Common Patterns

**Primary Button:**
```tsx
<button className="px-8 py-4 rounded-xl bg-cl-cyan hover:bg-cl-cyan-light 
                   text-white font-semibold transition-all">
  Run Free Audit
</button>
```

**Card:**
```tsx
<div className="p-6 rounded-xl border border-cl-border bg-cl-card 
                hover:border-cl-cyan/30 transition-colors">
  {/* content */}
</div>
```

**Fade-in Section:**
```tsx
<div className="fade-in fade-in-delay-1">
  {/* content */}
</div>
```

---

For any design questions, refer to the main design system doc above.
