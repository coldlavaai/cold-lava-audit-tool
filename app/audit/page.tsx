'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface AuditResult {
  url: string
  businessName: string
  timestamp: string
  overallScore: number
  categories: {
    website: any
    reviews: any
    trustSignals: any
    competitive: any
  }
  recommendations: any[]
}

function ScoreRing({ score, size = 120, strokeWidth = 8, label }: { score: number, size?: number, strokeWidth?: number, label?: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#ff6b35' : '#dc2626'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1a1a1a" strokeWidth={strokeWidth} />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="score-ring" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">{score}</span>
        </div>
      </div>
      {label && <span className="text-cl-muted text-xs font-mono uppercase">{label}</span>}
    </div>
  )
}

function CategoryCard({ title, icon, score, issues, details }: { title: string, icon: string, score: number, issues: string[], details: Record<string, any> }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-cl-card border border-cl-border rounded-2xl p-6 hover:border-cl-orange/20 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <h3 className="text-white font-semibold text-lg">{title}</h3>
        </div>
        <ScoreRing score={score} size={60} strokeWidth={5} />
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="space-y-2 mb-4">
          {issues.slice(0, open ? undefined : 3).map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-cl-red mt-0.5 flex-shrink-0">✕</span>
              <span className="text-cl-muted">{issue}</span>
            </div>
          ))}
          {issues.length > 3 && (
            <button onClick={() => setOpen(!open)} className="text-cl-orange text-sm hover:underline">
              {open ? 'Show less' : `+ ${issues.length - 3} more issues`}
            </button>
          )}
        </div>
      )}

      {issues.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-cl-green mb-4">
          <span>✓</span> Looking good! No major issues found.
        </div>
      )}

      {/* Details checklist */}
      <div className="border-t border-cl-border pt-4 mt-4">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(details).map(([key, value]) => {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^has /, '').replace(/^is /, '').trim()
            const isBoolean = typeof value === 'boolean'
            return (
              <div key={key} className="flex items-center gap-2 text-xs">
                {isBoolean ? (
                  <span className={value ? 'text-cl-green' : 'text-cl-red'}>{value ? '✓' : '✕'}</span>
                ) : (
                  <span className="text-cl-blue">•</span>
                )}
                <span className="text-cl-muted capitalize">{label}{!isBoolean ? `: ${value}` : ''}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono uppercase border ${colors[priority] || colors.low}`}>
      {priority}
    </span>
  )
}

export default function AuditReport() {
  const [result, setResult] = useState<AuditResult | null>(null)
  const [downloading, setDownloading] = useState(false)
  const router = useRouter()
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('auditResult')
    if (stored) {
      setResult(JSON.parse(stored))
    } else {
      router.push('/')
    }
  }, [router])

  const handleDownloadPDF = async () => {
    if (!result) return
    setDownloading(true)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `cold-lava-audit-${result.businessName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('PDF download failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-cl-orange border-t-transparent rounded-full"></div>
      </div>
    )
  }

  const gradeLabel = result.overallScore >= 90 ? 'A+' : result.overallScore >= 80 ? 'A' : result.overallScore >= 70 ? 'B' : result.overallScore >= 60 ? 'C' : result.overallScore >= 50 ? 'D' : 'F'
  const gradeColor = result.overallScore >= 80 ? 'text-cl-green' : result.overallScore >= 60 ? 'text-cl-yellow' : result.overallScore >= 40 ? 'text-cl-orange' : 'text-cl-red'

  return (
    <main className="min-h-screen pb-20">
      {/* Nav */}
      <nav className="border-b border-cl-border px-6 py-4 sticky top-0 bg-cl-darker/80 backdrop-blur-sm z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-border flex items-center justify-center">
              <span className="text-white font-bold text-sm">CL</span>
            </div>
            <span className="font-mono font-bold text-lg text-white">COLD LAVA</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="px-4 py-2 rounded-lg bg-cl-orange hover:bg-cl-orange-dark text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {downloading ? 'Generating...' : '📄 Download PDF'}
            </button>
            <button onClick={() => router.push('/')} className="px-4 py-2 rounded-lg border border-cl-border text-cl-muted hover:text-white text-sm transition-colors">
              New Audit
            </button>
          </div>
        </div>
      </nav>

      <div ref={reportRef} className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="text-center py-12 border-b border-cl-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cl-border bg-cl-card mb-4">
            <span className="text-cl-muted text-xs font-mono">WEBSITE AUDIT REPORT</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{result.businessName}</h1>
          <p className="text-cl-muted text-sm">{result.url}</p>
          <p className="text-cl-muted text-xs mt-1">Generated {new Date(result.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Overall Score */}
        <div className="py-12 border-b border-cl-border">
          <div className="flex flex-col md:flex-row items-center justify-center gap-10">
            <div className="text-center">
              <ScoreRing score={result.overallScore} size={180} strokeWidth={12} />
              <div className={`text-4xl font-bold mt-4 ${gradeColor}`}>{gradeLabel}</div>
              <div className="text-cl-muted text-sm mt-1">Overall Grade</div>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              <ScoreRing score={result.categories.website.score} size={90} strokeWidth={6} label="Website" />
              <ScoreRing score={result.categories.reviews.score} size={90} strokeWidth={6} label="Reviews" />
              <ScoreRing score={result.categories.trustSignals.score} size={90} strokeWidth={6} label="Trust" />
              <ScoreRing score={result.categories.competitive.score} size={90} strokeWidth={6} label="Competitive" />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-8">
          {[
            { label: 'Load Time', value: `${(result.categories.website.loadTime / 1000).toFixed(1)}s`, good: result.categories.website.loadTime < 3000 },
            { label: 'SSL Secure', value: result.categories.website.ssl ? 'Yes' : 'No', good: result.categories.website.ssl },
            { label: 'Mobile Ready', value: result.categories.website.mobile ? 'Yes' : 'No', good: result.categories.website.mobile },
            { label: 'SEO Score', value: `${result.categories.website.seoScore}/100`, good: result.categories.website.seoScore >= 70 },
          ].map((stat) => (
            <div key={stat.label} className="bg-cl-card border border-cl-border rounded-xl p-4 text-center">
              <div className={`text-xl font-bold ${stat.good ? 'text-cl-green' : 'text-cl-red'}`}>{stat.value}</div>
              <div className="text-cl-muted text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Category Breakdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-8">
          <CategoryCard title="Website Performance" icon="🌐" score={result.categories.website.score} issues={result.categories.website.issues} details={result.categories.website.details} />
          <CategoryCard title="Review & Reputation" icon="⭐" score={result.categories.reviews.score} issues={result.categories.reviews.issues} details={result.categories.reviews.details} />
          <CategoryCard title="Trust Signals" icon="🛡️" score={result.categories.trustSignals.score} issues={result.categories.trustSignals.issues} details={result.categories.trustSignals.details} />
          <CategoryCard title="Competitive Edge" icon="📊" score={result.categories.competitive.score} issues={result.categories.competitive.issues} details={result.categories.competitive.details} />
        </div>

        {/* Recommendations */}
        <div className="py-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <span>🎯</span> Recommendations
          </h2>
          <div className="space-y-4">
            {result.recommendations.map((rec, i) => (
              <div key={i} className="bg-cl-card border border-cl-border rounded-xl p-5 fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold">{rec.title}</span>
                    <PriorityBadge priority={rec.priority} />
                  </div>
                  <span className="text-cl-muted text-xs font-mono">{rec.category}</span>
                </div>
                <p className="text-cl-muted text-sm mb-2">{rec.description}</p>
                <p className="text-cl-orange text-sm font-medium">💡 {rec.impact}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="py-12 text-center border-t border-cl-border">
          <div className="bg-gradient-to-br from-cl-card to-cl-dark border border-cl-border rounded-2xl p-10 pulse-glow">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Want us to fix these issues?
            </h2>
            <p className="text-cl-muted mb-8 max-w-md mx-auto">
              Cold Lava builds AI-powered employees that handle your marketing, sales, and operations — while we fix your digital presence.
            </p>
            <a
              href="https://coldlava.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex px-8 py-4 rounded-xl bg-cl-orange hover:bg-cl-orange-dark text-white font-semibold transition-colors text-lg"
            >
              Book a Free Strategy Call →
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8 border-t border-cl-border">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-6 h-6 rounded gradient-border flex items-center justify-center">
              <span className="text-white font-bold text-xs">CL</span>
            </div>
            <span className="font-mono font-bold text-sm text-white">COLD LAVA</span>
          </div>
          <p className="text-cl-muted text-xs">© 2026 Cold Lava. This report was generated automatically.</p>
        </div>
      </div>
    </main>
  )
}
