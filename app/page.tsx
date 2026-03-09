'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [url, setUrl] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    let cleanUrl = url.trim()
    if (!cleanUrl) {
      setError('Please enter a website URL')
      return
    }
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl
    }

    setLoading(true)
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 45000) // 45 second timeout
      
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, email }),
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to run audit')
      }
      
      // Store results and redirect to report page
      sessionStorage.setItem('auditResult', JSON.stringify(data))
      router.push('/audit')
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Request timed out. The website might be slow to respond. Please try again.')
      } else {
        setError(err.message || 'Failed to analyze website. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-cl-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-border flex items-center justify-center">
              <span className="text-white font-bold text-sm">CL</span>
            </div>
            <span className="font-mono font-bold text-lg text-white">COLD LAVA</span>
          </div>
          <span className="text-cl-muted text-sm font-mono">AUDIT TOOL</span>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-2xl w-full text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cl-border bg-cl-card mb-8 fade-in">
            <span className="w-2 h-2 rounded-full bg-cl-green animate-pulse"></span>
            <span className="text-cl-muted text-sm font-mono">FREE WEBSITE AUDIT</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 fade-in fade-in-delay-1">
            Your website is losing you{' '}
            <span className="text-cl-cyan">money.</span>
          </h1>
          <p className="text-lg text-cl-muted mb-10 max-w-lg mx-auto fade-in fade-in-delay-2">
            Get a comprehensive analysis of your website performance, online reviews, 
            trust signals, and what your competitors do better — in 30 seconds.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="max-w-xl mx-auto fade-in fade-in-delay-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter website URL (e.g. acmeplumbing.com)"
                className="flex-1 px-5 py-4 rounded-xl bg-cl-card border border-cl-border text-white placeholder-cl-muted focus:outline-none focus:border-cl-cyan transition-colors text-base"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-4 rounded-xl bg-cl-cyan hover:bg-cl-cyan-light text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Auditing...
                  </span>
                ) : (
                  'Run Free Audit'
                )}
              </button>
            </div>
            
            {/* Optional email */}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email (optional — to receive the PDF)"
              className="w-full mt-3 px-5 py-3 rounded-xl bg-cl-card border border-cl-border text-white placeholder-cl-muted focus:outline-none focus:border-cl-cyan/50 transition-colors text-sm"
              disabled={loading}
            />

            {error && (
              <p className="mt-3 text-cl-red text-sm">{error}</p>
            )}
          </form>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 fade-in fade-in-delay-4">
            <div className="flex items-center gap-2 text-cl-muted text-sm">
              <svg className="w-4 h-4 text-cl-green" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              No credit card required
            </div>
            <div className="flex items-center gap-2 text-cl-muted text-sm">
              <svg className="w-4 h-4 text-cl-green" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Results in 30 seconds
            </div>
            <div className="flex items-center gap-2 text-cl-muted text-sm">
              <svg className="w-4 h-4 text-cl-green" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Branded PDF report
            </div>
          </div>

          {/* What you get */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 fade-in fade-in-delay-5">
            {[
              { icon: '🌐', label: 'Website Score', desc: 'Speed, SEO & mobile' },
              { icon: '⭐', label: 'Review Analysis', desc: 'Reputation audit' },
              { icon: '🛡️', label: 'Trust Signals', desc: 'Credibility gaps' },
              { icon: '📊', label: 'vs Competitors', desc: 'Market positioning' },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl border border-cl-border bg-cl-card hover:border-cl-cyan/30 transition-colors">
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="text-white font-semibold text-sm">{item.label}</div>
                <div className="text-cl-muted text-xs">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-cl-border px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-cl-muted text-sm">© 2026 Cold Lava. All rights reserved.</span>
          <span className="text-cl-muted text-xs font-mono">v1.0</span>
        </div>
      </footer>
    </main>
  )
}
