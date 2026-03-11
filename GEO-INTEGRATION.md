# GEO-SEO Integration — Audit Tool

**Date:** 2026-03-11  
**Status:** ✅ DEPLOYED  
**Purpose:** Connect audit tool to SEO Agent for deep GEO analysis

---

## What Was Added

### 1. GEO-Specific Checks in Audit API

**llms.txt Validation**
- Checks if `/llms.txt` exists on target site
- Validates format (title, sections, links)
- Reports: exists, valid, content

**Schema.org Detection**
- Finds all `<script type="application/ld+json">` blocks
- Extracts schema types (Organization, LocalBusiness, Product, etc.)
- Reports: present, types found

**AI Crawler Analysis** (robots.txt)
- Checks which AI crawlers are allowed/blocked:
  - GPTBot (OpenAI)
  - ClaudeBot (Anthropic)
  - PerplexityBot
  - Google-Extended
  - cohere-ai
  - anthropic-ai
- Critical issue if any are blocked

**Brand Authority Signals**
- YouTube presence detection (channel links, embedded videos)
- Placeholder for Reddit/Wikipedia checks (SEO Agent handles)

**Content Analysis**
- Homepage word count
- Blog post detection
- FAQ section detection
- Heading distribution (H1, H2, H3)

### 2. File Drop System for SEO Agent

**What Gets Saved**
- Full audit results in JSON format
- Saved to: `/home/moltbot/seoagent-bot/incoming-audits/[domain]_[timestamp].json`

**Data Format** (matches SEO Agent's spec):
```json
{
  "prospect": {
    "domain": "example.com",
    "company_name": "Example Ltd",
    "contact_email": "contact@example.com",
    "submitted_at": "2026-03-11T14:30:00Z",
    "audit_url": "https://example.com"
  },
  "technical_seo": {
    "page_speed_score": 75,
    "mobile_friendly": true,
    "https_enabled": true,
    "meta_description_present": false,
    "h1_tags": ["Homepage H1"],
    "images_without_alt": 12,
    "broken_links": 0,
    "sitemap_present": false,
    "robots_txt_present": true
  },
  "geo": {
    "citability_score": 0,
    "grade_distribution": {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0},
    "schema_present": false,
    "schema_types": [],
    "llmstxt_present": false,
    "llmstxt_valid": false,
    "ai_crawlers_allowed": ["GPTBot", "ClaudeBot", ...],
    "ai_crawlers_blocked": []
  },
  "brand_authority": {
    "youtubePresence": false,
    "redditMentions": 0,
    "wikipediaPage": false,
    "linkedinCompanyPage": false,
    "issues": [...]
  },
  "content": {
    "wordCountHomepage": 600,
    "blogPosts": 0,
    "faqSections": 0,
    "headings": {"h1": 1, "h2": 5, "h3": 8}
  },
  "scores": {
    "overall": 68,
    "geo": 55,
    "website": 82,
    "reviews": 45,
    "trust": 70,
    "competitive": 60
  },
  "raw_data": {
    "homepageHtml": "<html>...</html>",
    "llmsTxt": "..."
  }
}
```

### 3. Updated Scoring System

**GEO Score (0-100)**
- No llms.txt: -20 points
- No Schema.org: -25 points
- AI crawlers blocked: -30 points
- No YouTube presence: -15 points

**Overall Score Updated**
- Website: 25% (down from 30%)
- Reviews: 20% (down from 25%)
- Trust: 20% (down from 25%)
- Competitive: 15% (down from 20%)
- **GEO: 20% (NEW)**

### 4. New Recommendations

Added GEO-specific recommendations:
- Create llms.txt file
- Add Schema.org markup
- Unblock AI crawlers in robots.txt
- Build YouTube presence

---

## Workflow

1. **Prospect submits URL** via audit form at coldlava.ai
2. **Audit tool runs** full analysis (technical SEO + GEO checks)
3. **JSON saved** to `/home/moltbot/seoagent-bot/incoming-audits/`
4. **SEO Agent triggered** (manual for now): "Analyze audit for [domain]"
5. **SEO Agent runs deep analysis**:
   - Python citability scorer
   - Brand scanner (YouTube/Reddit/Wikipedia)
   - Content rewrite suggestions
6. **SEO Agent generates deliverables**:
   - Executive summary (2-page PDF)
   - Detailed action plan (10-15 pages)
   - llms.txt file (generated)
   - Schema recommendations
   - Meta tag fixes
7. **Cold Lava delivers** action plan to prospect

---

## What's NOT Implemented Yet

### Citability Scoring (Python Required)
- **Why:** citability_scorer.py requires Python + dependencies
- **Solution:** SEO Agent runs this on saved audit data
- **Placeholder:** Currently returns 0

### Brand Scanner (External APIs)
- **Why:** Requires YouTube/Reddit/Wikipedia API calls
- **Solution:** SEO Agent handles with Python scripts
- **Placeholder:** Basic YouTube link detection only

### Automated Trigger
- **Current:** Manual message to SEO Agent
- **Future:** Auto-trigger via webhook/cron after audit completes

---

## Testing

**Test an audit:**
```bash
curl -X POST https://audit-tool.coldlava.ai/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url": "coldlava.ai", "email": "test@example.com"}'
```

**Check saved file:**
```bash
ls -lh /home/moltbot/seoagent-bot/incoming-audits/
cat /home/moltbot/seoagent-bot/incoming-audits/coldlava-ai_*.json
```

**Trigger SEO Agent:**
Message SEO Agent: "Analyze audit for coldlava.ai"

---

## Deployment

**GitHub:** https://github.com/coldlavaai/cold-lava-audit-tool  
**Commit:** d4986ff  
**Live:** https://audit-tool.coldlava.ai (auto-deploys from GitHub)

---

## Next Steps

1. Test with real prospect domain
2. Let SEO Agent process the saved audit
3. Review SEO Agent's deliverables
4. Iterate on data format if needed
5. Add automated trigger (webhook/message queue)

---

**Built:** 2026-03-11 by Tool Builder  
**Integration partner:** SEO Agent (@CL_SEO_bot)
