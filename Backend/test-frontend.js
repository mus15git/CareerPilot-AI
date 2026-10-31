const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
        console.log("Navigating to frontend...");
        await page.goto('http://localhost:5174/', { waitUntil: 'networkidle0', timeout: 10000 });
        console.log("Saving screenshot of homepage...");
        await page.screenshot({ path: 'home.png' });

        // Wait, the frontend might be redirecting to a login page. Let's see it.
    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
})();
