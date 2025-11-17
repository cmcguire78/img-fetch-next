import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ success: false, error: 'Missing url' }, { status: 400, headers: corsHeaders });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // STEP 1: Clean the URL — strip everything after .jpg/.jpeg/.png/.webp
    const cleanImageUrl = url.replace(/\?(.*)$/, '').replace(/#(.*)$/, '');

    console.log('Original URL:', url);
    console.log('Cleaned URL:', cleanImageUrl);

    // STEP 2: Go directly to the cleaned image URL
    await page.goto(cleanImageUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // STEP 3: Screenshot the entire image
    const buffer = await page.screenshot({ type: 'jpeg', quality: 92 });

    const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;

    return NextResponse.json(
      {
        success: true,
        image: base64,
        contentType: 'image/jpeg',
        size: buffer.length,
        originalUrl: url,
        cleanedUrl: cleanImageUrl,
      },
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('Puppeteer screenshot failed:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to capture image' },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    if (browser) await browser.close();
  }
}
