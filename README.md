# Cold Lava Audit Tool

**Live Demo:** https://audit-tool-ruby.vercel.app

Free website audit tool that analyzes performance, reviews, trust signals, and competitor positioning. Generates branded PDF reports.

---

## 🎨 Design System Compliance

This tool is the **reference implementation** for the [Cold Lava Design System v2.0](https://github.com/coldlavaai/cold-lava-platform/blob/main/DESIGN-SYSTEM.md).

**Fully Cold Lava branded** with:
- Cyan accent (#06B6D4)
- Grain overlay texture
- Corner bracket patterns
- Opacity-based hierarchy
- Inter + JetBrains Mono fonts

See [DESIGN.md](./DESIGN.md) for implementation details.

---

## 🚀 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS (custom Cold Lava theme)
- **Fonts:** Inter + JetBrains Mono (Google Fonts)
- **Deployment:** Vercel
- **Audit Engine:** Puppeteer

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

Open http://localhost:3000

---

## 📁 Project Structure

```
audit-tool/
├── app/
│   ├── page.tsx           # Landing page (main form)
│   ├── audit/
│   │   └── page.tsx       # Results page
│   ├── api/
│   │   └── audit/
│   │       └── route.ts   # Audit API endpoint
│   ├── globals.css        # Global styles + animations
│   └── layout.tsx         # Root layout
├── tailwind.config.ts     # Cold Lava color palette
├── DESIGN.md              # Design implementation guide
└── README.md              # This file
```

---

## 🎯 Features

- ✅ Website performance analysis
- ✅ Online review audit
- ✅ Trust signal detection
- ✅ Competitor comparison
- ✅ Branded PDF report generation
- ✅ Email delivery (optional)
- ✅ Mobile responsive
- ✅ Dark theme
- ✅ Fade-in animations

---

## 🔗 Related

- **Main Platform:** https://github.com/coldlavaai/cold-lava-platform
- **Design System:** [DESIGN-SYSTEM.md](https://github.com/coldlavaai/cold-lava-platform/blob/main/DESIGN-SYSTEM.md)
- **Live Tool:** https://audit-tool-ruby.vercel.app

---

## 📝 License

© 2026 Cold Lava. All rights reserved.
