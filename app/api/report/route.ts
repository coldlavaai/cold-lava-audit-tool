import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

export const maxDuration = 60

function generatePDFHTML(data: any): string {
  const scoreColor = (score: number) => score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#ff6b35' : '#dc2626'
  const gradeLabel = data.overallScore >= 90 ? 'A+' : data.overallScore >= 80 ? 'A' : data.overallScore >= 70 ? 'B' : data.overallScore >= 60 ? 'C' : data.overallScore >= 50 ? 'D' : 'F'
  const priorityColor: Record<string, string> = { critical: '#dc2626', high: '#ff6b35', medium: '#eab308', low: '#3b82f6' }

  const categorySection = (title: string, icon: string, cat: any) => `
    <div style="background:#111;border:1px solid #222;border-radius:12px;padding:24px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:18px;font-weight:700;color:#fff;">${icon} ${title}</div>
        <div style="font-size:28px;font-weight:800;color:${scoreColor(cat.score)}">${cat.score}<span style="font-size:14px;color:#666">/100</span></div>
      </div>
      ${cat.issues.map((issue: string) => `
        <div style="display:flex;gap:8px;margin-bottom:8px;font-size:13px;color:#9ca3af;">
          <span style="color:#dc2626;flex-shrink:0;">✕</span>
          <span>${issue}</span>
        </div>
      `).join('')}
      ${cat.issues.length === 0 ? '<div style="color:#22c55e;font-size:13px;">✓ No major issues found!</div>' : ''}
    </div>
  `

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #050505; color: #e5e5e5; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px; }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid #1a1a1a;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#ff6b35,#dc2626);padding:8px 16px;border-radius:8px;margin-bottom:16px;">
        <span style="color:#fff;font-weight:800;font-size:18px;letter-spacing:2px;">COLD LAVA</span>
      </div>
      <h1 style="font-size:28px;font-weight:800;color:#fff;margin-bottom:4px;">Website Audit Report</h1>
      <p style="color:#666;font-size:14px;">${data.businessName} — ${data.url}</p>
      <p style="color:#666;font-size:12px;">Generated ${new Date(data.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <!-- Overall Score -->
    <div style="text-align:center;padding:32px;background:#111;border:1px solid #222;border-radius:16px;margin-bottom:32px;">
      <div style="font-size:72px;font-weight:900;color:${scoreColor(data.overallScore)};line-height:1;">${data.overallScore}</div>
      <div style="font-size:24px;font-weight:700;color:${scoreColor(data.overallScore)};margin-top:8px;">Grade: ${gradeLabel}</div>
      <div style="color:#666;font-size:14px;margin-top:4px;">Overall Website Health Score</div>
      
      <div style="display:flex;justify-content:center;gap:32px;margin-top:24px;">
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:700;color:${scoreColor(data.categories.website.score)}">${data.categories.website.score}</div>
          <div style="color:#666;font-size:11px;text-transform:uppercase;">Website</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:700;color:${scoreColor(data.categories.reviews.score)}">${data.categories.reviews.score}</div>
          <div style="color:#666;font-size:11px;text-transform:uppercase;">Reviews</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:700;color:${scoreColor(data.categories.trustSignals.score)}">${data.categories.trustSignals.score}</div>
          <div style="color:#666;font-size:11px;text-transform:uppercase;">Trust</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:700;color:${scoreColor(data.categories.competitive.score)}">${data.categories.competitive.score}</div>
          <div style="color:#666;font-size:11px;text-transform:uppercase;">Competitive</div>
        </div>
      </div>
    </div>

    <!-- Quick Stats -->
    <div style="display:flex;gap:12px;margin-bottom:32px;">
      <div style="flex:1;background:#111;border:1px solid #222;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:${data.categories.website.loadTime < 3000 ? '#22c55e' : '#dc2626'}">${(data.categories.website.loadTime / 1000).toFixed(1)}s</div>
        <div style="color:#666;font-size:11px;">Load Time</div>
      </div>
      <div style="flex:1;background:#111;border:1px solid #222;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:${data.categories.website.ssl ? '#22c55e' : '#dc2626'}">${data.categories.website.ssl ? 'Secure' : 'Not Secure'}</div>
        <div style="color:#666;font-size:11px;">SSL Status</div>
      </div>
      <div style="flex:1;background:#111;border:1px solid #222;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:${data.categories.website.mobile ? '#22c55e' : '#dc2626'}">${data.categories.website.mobile ? 'Yes' : 'No'}</div>
        <div style="color:#666;font-size:11px;">Mobile Ready</div>
      </div>
      <div style="flex:1;background:#111;border:1px solid #222;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:${data.categories.website.seoScore >= 70 ? '#22c55e' : '#dc2626'}">${data.categories.website.seoScore}/100</div>
        <div style="color:#666;font-size:11px;">SEO Score</div>
      </div>
    </div>

    <!-- Categories -->
    <h2 style="font-size:20px;font-weight:700;color:#fff;margin-bottom:16px;">📋 Detailed Analysis</h2>
    ${categorySection('Website Performance', '🌐', data.categories.website)}
    ${categorySection('Reviews & Reputation', '⭐', data.categories.reviews)}
    ${categorySection('Trust Signals', '🛡️', data.categories.trustSignals)}
    ${categorySection('Competitive Edge', '📊', data.categories.competitive)}

    <!-- Recommendations -->
    <h2 style="font-size:20px;font-weight:700;color:#fff;margin:32px 0 16px;">🎯 Top Recommendations</h2>
    ${data.recommendations.map((rec: any, i: number) => `
      <div style="background:#111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <span style="background:#0a0a0a;color:${priorityColor[rec.priority] || '#3b82f6'};border:1px solid ${priorityColor[rec.priority] || '#3b82f6'}33;padding:2px 8px;border-radius:4px;font-size:10px;text-transform:uppercase;font-weight:600;">${rec.priority}</span>
          <span style="color:#fff;font-weight:600;font-size:15px;">${rec.title}</span>
        </div>
        <p style="color:#9ca3af;font-size:13px;margin-bottom:6px;">${rec.description}</p>
        <p style="color:#ff6b35;font-size:13px;font-weight:500;">💡 ${rec.impact}</p>
      </div>
    `).join('')}

    <!-- CTA -->
    <div style="text-align:center;padding:40px;background:linear-gradient(135deg,#111,#0a0a0a);border:1px solid #222;border-radius:16px;margin-top:32px;">
      <h2 style="font-size:24px;font-weight:800;color:#fff;margin-bottom:12px;">Want us to fix these issues?</h2>
      <p style="color:#9ca3af;font-size:14px;margin-bottom:24px;">Cold Lava builds AI-powered employees that handle your marketing, sales, and operations.</p>
      <div style="display:inline-block;background:#ff6b35;color:#fff;padding:14px 32px;border-radius:12px;font-weight:700;font-size:16px;">
        Visit coldlava.ai → Book a Free Strategy Call
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0;margin-top:32px;border-top:1px solid #1a1a1a;">
      <div style="color:#ff6b35;font-weight:800;font-size:14px;letter-spacing:2px;margin-bottom:4px;">COLD LAVA</div>
      <p style="color:#666;font-size:11px;">© 2026 Cold Lava. This report was generated automatically.</p>
      <p style="color:#666;font-size:11px;">coldlava.ai</p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  let browser
  try {
    const data = await req.json()
    const html = generatePDFHTML(data)
    
    // Launch puppeteer and generate PDF
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    })
    
    await browser.close()
    
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cold-lava-audit-${data.businessName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf"`,
      },
    })
  } catch (error) {
    if (browser) await browser.close()
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF report' }, { status: 500 })
  }
}
