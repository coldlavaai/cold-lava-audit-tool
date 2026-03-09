import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export const maxDuration = 60

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

async function getBrowserInstance() {
  if (process.env.VERCEL) {
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  } else {
    // Local development - use system Chrome
    return puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
}

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

  // More comprehensive testimonial detection
  const testimonialPatterns = [
    'testimonial', 'what our', 'client say', 'customer say', 'customer review',
    'client review', 'customer feedback', 'hear from', 'words from',
    'loved working with', 'highly recommend', 'excellent service',
    'great experience', 'would recommend', 'very professional',
    'amazing', 'fantastic', 'brilliant', 'outstanding',
    /customer[^.]{0,50}said/i.test(bodyText),
    /client[^.]{0,50}said/i.test(bodyText),
  ]
  const hasTestimonials = testimonialPatterns.some(p => typeof p === 'string' ? lowerBody.includes(p) : p) || /class=["'][^"']*testimonial/i.test(html) || /class=["'][^"']*review/i.test(html)
  
  const hasReviewWidgets = lowerHtml.includes('trustpilot') || lowerHtml.includes('google review') || lowerHtml.includes('yelp') || /<iframe[^>]+src=["'][^"']*(google|yelp|trustpilot|reviews)/i.test(html) || lowerHtml.includes('reviews.io')
  const mentionsGoogle = lowerBody.includes('google') && (lowerBody.includes('review') || lowerBody.includes('rating') || lowerBody.includes('star'))
  const mentionsYelp = lowerBody.includes('yelp')
  const hasCaseStudies = lowerBody.includes('case stud') || lowerBody.includes('success stor')
  const hasStarRatings = /class=["'][^"']*star/i.test(html) || /class=["'][^"']*rating/i.test(html) || bodyText.includes('★') || bodyText.includes('⭐') || /[45]\.?\d?\s*\/?\s*5\s*(star|rating)/i.test(bodyText)

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
  // More comprehensive address detection
  const addressPatterns = [
    lowerBody.includes('address'),
    lowerBody.includes('street'),
    lowerBody.includes('suite'),
    lowerBody.includes('office'),
    /\d+\s+[\w\s]+(?:st|ave|blvd|rd|dr|ln|way|ct|street|avenue|boulevard|road|drive|lane|court)/i.test(bodyText),
    /\b(?:road|street|avenue|lane|drive|close|way|place|crescent)\b/i.test(lowerBody) && /\d{1,5}/.test(bodyText), // UK/US style
    /[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}/i.test(bodyText), // UK postcode
    /\d{5}(-\d{4})?/.test(bodyText) && (lowerBody.includes('zip') || lowerBody.includes('postal')), // US ZIP
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
  
  // Comprehensive live chat detection
  const chatKeywords = ['livechat', 'intercom', 'drift', 'tawk', 'zendesk', 'crisp', 'hubspot', 'tidio', 'olark', 'userlike', 'liveperson', 'purechat', 'chatwoot']
  const chatPhrases = ['talk to', 'chat with', 'message us', 'live chat', 'chat now', 'start chat', 'need help', 'ask us', 'speak with', 'contact us online', 'chat to', 'message our']
  const hasChatKeyword = chatKeywords.some(kw => lowerHtml.includes(kw))
  const hasChatPhrase = chatPhrases.some(phrase => lowerBody.includes(phrase))
  const hasChatClass = /class=["'][^"']*chat/i.test(html) || /id=["'][^"']*chat/i.test(html)
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

function generateRecommendations(website: WebsiteScore, reviews: ReviewScore, trust: TrustScore, competitive: CompetitiveScore): Recommendation[] {
  const recs: Recommendation[] = []

  if (!website.ssl) recs.push({ priority: 'critical', category: 'Security', title: 'Install SSL Certificate', description: 'Your site is not secure. Google penalizes HTTP sites and browsers show warning messages.', impact: 'Prevents ~40% of visitors from trusting your site' })
  if (!website.mobile) recs.push({ priority: 'critical', category: 'Mobile', title: 'Make Your Site Mobile-Friendly', description: 'No viewport meta tag detected. Your site likely looks broken on phones.', impact: '60%+ of traffic is mobile — you\'re losing most visitors' })
  if (!website.details.hasMetaDescription) recs.push({ priority: 'high', category: 'SEO', title: 'Add Meta Description', description: 'Search engines use this to display your site in results. Without it, Google picks random text.', impact: 'Can increase click-through rates by 5-10%' })
  if (reviews.score < 50) recs.push({ priority: 'high', category: 'Reviews', title: 'Add Social Proof', description: 'No testimonials, reviews, or ratings visible. Prospects need proof you deliver results.', impact: 'Social proof increases conversions by 15-30%' })
  if (!trust.details.hasPhone) recs.push({ priority: 'high', category: 'Trust', title: 'Display Phone Number Prominently', description: 'No phone number found. For local businesses, this is a dealbreaker.', impact: 'Increases leads by 10-20% for service businesses' })
  if (!trust.details.hasTrustBadges) recs.push({ priority: 'high', category: 'Trust', title: 'Add Trust Badges & Certifications', description: 'No BBB, industry certifications, or trust seals found.', impact: 'Trust badges increase purchase likelihood by 42%' })
  if (!competitive.details.hasLiveChat) recs.push({ priority: 'medium', category: 'Conversion', title: 'Add Live Chat', description: 'Competitors with live chat capture leads you\'re missing.', impact: 'Live chat users convert at 3-5x higher rates' })
  if (!competitive.details.hasVideoContent) recs.push({ priority: 'medium', category: 'Content', title: 'Add Video Content', description: 'No videos found. Video keeps visitors on-page longer and builds trust faster.', impact: 'Video on landing pages increases conversion by 80%' })
  if (!competitive.details.hasBlog) recs.push({ priority: 'medium', category: 'SEO', title: 'Start a Blog', description: 'No blog found. Regular content drives organic traffic and establishes authority.', impact: 'Companies that blog get 55% more website visitors' })
  if (!competitive.details.hasFAQ) recs.push({ priority: 'medium', category: 'Content', title: 'Add FAQ Section', description: 'Answer common questions before prospects have to ask.', impact: 'Reduces bounce rate and support inquiries' })
  if (!website.details.hasOgTags) recs.push({ priority: 'low', category: 'Social', title: 'Add Open Graph Tags', description: 'When someone shares your site, it looks plain. OG tags make shares look professional.', impact: 'Better social media appearance increases shares' })
  if (!trust.details.hasPrivacyPolicy) recs.push({ priority: 'low', category: 'Legal', title: 'Add Privacy Policy', description: 'Required by law if you collect any data. Also a trust signal.', impact: 'Legal compliance and trust building' })

  return recs.slice(0, 10)
}

export async function POST(req: NextRequest) {
  let browser
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

    // Launch browser
    browser = await getBrowserInstance()
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    // Navigate and wait for page to fully render
    const startTime = Date.now()
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    } catch (e: any) {
      if (!isSSL) {
        await browser.close()
        return NextResponse.json({ error: 'Could not reach this website. Please check the URL and try again.' }, { status: 400 })
      }
      // Try HTTP
      try {
        targetUrl = targetUrl.replace('https://', 'http://')
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 })
      } catch {
        await browser.close()
        return NextResponse.json({ error: 'Could not reach this website. Please check the URL and try again.' }, { status: 400 })
      }
    }

    const loadTime = Date.now() - startTime

    // Scroll to load lazy content
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0
        const distance = 100
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight
          window.scrollBy(0, distance)
          totalHeight += distance
          if (totalHeight >= scrollHeight) {
            clearInterval(timer)
            resolve(null)
          }
        }, 100)
      })
    })

    // Wait for chat widgets and dynamic content to load (many load on a delay)
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Get fully rendered HTML and text content
    const html = await page.content()
    const bodyText = await page.evaluate(() => document.body.innerText || '')
    
    // Also check for chat widget scripts and iframes
    const hasIntercomScript = await page.evaluate(() => !!document.querySelector('script[src*="intercom"]'))
    const hasDriftScript = await page.evaluate(() => !!document.querySelector('script[src*="drift"]'))
    const hasTidioScript = await page.evaluate(() => !!document.querySelector('script[src*="tidio"]'))
    const hasChatIframe = await page.evaluate(() => !!document.querySelector('iframe[src*="chat"], iframe[title*="chat" i], iframe[id*="chat" i]'))
    const scriptBasedChatDetected = hasIntercomScript || hasDriftScript || hasTidioScript || hasChatIframe

    // Extract business name
    const titleTag = await page.title()
    const ogTitle = await page.$eval('meta[property="og:title"]', (el) => el.getAttribute('content')).catch(() => '')
    const businessName = ogTitle || titleTag || new URL(targetUrl).hostname

    await browser.close()
    browser = null

    // Run all analyses
    const website = analyzeWebsite(html, targetUrl, loadTime, isSSL)
    const reviews = analyzeReviews(html, bodyText)
    const trustSignals = analyzeTrustSignals(html, bodyText)
    const competitive = analyzeCompetitive(html, bodyText, scriptBasedChatDetected)

    const recommendations = generateRecommendations(website, reviews, trustSignals, competitive)

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
    if (browser) await browser.close()
    return NextResponse.json({ error: 'Failed to analyze website. Please try again.' }, { status: 500 })
  }
}
