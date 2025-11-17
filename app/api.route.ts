import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',        // Allows your Replit domain + any other
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle preflight OPTIONS request
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// Your existing image-fetching logic (unchanged, just moved inside POST)
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string' || !url.includes('boats.com')) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing url' },
        { status: 400, headers: corsHeaders }
      );
    }

    // ───── Direct fetch first (fast path) ─────
    const direct = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Referer: 'https://www.boats.com/',
      },
    });

    if (direct.ok) {
      const buffer = Buffer.from(await direct.arrayBuffer());
      const contentType = direct.headers.get('content-type') || 'image/jpeg';
      const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
      return NextResponse.json(
        { success: true, image: base64, contentType, size: buffer.length },
        { headers: corsHeaders }
      );
    }

    // ───── Fallback to Puppeteer (rarely needed now) ─────
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const response = await page.goto(url);
    const buffer = await response!.buffer();
    await browser.close();

    const contentType = response!.headers()['content-type'] || 'image/jpeg';
    const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;

    return NextResponse.json(
      { success: true, image: base64, contentType, size: buffer.length },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Vercel API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch image' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Optional: Allow GET for quick testing
export async function GET() {
  return NextResponse.json(
    { error: 'POST a JSON body with { "url": "https://images.boats.com/..." }' },
    { headers: corsHeaders }
  );
}
