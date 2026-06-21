let pw;
try {
  pw = require('playwright');
} catch (e) {
  // Playwright not installed
}

async function run(monitor) {
  if (!pw) {
    return { status: 'down', message: 'Playwright not installed' };
  }

  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(monitor.target, { timeout: 30000, waitUntil: 'networkidle' });

    if (monitor.expected) {
      try {
        await page.waitForSelector(monitor.expected, { timeout: 10000 });
      } catch (e) {
        await browser.close();
        return { status: 'down', message: `Selector '${monitor.expected}' not found` };
      }
    }

    await browser.close();
    return { status: 'up', message: 'Scenario passed' };
  } catch (err) {
    if (browser) try { await browser.close(); } catch (_) {}
    return { status: 'down', message: err.message };
  }
}

module.exports = { run };
