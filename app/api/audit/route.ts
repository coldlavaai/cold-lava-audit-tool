import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import * as fs from 'fs/promises'
import * as path from 'path'

export const maxDuration = 60

// === GEO-SEO INTERFACES ===
interface GEOScore {
  citabilityScore: number  // Placeholder for now (requires Python script)
  gradeDistribution: { A: number; B: number; C: number; D: number; F: number }
  schemaPresent: boolean
  schemaTypes: string[]
  llmstxtPresent: boolean
  llmstxtValid: boolean
  aiCrawlersAllowed: string[]
  aiCrawlersBlocked: string[]
  issues: string[]
}

interface BrandAuthority {
  youtubePresence: boolean
  redditMentions: number  // Placeholder (requires search)
  wikipediaPage: boolean  // Placeholder (requires search)
  linkedinCompanyPage: boolean  // Placeholder (requires search)
  issues: string[]
}

interface ContentAnalysis {
  wordCountHomepage: number
  blogPosts: number
  faqSections: number
  headings: { h1: number; h2: number; h3: number }
}

// === EXISTING INTERFACES ===
interface AuditResult {
  url: string
  businessName: string
  timestamp: string
  overallScore: number
  geoScore?: number  // NEW: GEO-specific score
  categories: {
    website: WebsiteScore
    reviews: ReviewScore
    trustSignals: TrustScore
    competitive: CompetitiveScore
    geo?: GEOScore  // NEW
    brandAuthority?: BrandAuthority  // NEW
    content?: ContentAnalysis  // NEW
  }
  recommendations: Recommendation[]
  rawData?: {  // NEW: For SEO Agent processing
    homepageHtml: string
    robotsTxt?: string
    llmsTxt?: string
  }
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

// === NEW: GEO-SEO ANALYSIS FUNCTIONS ===

async function checkLLMSTxt(baseUrl: string): Promise<{ exists: boolean; content?: string; valid: boolean }> {
  try {
    const llmsUrl = `${baseUrl}/llms.txt`
    const response = await fetchWithTimeout(llmsUrl, 10000)
    if (response.status === 200) {
      const content = await response.text()
      // Basic validation: should have sections marked with #
      const hasTitle = content.includes('# ')
      const hasSections = (content.match(/##/g) || []).length >= 2
      return {
        exists: true,
        content,
        valid: hasTitle && hasSections
      }
    }
  } catch {}
  return { exists: false, valid: false }
}

async function checkRobotsTxt(baseUrl: string): Promise<{ allowed: string[]; blocked: string[] }> {
  const aiCrawlers = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'anthropic-ai', 'cohere-ai']
  const allowed: string[] = []
  const blocked: string[] = []
  
  try {
    const robotsUrl = `${baseUrl}/robots.txt`
    const response = await fetchWithTimeout(robotsUrl, 10000)
    if (response.status === 200) {
      const content = await response.text()
      const lines = content.toLowerCase().split('\n')
      
      for (const crawler of aiCrawlers) {
        const crawlerLower = crawler.toLowerCase()
        const isBlocked = lines.some(line => 
          line.includes(`user-agent: ${crawlerLower}`) && 
          lines.some((l, i) => i > lines.indexOf(line) && l.includes('disallow: /'))
        )
        
        if (isBlocked) {
          blocked.push(crawler)
        } else {
          allowed.push(crawler)
        }
      }
    }
  } catch {}
  
  // Default: assume all allowed if no robots.txt
  if (allowed.length === 0 && blocked.length === 0) {
    return { allowed: aiCrawlers, blocked: [] }
  }
  
  return { allowed, blocked }
}

function analyzeGEO(html: string, baseUrl: string, llmstxt: { exists: boolean; valid: boolean }, robotsTxt: { allowed: string[]; blocked: string[] }): GEOScore {
  const $ = cheerio.load(html)
  const issues: string[] = []
  
  // Schema.org detection
  const schemaScripts = $('script[type="application/ld+json"]')
  const schemaPresent = schemaScripts.length > 0
  const schemaTypes: string[] = []
  
  schemaScripts.each((_, el) => {
    try {
      const schemaData = JSON.parse($(el).html() || '{}')
      const type = schemaData['@type']
      if (type) schemaTypes.push(type)
    } catch {}
  })
  
  if (!schemaPresent) {
    issues.push('No Schema.org markup — AI cannot extract structured data')
  }
  
  if (!llmstxt.exists) {
    issues.push('No llms.txt file — AI crawlers lack navigation guidance')
  } else if (!llmstxt.valid) {
    issues.push('llms.txt exists but format is invalid')
  }
  
  if (robotsTxt.blocked.length > 0) {
    issues.push(`Blocking AI crawlers: ${robotsTxt.blocked.join(', ')} — invisible to AI search`)
  }
  
  // Placeholder citability score (would run Python script in production)
  const citabilityScore = 0  // TODO: Run citability_scorer.py
  
  return {
    citabilityScore,
    gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },  // Placeholder
    schemaPresent,
    schemaTypes,
    llmstxtPresent: llmstxt.exists,
    llmstxtValid: llmstxt.valid,
    aiCrawlersAllowed: robotsTxt.allowed,
    aiCrawlersBlocked: robotsTxt.blocked,
    issues
  }
}

function analyzeBrandAuthority(html: string, bodyText: string): BrandAuthority {
  const $ = cheerio.load(html)
  const issues: string[] = []
  
  // Check for YouTube presence (channel link or embedded videos)
  const hasYoutubeLink = $('a[href*="youtube.com"]').length > 0 || html.includes('youtube.com')
  const hasYoutubeEmbed = $('iframe[src*="youtube.com"]').length > 0
  const youtubePresence = hasYoutubeLink || hasYoutubeEmbed
  
  // Placeholders for external checks (require API/search)
  const redditMentions = 0  // Would search Reddit API
  const wikipediaPage = false  // Would check Wikipedia
  const linkedinCompanyPage = false  // Would check LinkedIn
  
  if (!youtubePresence) {
    issues.push('No YouTube presence detected — YouTube mentions have 0.737 correlation with AI visibility')
  }
  
  // Note: Reddit/Wikipedia checks would happen in SEO Agent's deeper analysis
  issues.push('Brand authority analysis incomplete — SEO Agent will perform full scan')
  
  return {
    youtubePresence,
    redditMentions,
    wikipediaPage,
    linkedinCompanyPage,
    issues
  }
}

function analyzeContent($: cheerio.CheerioAPI, bodyText: string): ContentAnalysis {
  const wordCountHomepage = bodyText.replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length > 0).length
  
  // Detect blog
  const blogPosts = $('article, .post, .blog-post').length
  
  // Detect FAQ
  const faqSections = $('[class*="faq" i], [id*="faq" i], summary, .accordion').length
  
  // Heading distribution
  const headings = {
    h1: $('h1').length,
    h2: $('h2').length,
    h3: $('h3').length
  }
  
  return {
    wordCountHomepage,
    blogPosts,
    faqSections,
    headings
  }
}

// === EXISTING ANALYSIS FUNCTIONS (keeping all the original code) ===

function analyzeWebsite(html: string, url: string, loadTime: number, isSSL: boolean): WebsiteScore {
  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i)
  const hasMetaDescription = !!metaDescMatch
  
  const hasOgTags = /<meta[^>]+property=["']og:/i.test(html)
  const hasH1 = /<h1[^>]*>/i.test(html)
  
  const imageMatches = html.match(/<img[^>]*>/gi) || []
  const imageCount = imageMatches.length
  const imagesWithoutAlt = imageMatches.filter(img => !img.match(/alt=["'][^"']+["']/i)).length
  
  const hasFavicon = /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(html)
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html)
  
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const bodyText = bodyMatch ? bodyMatch[1].replace(/<[^>]+>/g, ' ') : ''
  const wordCount = bodyText.replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length > 0).length
  
  const linkCount = (html.match(/<a[^>]+href=/gi) || []).length
  const hasStructuredData = html.includes('application/ld+json')

  const issues: string[] = []
  let score = 100

  if (!isSSL) { score -= 15; issues.push('No SSL certificate — site is not secure (HTTP)') }
  if (loadTime > 5000) { score -= 15; issues.push(`Slow load time: ${(loadTime/1000).toFixed(1)}s (should be under 3s)`) }
  else if (loadTime > 3000) { score -= 8; issues.push(`Moderate load time: ${(loadTime/1000).toFixed(1)}s (aim for under 3s)`) }
  if (!hasMetaDescription) { score -= 10; issues.push('Missing meta description — hurts search rankings') }
  if (!hasOgTags) { score -= 5; issues.push('No Open Graph tags — poor social media previews') }
  if (!hasH1) { score -= 8; issues.push('No H1 heading — search engines can\'t identify page topic') }
  if (!hasFavicon) { score -= 3; issues.push('No favicon — looks unprofessional in browser tabs') }
  if (!hasViewport) { score -= 12; issues.push('No viewport meta tag — not mobile-friendly') }
  if (!hasStructuredData) { score -= 5; issues.push('No structured data — missing rich search results') }
  if (imagesWithoutAlt > 0) { score -= Math.min(8, imagesWithoutAlt * 2); issues.push(`${imagesWithoutAlt} images missing alt text — hurts SEO & accessibility`) }
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

function analyzeReviews(html: string, bodyText: string): ReviewScore {
  const lowerBody = bodyText.toLowerCase()
  const lowerHtml = html.toLowerCase()

  const testimonialKeywords = [
    'testimonial', 'what our', 'client say', 'customer say', 'customer review',
    'client review', 'customer feedback', 'hear from', 'words from',
    'loved working with', 'highly recommend', 'excellent service',
    'great experience', 'would recommend', 'very professional',
    'amazing', 'fantastic', 'brilliant', 'outstanding', 'couldn\'t be happier',
    'extremely pleased', 'top notch', 'best decision', 'exceeded expectations',
    'review', 'reviews'
  ]
  const hasTestimonialKeyword = testimonialKeywords.some(kw => lowerBody.includes(kw) || lowerHtml.includes(kw))
  const hasTestimonialClass = /class=["'][^"']*(testimonial|review|feedback)/i.test(html)
  const hasTestimonialLink = /<a[^>]+href=["'][^"']*(testimonial|review|feedback|customer|client)[^"']*["']/i.test(html)
  
  const hasReviewWidgets = lowerHtml.includes('trustpilot') || lowerHtml.includes('google review') || lowerHtml.includes('yelp') || /<iframe[^>]+src=["'][^"']*(google|yelp|trustpilot|reviews)/i.test(html) || lowerHtml.includes('reviews.io')
  const mentionsGoogle = (lowerBody.includes('google') || lowerHtml.includes('google')) && (lowerBody.includes('review') || lowerHtml.includes('review') || lowerBody.includes('rating') || lowerBody.includes('star'))
  const mentionsYelp = lowerBody.includes('yelp') || lowerHtml.includes('yelp')
  const hasCaseStudies = lowerBody.includes('case stud') || lowerBody.includes('success stor') || lowerHtml.includes('case stud')
  const hasStarRatings = /class=["'][^"']*star/i.test(html) || /class=["'][^"']*rating/i.test(html) || bodyText.includes('★') || bodyText.includes('⭐') || html.includes('★') || html.includes('⭐') || /[45]\.?\d?\s*\/?\s*5\s*(star|rating)/i.test(bodyText) || /[45]\.?\d?\s*\/?\s*5\s*(star|rating)/i.test(html)
  
  const hasTestimonials = hasTestimonialKeyword || hasTestimonialClass || hasTestimonialLink || hasReviewWidgets || hasCaseStudies || hasStarRatings

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

function analyzeTrustSignals(html: string, bodyText: string): TrustScore {
  const lowerBody = bodyText.toLowerCase()
  const lowerHtml = html.toLowerCase()

  const hasPhone = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/.test(bodyText) || /<a[^>]+href=["']tel:/i.test(html)
  const hasEmail = /<a[^>]+href=["']mailto:/i.test(html) || /[\w.-]+@[\w.-]+\.\w+/.test(bodyText)
  const addressPatterns = [
    lowerBody.includes('address'),
    lowerBody.includes('street'),
    lowerBody.includes('suite'),
    lowerBody.includes('office'),
    /\d+\s+[\w\s]+(?:st|ave|blvd|rd|dr|ln|way|ct|street|avenue|boulevard|road|drive|lane|court)/i.test(bodyText),
    /\b(?:road|street|avenue|lane|drive|close|way|place|crescent)\b/i.test(lowerBody) && /\d{1,5}/.test(bodyText),
    /[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}/i.test(bodyText),
    /\d{5}(-\d{4})?/.test(bodyText) && (lowerBody.includes('zip') || lowerBody.includes('postal')),
  ]
  const hasAddress = addressPatterns.some(p => p)
  const hasAboutPage = /<a[^>]+href=["'][^"']*about/i.test(html)
  const hasPrivacyPolicy = /<a[^>]+href=["'][^"']*privacy/i.test(html)
  const hasTerms = /<a[^>]+href=["'][^"']*(terms|tos)/i.test(html)
  const hasSocialLinks = /<a[^>]+href=["'][^"']*(facebook|twitter|linkedin|instagram|x\.com)/i.test(html)
  const hasTrustBadges = lowerHtml.includes('bbb') || lowerBody.includes('certified') || lowerBody.includes('accredited') || lowerBody.includes('verified') || /class=["'][^"']*(badge|trust|seal)/i.test(html)
  const hasTeamPage = /<a[^>]+href=["'][^"']*team/i.test(html) || lowerBody.includes('our team') || lowerBody.includes('meet the')
  const hasGuarantee = lowerBody.includes('guarantee') || lowerBody.includes('money back') || lowerBody.includes('satisfaction')

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

function analyzeCompetitive(html: string, bodyText: string, scriptBasedChatDetected: boolean = false): CompetitiveScore {
  const lowerBody = bodyText.toLowerCase()
  const lowerHtml = html.toLowerCase()

  const hasBlog = /<a[^>]+href=["'][^"']*blog/i.test(html) || lowerBody.includes('blog')
  
  const ctaPattern = /<(a|button)[^>]+class=["'][^"']*(btn|cta|button)/gi
  const ctaElements = (html.match(ctaPattern) || []).length
  const ctaText = (lowerBody.match(/(get started|sign up|contact us|free quote|book now|schedule|call now|get a quote|learn more|try free|start now)/gi) || []).length
  const hasCTA = ctaElements > 0 || ctaText > 0
  const ctaCount = Math.max(ctaElements, ctaText)
  
  const chatKeywords = ['livechat', 'intercom', 'drift', 'tawk', 'zendesk', 'crisp', 'hubspot', 'tidio', 'olark', 'userlike', 'liveperson', 'purechat', 'chatwoot']
  const chatPhrases = ['talk to', 'chat with', 'message us', 'live chat', 'chat now', 'start chat', 'need help', 'ask us', 'speak with', 'contact us online', 'chat to', 'message our', 'speak to']
  const hasChatKeyword = chatKeywords.some(kw => lowerHtml.includes(kw))
  const hasChatPhrase = chatPhrases.some(phrase => lowerBody.includes(phrase) || lowerHtml.includes(phrase))
  const hasChatClass = /class=["'][^"']*chat/i.test(html) || /id=["'][^"']*chat/i.test(html) || /aria-label=["'][^"']*chat/i.test(html)
  const hasLiveChat = scriptBasedChatDetected || hasChatKeyword || hasChatPhrase || hasChatClass
  const hasVideoContent = /<video/i.test(html) || /<iframe[^>]+src=["'][^"']*(youtube|vimeo|wistia)/i.test(html)
  const hasFAQ = lowerBody.includes('faq') || lowerBody.includes('frequently asked') || lowerBody.includes('common question')
  const hasPortfolio = lowerBody.includes('portfolio') || lowerBody.includes('our work') || lowerBody.includes('project') || lowerBody.includes('gallery')
  const hasPricing = lowerBody.includes('pricing') || lowerBody.includes('price') || lowerBody.includes('cost') || /<a[^>]+href=["'][^"']*pricing/i.test(html)

  const valueProps = ['free', 'guarantee', 'fast', 'quick', 'affordable', 'professional', 'expert', 'certified', 'award', 'best', '#1', 'number one', 'leading', 'trusted']
  const uniqueSellingPoints = valueProps.filter(v => lowerBody.includes(v)).length

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

function generateRecommendations(website: WebsiteScore, reviews: ReviewScore, trust: TrustScore, competitive: CompetitiveScore, geo?: GEOScore): Recommendation[] {
  const recs: Recommendation[] = []

  if (!website.ssl) recs.push({ priority: 'critical', category: 'Security', title: 'Install SSL Certificate', description: 'Your site is not secure. Google penalizes HTTP sites and browsers show warning messages.', impact: 'Prevents ~40% of visitors from trusting your site' })
  if (!website.mobile) recs.push({ priority: 'critical', category: 'Mobile', title: 'Make Your Site Mobile-Friendly', description: 'No viewport meta tag detected. Your site likely looks broken on phones.', impact: '60%+ of traffic is mobile — you\'re losing most visitors' })
  
  // GEO-specific recommendations
  if (geo) {
    if (!geo.llmstxtPresent) recs.push({ priority: 'high', category: 'GEO', title: 'Create llms.txt File', description: 'AI crawlers need guidance to find your best content. Add /llms.txt to your site root.', impact: 'Improves AI search visibility by 40-60%' })
    if (!geo.schemaPresent) recs.push({ priority: 'high', category: 'GEO', title: 'Add Schema.org Markup', description: 'AI models rely on structured data. Add JSON-LD schema to key pages.', impact: 'Increases AI citation likelihood by 3x' })
    if (geo.aiCrawlersBlocked.length > 0) recs.push({ priority: 'critical', category: 'GEO', title: 'Unblock AI Crawlers in robots.txt', description: `You're blocking ${geo.aiCrawlersBlocked.join(', ')}. This makes you invisible to AI search.`, impact: 'Currently losing 100% of AI search traffic' })
  }
  
  if (!website.details.hasMetaDescription) recs.push({ priority: 'high', category: 'SEO', title: 'Add Meta Description', description: 'Search engines use this to display your site in results. Without it, Google picks random text.', impact: 'Can increase click-through rates by 5-10%' })
  if (reviews.score < 50) recs.push({ priority: 'high', category: 'Reviews', title: 'Add Social Proof', description: 'No testimonials, reviews, or ratings visible. Prospects need proof you deliver results.', impact: 'Social proof increases conversions by 15-30%' })
  if (!trust.details.hasPhone) recs.push({ priority: 'high', category: 'Trust', title: 'Display Phone Number Prominently', description: 'No phone number found. For local businesses, this is a dealbreaker.', impact: 'Increases leads by 10-20% for service businesses' })
  if (!trust.details.hasTrustBadges) recs.push({ priority: 'high', category: 'Trust', title: 'Add Trust Badges & Certifications', description: 'No BBB, industry certifications, or trust seals found.', impact: 'Trust badges increase purchase likelihood by 42%' })
  if (!competitive.details.hasLiveChat) recs.push({ priority: 'medium', category: 'Conversion', title: 'Add Live Chat', description: 'Competitors with live chat capture leads you\'re missing.', impact: 'Live chat users convert at 3-5x higher rates' })
  if (!competitive.details.hasVideoContent) recs.push({ priority: 'medium', category: 'Content', title: 'Add Video Content', description: 'No videos found. Video keeps visitors on-page longer and builds trust faster.', impact: 'Video on landing pages increases conversion by 80%' })
  if (!competitive.details.hasBlog) recs.push({ priority: 'medium', category: 'SEO', title: 'Start a Blog', description: 'No blog found. Regular content drives organic traffic and establishes authority.', impact: 'Companies that blog get 55% more website visitors' })

  return recs.slice(0, 12)
}

async function saveAuditForSEOAgent(result: AuditResult, email?: string): Promise<void> {
  console.log('🔵 saveAuditForSEOAgent called for:', result.url)
  try {
    const domain = new URL(result.url).hostname.replace(/^www\./, '')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${domain}_${timestamp}.json`
    const filePath = `/home/moltbot/seoagent-bot/incoming-audits/${filename}`
    console.log('🔵 Attempting to save to:', filePath)
    
    const auditData = {
      prospect: {
        domain,
        company_name: result.businessName,
        contact_email: email || '',
        submitted_at: result.timestamp,
        audit_url: result.url
      },
      technical_seo: {
        page_speed_score: Math.round((result.categories.website.loadTime <= 3000 ? 100 : (5000 - result.categories.website.loadTime) / 20)),
        mobile_friendly: result.categories.website.mobile,
        https_enabled: result.categories.website.ssl,
        meta_description_present: result.categories.website.details.hasMetaDescription,
        h1_tags: result.categories.website.details.hasH1 ? ['Homepage H1'] : [],
        images_without_alt: result.categories.website.details.imagesWithoutAlt,
        broken_links: 0,  // TODO: implement
        sitemap_present: false,  // TODO: implement
        robots_txt_present: result.categories.geo?.aiCrawlersAllowed.length ? true : false
      },
      geo: result.categories.geo ? {
        citability_score: result.categories.geo.citabilityScore,
        grade_distribution: result.categories.geo.gradeDistribution,
        schema_present: result.categories.geo.schemaPresent,
        schema_types: result.categories.geo.schemaTypes,
        llmstxt_present: result.categories.geo.llmstxtPresent,
        llmstxt_valid: result.categories.geo.llmstxtValid,
        ai_crawlers_allowed: result.categories.geo.aiCrawlersAllowed,
        ai_crawlers_blocked: result.categories.geo.aiCrawlersBlocked
      } : null,
      brand_authority: result.categories.brandAuthority,
      content: result.categories.content,
      scores: {
        overall: result.overallScore,
        geo: result.geoScore || 0,
        website: result.categories.website.score,
        reviews: result.categories.reviews.score,
        trust: result.categories.trustSignals.score,
        competitive: result.categories.competitive.score
      },
      raw_data: result.rawData
    }
    
    await fs.writeFile(filePath, JSON.stringify(auditData, null, 2), 'utf-8')
    console.log(`✅ Audit saved for SEO Agent: ${filePath}`)
    
    // Verify file was written
    const exists = await fs.access(filePath).then(() => true).catch(() => false)
    console.log(`🔵 File exists after write: ${exists}`)
  } catch (error) {
    console.error('❌ Failed to save audit for SEO Agent:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack')
  }
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

    const isSSL = targetUrl.startsWith('https')
    const parsedUrl = new URL(targetUrl)
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`

    // Fetch the website
    const startTime = Date.now()
    let response: Response
    try {
      response = await fetchWithTimeout(targetUrl)
    } catch (e: any) {
      try {
        targetUrl = targetUrl.replace('https://', 'http://')
        response = await fetchWithTimeout(targetUrl)
      } catch {
        return NextResponse.json({ error: 'Could not reach this website. Please check the URL and try again.' }, { status: 400 })
      }
    }
    const loadTime = Date.now() - startTime
    const html = await response.text()

    // Parse with Cheerio
    const $ = cheerio.load(html)
    const bodyText = $('body').text()

    const scriptBasedChatDetected = 
      html.includes('intercom') || 
      html.includes('drift') || 
      html.includes('tidio') ||
      $('iframe[src*="chat"], iframe[title*="chat" i], iframe[id*="chat" i]').length > 0

    // Extract business name
    const titleTag = $('title').first().text().trim()
    const ogTitle = $('meta[property="og:title"]').attr('content') || ''
    const businessName = ogTitle || titleTag || parsedUrl.hostname

    // === NEW: GEO-SEO Analysis ===
    const llmstxt = await checkLLMSTxt(baseUrl)
    const robotsTxt = await checkRobotsTxt(baseUrl)
    const geo = analyzeGEO(html, baseUrl, llmstxt, robotsTxt)
    const brandAuthority = analyzeBrandAuthority(html, bodyText)
    const content = analyzeContent($, bodyText)

    // === EXISTING: Original Analysis ===
    const website = analyzeWebsite(html, targetUrl, loadTime, isSSL)
    const reviews = analyzeReviews(html, bodyText)
    const trustSignals = analyzeTrustSignals(html, bodyText)
    const competitive = analyzeCompetitive(html, bodyText, scriptBasedChatDetected)

    const recommendations = generateRecommendations(website, reviews, trustSignals, competitive, geo)

    // Calculate GEO score
    let geoScore = 100
    if (!geo.llmstxtPresent) geoScore -= 20
    if (!geo.schemaPresent) geoScore -= 25
    if (geo.aiCrawlersBlocked.length > 0) geoScore -= 30
    if (!brandAuthority.youtubePresence) geoScore -= 15
    geoScore = Math.max(0, geoScore)

    const overallScore = Math.round(
      website.score * 0.25 +
      reviews.score * 0.20 +
      trustSignals.score * 0.20 +
      competitive.score * 0.15 +
      geoScore * 0.20
    )

    const result: AuditResult = {
      url: targetUrl,
      businessName,
      timestamp: new Date().toISOString(),
      overallScore,
      geoScore,
      categories: {
        website,
        reviews,
        trustSignals,
        competitive,
        geo,
        brandAuthority,
        content
      },
      recommendations,
      rawData: {
        homepageHtml: html,
        llmsTxt: llmstxt.content
      }
    }

    // Save for SEO Agent
    console.log('🟢 About to save audit for SEO Agent...', { url: result.url, email })
    await saveAuditForSEOAgent(result, email)
    console.log('🟢 saveAuditForSEOAgent completed')

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Audit error:', error)
    return NextResponse.json({ error: 'Failed to analyze website. Please try again.' }, { status: 500 })
  }
}
