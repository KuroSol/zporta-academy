// API route for exporting lessons as PDF
// Route: /api/lessons/export?permalink=username/subject/date/slug&format=pdf

// Dynamic import so deployment can choose to install puppeteer or not.
// If puppeteer is missing we return an instructional error instead of crashing.
let puppeteerModulePromise;
async function getPuppeteer() {
  if (!puppeteerModulePromise) {
    puppeteerModulePromise = import('puppeteer').catch(() => null);
  }
  const mod = await puppeteerModulePromise;
  return mod;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { permalink, format = 'pdf' } = req.query;

  if (!permalink) {
    return res.status(400).json({ error: 'Missing permalink parameter' });
  }

  // Construct the lesson page URL
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host;
  const lessonUrl = `${protocol}://${host}/lessons/${permalink}`;

  console.log(`[Export] Generating ${format} for: ${lessonUrl}`);

  let browser;
  
  try {
    const puppeteer = await getPuppeteer();
    if (!puppeteer) {
      return res.status(500).json({
        error: 'PDF export unavailable: puppeteer is not installed.',
        install: 'Run: npm install puppeteer',
      });
    }
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security'
      ]
    });

    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2
    });

    // Get auth token from request cookies if available
    const authToken = req.cookies?.token;
    if (authToken) {
      try {
        await page.setCookie({
          name: 'token',
          value: authToken,
          domain: new URL(lessonUrl).hostname,
          path: '/'
        });
      } catch (e) {
        console.warn('[Export] Could not set auth cookie:', e.message);
      }
    }

    // Navigate to the lesson page
    console.log('[Export] Navigating to:', lessonUrl);
    await page.goto(lessonUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for lesson content to load - try multiple selectors
    console.log('[Export] Waiting for content...');
    try {
      await page.waitForSelector('[class*="lessonContent"], [class*="content"], main, body', {
        timeout: 10000
      });
    } catch (e) {
      console.warn('[Export] Timeout waiting for content selector, proceeding anyway');
    }

    // Additional wait for dynamic content and images
    console.log('[Export] Waiting for dynamic content...');
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5000)));

    // Check if we have content
    const hasContent = await page.evaluate(() => {
      const body = document.body;
      const textContent = body?.textContent || '';
      console.log('Page text length:', textContent.length);
      return textContent.length > 100;
    });

    console.log('[Export] Has content:', hasContent);

    if (!hasContent) {
      await browser.close();
      browser = null;
      return res.status(500).json({ 
        error: 'Page appears to be empty or failed to load',
        url: lessonUrl
      });
    }

    // Hide interactive elements that shouldn't be in PDF
    await page.evaluate(() => {
      // Hide download buttons
      const downloadSections = document.querySelectorAll('[class*="downloadSection"], [class*="download-section"]');
      downloadSections.forEach(el => el.style.display = 'none');

      // Hide navigation, headers, footers
      const elementsToHide = [
        'nav',
        'header[role="banner"]',
        'footer',
        '[class*="navbar"]',
        '[class*="navigation"]',
        '[class*="sidebar"]',
        '[class*="completeBtn"]',
        '[class*="lessonActions"]',
        '[class*="editBtn"]',
        '[class*="deleteBtn"]',
        'button[class*="complete"]',
        'button[class*="edit"]',
        'button[class*="delete"]'
      ];

      elementsToHide.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(el => {
            if (el) el.style.display = 'none';
          });
        } catch (e) {
          // Ignore selector errors
        }
      });

      // Add print-friendly styles
      const style = document.createElement('style');
      style.textContent = `
        @media print {
          body { 
            margin: 0; 
            padding: 20px;
            background: white !important;
          }
          * { 
            box-shadow: none !important;
            text-shadow: none !important;
          }
          a { 
            text-decoration: underline;
            color: #0066cc !important;
          }
          img {
            max-width: 100% !important;
            page-break-inside: avoid;
          }
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
          }
          pre, blockquote, table {
            page-break-inside: avoid;
          }
        }
      `;
      document.head.appendChild(style);
    });

    if (format === 'pdf') {
      console.log('[Export] Generating PDF...');
      
      // Get page dimensions for logging
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight
      }));
      console.log('[Export] Page dimensions:', dimensions);
      
      // Generate PDF
      const pdf = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        preferCSSPageSize: false
      });

      await browser.close();
      browser = null;

      // Inspect first bytes to ensure %PDF header
      const headerSample = pdf.slice(0, 5).toString('utf8');
      console.log('[Export] PDF header starts with:', headerSample);
      console.log('[Export] PDF size:', pdf.length, 'bytes');
      console.log('[Export] PDF generated successfully');

      if (pdf.length < 1000) {
        return res.status(500).json({ 
          error: 'Generated PDF is too small, likely empty',
          size: pdf.length
        });
      }

      // Set response headers
      const lessonSlug = permalink.split('/').pop();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${lessonSlug}.pdf"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Length', pdf.length);
      // Send buffer cleanly
      res.status(200).end(pdf);
      return; // ensure no extra data appended
      
    } else {
      await browser.close();
      browser = null;
      return res.status(400).json({ error: 'Only PDF format is currently supported' });
    }

  } catch (error) {
    console.error('[Export] Error generating PDF:', error);
    
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
