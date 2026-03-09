import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const maxDuration = 30

interface AuditResult {
  url: string
  businessName: string
  timestamp: string
  overallScore: number
  categories: {
    website: WebsiteScore
    reviews: ReviewScore
    trustSignals: TrustScore
    competitive: CompetitiveScore
  }
  recommendations: Recommendation[]
}

interface WebsiteScore {
  score: number
  loadTime: number
  mobile: boolean
  ssl: boolean
  seoScore: number
  issues: string[]
  details: {
    hasMetaDescription: boolean
    hasOgTags: boolean
    hasH1: boolean
    imageCount: number
    imagesWithoutAlt: number
    hasFavicon: boolean
    hasViewport: boolean
    wordCount: number
    linkCount: number
    hasStructuredData: boolean
  }
}

interface ReviewScore {
  score: number
  estimatedRating: number
  issues: string[]
  details: {
    hasTestimonials: boolean
    hasReviewWidgets: boolean
    mentionsGoogle: boolean
    mentionsYelp: boolean
    hasCaseStudies: boolean
    hasStarRatings: boolean
  }
}

interface TrustScore {
  score: number
  issues: string[]
  details: {
    hasPhone: boolean
    hasEmail: boolean
    hasAddress: boolean
    hasAboutPage: boolean
    hasPrivacyPolicy: boolean
    hasTerms: boolean
    hasSocialLinks: boolean
    hasTrustBadges: boolean
    hasTeamPage: boolean
    hasGuarantee: boolean
  }
}

interface CompetitiveScore {
  score: number
  issues: string[]
  details: {
    hasBlog: boolean
    hasCTA: boolean
    ctaCount: number
    hasLiveChat: boolean
    hasVideoContent: boolean
    hasFAQ: boolean
    hasPortfolio: boolean
    hasPricing: boolean
    uniqueSellingPoints: number
  }
}

interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  impact: string
}

async function fetchWithTimeout(url: string, timeout = 15000): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    })
    clearTimeout(id)
    return response
  } catch (e) {
    clearTimeout(id)
    throw e
  }
}

function analyzeWebsite(html: string, url: string, loadTime: number, isSSL: boolean): WebsiteScore {
  const $ = cheerio.load(html)
  
  const hasMetaDescription = $('meta[name="description"]').length > 0
  const hasOgTags = $('meta[property^="og:"]').length > 0
  const hasH1 = $('h1').length > 0
  const imageCount = $('img').length
  const imagesWithoutAlt = $('img:not([alt]), img[alt=""]').length
  const hasFavicon = $('link[rel*="icon"]').length > 0
  const hasViewport = $('meta[name="viewport"]').length > 0
  const wordCount = $('body').text().replace(/\s+/g, ' ').trim().split(' ').length
  const linkCount = $('a[href]').length
  const hasStructuredData = $('script[type="application/ld+json"]').length > 0

  const issues: string[] = []
  let score = 100

  // SSL
  if (!isSSL) { score -= 15; issues.push('No SSL certificate — site is not secure (HTTP)') }
  // Load time
  if (loadTime > 5000) { score -= 15; issues.push(`Slow load time: ${(loadTime/1000).toFixed(1)}s (should be under 3s)`) }
  else if (loadTime > 3000) { score -= 8; issues.push(`Moderate load time: ${(loadTime/1000).toFixed(1)}s (aim for under 3s)`) }
  // SEO basics
  if (!hasMetaDescription) { score -= 10; issues.push('Missing meta description — hurts search rankings') }
  if (!hasOgTags) { score -= 5; issues.push('No Open Graph tags — poor social media previews') }
  if (!hasH1) { score -= 8; issues.push('No H1 heading — search engines can\'t identify page topic') }
  if (!hasFavicon) { score -= 3; issues.push('No favicon — looks unprofessional in browser tabs') }
  if (!hasViewport) { score -= 12; issues.push('No viewport meta tag — not mobile-friendly') }
  if (!hasStructuredData) { score -= 5; issues.push('No structured data — missing rich search results') }
  // Images
  if (imagesWithoutAlt > 0) { score -= Math.min(8, imagesWithoutAlt * 2); issues.push(`${imagesWithoutAlt} images missing alt text — hurts SEO & accessibility`) }
  // Content
  if (wordCount < 300) { score -= 10; issues.push('Thin content — less than 300 words on homepage') }

  const seoScore = Math.max(0, 100 - ((!hasMetaDescription ? 20 : 0) + (!hasH1 ? 15 : 0) + (!hasStructuredData ? 10 : 0) + (!hasOgTags ? 10 : 0) + (imagesWithoutAlt > 0 ? 10 : 0)))

  return {
    score: Math.max(0, Math.min(100, score)),
    loadTime,
    mobile: hasViewport,
    ssl: isSSL,
    seoScore,
    issues,
    details: {
      hasMetaDescription, hasOgTags, hasH1, imageCount, imagesWithoutAlt,
      hasFavicon, hasViewport, wordCount, linkCount, hasStructuredData,
    }
  }
}

function analyzeReviews(html: string): ReviewScore {
  const $ = cheerio.load(html)
  const bodyText = $('body').text().toLowerCase()

  const hasTestimonials = bodyText.includes('testimonial') || bodyText.includes('what our') || bodyText.includes('client says') || bodyText.includes('customer review') || $('[class*="testimonial"]').length > 0
  const hasReviewWidgets = $('iframe[src*="google"], iframe[src*="yelp"], iframe[src*="trustpilot"], [class*="review-widget"]').length > 0 || bodyText.includes('trustpilot') || bodyText.includes('google review')
  const mentionsGoogle = bodyText.includes('google') && (bodyText.includes('review') || bodyText.includes('rating') || bodyText.includes('star'))
  const mentionsYelp = bodyText.includes('yelp')
  const hasCaseStudies = bodyText.includes('case study') || bodyText.includes('case studies') || bodyText.includes('success story') || bodyText.includes('success stories')
  const hasStarRatings = $('[class*="star"], [class*="rating"], .stars').length > 0 || bodyText.includes('★') || bodyText.includes('⭐')

  const issues: string[] = []
  let score = 100

  if (!hasTestimonials) { score -= 25; issues.push('No testimonials found — social proof is critical for conversions') }
  if (!hasReviewWidgets) { score -= 15; issues.push('No review widgets embedded — show off your reviews!') }
  if (!mentionsGoogle && !mentionsYelp) { score -= 20; issues.push('No mention of Google or Yelp reviews — missing credibility signals') }
  if (!hasCaseStudies) { score -= 10; issues.push('No case studies — prospects want proof of results') }
  if (!hasStarRatings) { score -= 10; issues.push('No star ratings visible — star ratings increase click-through by 35%') }

  const estimatedRating = hasTestimonials && hasStarRatings ? 4.2 : hasTestimonials ? 3.8 : 3.0

  return {
    score: Math.max(0, Math.min(100, score)),
    estimatedRating,
    issues,
    details: { hasTestimonials, hasReviewWidgets, mentionsGoogle, mentionsYelp, hasCaseStudies, hasStarRatings }
  }
}

function analyzeTrustSignals(html: string): TrustScore {
  const $ = cheerio.load(html)
  const bodyText = $('body').text().toLowerCase()
  const allHtml = html.toLowerCase()

  const hasPhone = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/.test($('body').text()) || $('a[href^="tel:"]').length > 0
  const hasEmail = $('a[href^="mailto:"]').length > 0 || /[\w.-]+@[\w.-]+\.\w+/.test($('body').text())
  const hasAddress = bodyText.includes('address') || bodyText.includes('street') || bodyText.includes('suite') || /\d+\s+[\w\s]+(?:st|ave|blvd|rd|dr|ln|way|ct)/i.test($('body').text())
  const hasAboutPage = $('a[href*="about"]').length > 0
  const hasPrivacyPolicy = $('a[href*="privacy"]').length > 0
  const hasTerms = $('a[href*="terms"]').length > 0 || $('a[href*="tos"]').length > 0
  const hasSocialLinks = $('a[href*="facebook"], a[href*="twitter"], a[href*="linkedin"], a[href*="instagram"], a[href*="x.com"]').length > 0
  const hasTrustBadges = allHtml.includes('bbb') || allHtml.includes('trust') || allHtml.includes('certified') || allHtml.includes('accredited') || allHtml.includes('verified') || $('[class*="badge"], [class*="trust"], [class*="seal"]').length > 0
  const hasTeamPage = $('a[href*="team"]').length > 0 || bodyText.includes('our team') || bodyText.includes('meet the')
  const hasGuarantee = bodyText.includes('guarantee') || bodyText.includes('money back') || bodyText.includes('satisfaction')

  const issues: string[] = []
  let score = 100

  if (!hasPhone) { score -= 15; issues.push('No phone number found — prospects can\'t reach you easily') }
  if (!hasEmail) { score -= 5; issues.push('No email address visible') }
  if (!hasAddress) { score -= 10; issues.push('No physical address — reduces trust for local businesses') }
  if (!hasPrivacyPolicy) { score -= 10; issues.push('No privacy policy — required by law and builds trust') }
  if (!hasSocialLinks) { score -= 10; issues.push('No social media links — looks like a ghost business') }
  if (!hasTrustBadges) { score -= 15; issues.push('No trust badges or certifications — huge credibility gap') }
  if (!hasTeamPage) { score -= 5; issues.push('No team/about section — people buy from people') }
  if (!hasGuarantee) { score -= 10; issues.push('No guarantee or warranty mentioned — reduces purchase confidence') }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    details: { hasPhone, hasEmail, hasAddress, hasAboutPage, hasPrivacyPolicy, hasTerms, hasSocialLinks, hasTrustBadges, hasTeamPage, hasGuarantee }
  }
}

function analyzeCompetitive(html: string): CompetitiveScore {
  const $ = cheerio.load(html)
  const bodyText = $('body').text().toLowerCase()
  const allHtml = html.toLowerCase()

  const hasBlog = $('a[href*="blog"]').length > 0 || bodyText.includes('blog')
  const ctaElements = $('a[class*="btn"], button[class*="btn"], a[class*="cta"], button[class*="cta"], .button, [class*="button"]').length
  const ctaText = (bodyText.match(/(get started|sign up|contact us|free quote|book now|schedule|call now|get a quote|learn more|try free|start now)/gi) || []).length
  const hasCTA = ctaElements > 0 || ctaText > 0
  const ctaCount = Math.max(ctaElements, ctaText)
  const hasLiveChat = allHtml.includes('livechat') || allHtml.includes('intercom') || allHtml.includes('drift') || allHtml.includes('tawk') || allHtml.includes('zendesk') || allHtml.includes('crisp') || allHtml.includes('hubspot') || $('[class*="chat"]').length > 0
  const hasVideoContent = $('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"]').length > 0
  const hasFAQ = bodyText.includes('faq') || bodyText.includes('frequently asked') || bodyText.includes('common questions')
  const hasPortfolio = bodyText.includes('portfolio') || bodyText.includes('our work') || bodyText.includes('projects') || bodyText.includes('gallery')
  const hasPricing = bodyText.includes('pricing') || bodyText.includes('price') || bodyText.includes('cost') || $('a[href*="pricing"]').length > 0

  // Count unique value props
  const valueProps = ['free', 'guarantee', 'fast', 'quick', 'affordable', 'professional', 'expert', 'certified', 'award', 'best', '#1', 'number one', 'leading', 'trusted']
  const uniqueSellingPoints = valueProps.filter(v => bodyText.includes(v)).length

  const issues: string[] = []
  let score = 100

  if (!hasBlog) { score -= 10; issues.push('No blog — missing organic traffic & authority building') }
  if (!hasCTA || ctaCount < 2) { score -= 15; issues.push('Weak calls-to-action — visitors don\'t know what to do next') }
  if (!hasLiveChat) { score -= 10; issues.push('No live chat — competitors with chat convert 40% more leads') }
  if (!hasVideoContent) { score -= 10; issues.push('No video content — video increases conversion by 80%') }
  if (!hasFAQ) { score -= 8; issues.push('No FAQ section — prospects leave when questions go unanswered') }
  if (!hasPortfolio) { score -= 7; issues.push('No portfolio/work examples — show don\'t tell') }
  if (uniqueSellingPoints < 3) { score -= 10; issues.push('Weak value proposition — not clear why someone should choose you') }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    details: { hasBlog, hasCTA, ctaCount, hasLiveChat, hasVideoContent, hasFAQ, hasPortfolio, hasPricing, uniqueSellingPoints }
  }
}

function generateRecommendations(website: WebsiteScore, reviews: ReviewScore, trust: TrustScore, competitive: CompetitiveScore): Recommendation[] {
  const recs: Recommendation[] = []

  // Critical
  if (!website.ssl) recs.push({ priority: 'critical', category: 'Security', title: 'Install SSL Certificate', description: 'Your site is not secure. Google penalizes HTTP sites and browsers show warning messages.', impact: 'Prevents ~40% of visitors from trusting your site' })
  if (!website.mobile) recs.push({ priority: 'critical', category: 'Mobile', title: 'Make Your Site Mobile-Friendly', description: 'No viewport meta tag detected. Your site likely looks broken on phones.', impact: '60%+ of traffic is mobile — you\'re losing most visitors' })

  // High
  if (!website.details.hasMetaDescription) recs.push({ priority: 'high', category: 'SEO', title: 'Add Meta Description', description: 'Search engines use this to display your site in results. Without it, Google picks random text.', impact: 'Can increase click-through rates by 5-10%' })
  if (reviews.score < 50) recs.push({ priority: 'high', category: 'Reviews', title: 'Add Social Proof', description: 'No testimonials, reviews, or ratings visible. Prospects need proof you deliver results.', impact: 'Social proof increases conversions by 15-30%' })
  if (!trust.details.hasPhone) recs.push({ priority: 'high', category: 'Trust', title: 'Display Phone Number Prominently', description: 'No phone number found. For local businesses, this is a dealbreaker.', impact: 'Increases leads by 10-20% for service businesses' })
  if (!trust.details.hasTrustBadges) recs.push({ priority: 'high', category: 'Trust', title: 'Add Trust Badges & Certifications', description: 'No BBB, industry certifications, or trust seals found.', impact: 'Trust badges increase purchase likelihood by 42%' })

  // Medium  
  if (!competitive.details.hasLiveChat) recs.push({ priority: 'medium', category: 'Conversion', title: 'Add Live Chat', description: 'Competitors with live chat capture leads you\'re missing.', impact: 'Live chat users convert at 3-5x higher rates' })
  if (!competitive.details.hasVideoContent) recs.push({ priority: 'medium', category: 'Content', title: 'Add Video Content', description: 'No videos found. Video keeps visitors on-page longer and builds trust faster.', impact: 'Video on landing pages increases conversion by 80%' })
  if (!competitive.details.hasBlog) recs.push({ priority: 'medium', category: 'SEO', title: 'Start a Blog', description: 'No blog found. Regular content drives organic traffic and establishes authority.', impact: 'Companies that blog get 55% more website visitors' })
  if (!competitive.details.hasFAQ) recs.push({ priority: 'medium', category: 'Content', title: 'Add FAQ Section', description: 'Answer common questions before prospects have to ask.', impact: 'Reduces bounce rate and support inquiries' })

  // Low
  if (!website.details.hasOgTags) recs.push({ priority: 'low', category: 'Social', title: 'Add Open Graph Tags', description: 'When someone shares your site, it looks plain. OG tags make shares look professional.', impact: 'Better social media appearance increases shares' })
  if (!trust.details.hasPrivacyPolicy) recs.push({ priority: 'low', category: 'Legal', title: 'Add Privacy Policy', description: 'Required by law if you collect any data. Also a trust signal.', impact: 'Legal compliance and trust building' })

  return recs.slice(0, 10) // Cap at 10 recommendations
}

export async function POST(req: NextRequest) {
  try {
    const { url, email } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    let targetUrl = url.trim()
    if (!targetUrl.startsWith('http')) {
      targetUrl = 'https://' + targetUrl
    }

    // Fetch the website
    const startTime = Date.now()
    let response: Response
    try {
      response = await fetchWithTimeout(targetUrl)
    } catch (e: any) {
      // Try http if https fails
      try {
        targetUrl = targetUrl.replace('https://', 'http://')
        response = await fetchWithTimeout(targetUrl)
      } catch {
        return NextResponse.json({ error: 'Could not reach this website. Please check the URL and try again.' }, { status: 400 })
      }
    }
    const loadTime = Date.now() - startTime
    const html = await response.text()
    const isSSL = targetUrl.startsWith('https')

    // Extract business name
    const $ = cheerio.load(html)
    const titleTag = $('title').first().text().trim()
    const ogTitle = $('meta[property="og:title"]').attr('content') || ''
    const businessName = ogTitle || titleTag || new URL(targetUrl).hostname

    // Run all analyses
    const website = analyzeWebsite(html, targetUrl, loadTime, isSSL)
    const reviews = analyzeReviews(html)
    const trustSignals = analyzeTrustSignals(html)
    const competitive = analyzeCompetitive(html)

    // Generate recommendations
    const recommendations = generateRecommendations(website, reviews, trustSignals, competitive)

    // Calculate overall score (weighted)
    const overallScore = Math.round(
      website.score * 0.30 +
      reviews.score * 0.25 +
      trustSignals.score * 0.25 +
      competitive.score * 0.20
    )

    const result: AuditResult = {
      url: targetUrl,
      businessName,
      timestamp: new Date().toISOString(),
      overallScore,
      categories: {
        website,
        reviews,
        trustSignals,
        competitive,
      },
      recommendations,
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Audit error:', error)
    return NextResponse.json({ error: 'Failed to analyze website. Please try again.' }, { status: 500 })
  }
}
