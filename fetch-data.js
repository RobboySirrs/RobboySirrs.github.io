const fs = require('fs');
const puppeteer = require('puppeteer');

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7'
};

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23ccc' stroke-width='2'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

// ==========================================
// PARSERS (Extraherar data ur HTML)
// ==========================================

function parseIcaHtml(html) {
  if (!html) return [];
  
  const icaItems = [];
  try {
    const matches = html.match(/\{"image":[\s\S]*?"component":"OfferPartnerPageNavigationBlock"[^}]*\}/g);

    if (matches) {
      matches.forEach(jsonStr => {
        try {
          const item = JSON.parse(jsonStr);
          const sourceName = 'ICA Stammis';

          const partner = item.partnerName || item.title || '';
          const preamble = item.preamble || item.title || '';
          const fullTitle = partner && preamble && partner !== preamble 
            ? `${partner}: ${preamble}` 
            : preamble;

          let imageUrl = PLACEHOLDER_IMG;
          const imageId = item.image?.small?.id || item.image?.medium?.id || item.image?.large?.id;
          if (imageId) {
            imageUrl = `https://assets.icanet.se/w_400,c_scale,f_auto,q_auto/${imageId}`;
          }

          icaItems.push({
            title: fullTitle,
            source: sourceName,
            image: imageUrl,
            link: item.url || '#'
          });
        } catch (e) {
          // Hoppa över trasig JSON-match
        }
      });
    }
  } catch (err) {
    console.error("Fel vid parsing av ICA HTML:", err);
  }

  return icaItems;
}

function parseCoopHtml(html) {
  if (!html) return [];
  
  const coopItems = [];
  try {
    // Exempel på uthämtning ur Coops __NEXT_DATA__ i HTML
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    if (match && match[1]) {
      const data = JSON.parse(match[1]);
      // Anpassa sökvägen till Coop-objekten i deras Next-state vid behov
      const offers = data?.props?.pageProps?.offers || [];
      
      offers.forEach(item => {
        coopItems.push({
          title: item.title || item.heading || '',
          source: 'Coop Erbjudanden',
          image: item.imageUrl || PLACEHOLDER_IMG,
          link: item.url ? `https://www.coop.se${item.url}` : '#'
        });
      });
    }
  } catch (err) {
    console.error("Fel vid parsing av Coop HTML:", err);
  }

  return coopItems;
}

// ==========================================
// ENKILDA SIDA-HÄMTNINGAR (ISOLERAD FELHANTERING)
// ==========================================

async function fetchIcaPage(browser, url) {
  let page = null;
  try {
    page = await browser.newPage();
    await page.setExtraHTTPHeaders(BROWSER_HEADERS);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const html = await page.content();
    return parseIcaHtml(html);
  } catch (err) {
    console.error(`Fel vid hämtning av ICA (${url}):`, err.message);
    return []; // Returnerar [] så Promise.all inte stannar
  } finally {
    if (page) await page.close();
  }
}

async function fetchCoopPage(browser, url) {
  let page = null;
  try {
    page = await browser.newPage();
    await page.setExtraHTTPHeaders(BROWSER_HEADERS);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const html = await page.content();
    return parseCoopHtml(html);
  } catch (err) {
    console.error(`Fel vid hämtning av Coop (${url}):`, err.message);
    return []; // Returnerar [] så Promise.all inte stannar
  } finally {
    if (page) await page.close();
  }
}

// ==========================================
// HUVUDFUNKTION (KÖR PARALLELLT)
// ==========================================

async function run() {
  let browser = null;
  const icaUrl = 'https://www.ica.se/erbjudanden/partnererbjudanden/';
  const coopUrl = 'https://www.coop.se/handla/erbjudanden/';

  try {
    browser = await puppeteer.launch({ headless: "new" });

    // Kör båda anropen helt parallellt
    const [icaItems, coopItems] = await Promise.all([
      fetchIcaPage(browser, icaUrl),
      fetchCoopPage(browser, coopUrl)
    ]);

    // Slå ihop båda listorna
    const allItems = [...icaItems, ...coopItems];

    console.log(`Totalt hämtade objekt: ${allItems.length} (ICA: ${icaItems.length}, Coop: ${coopItems.length})`);
    return allItems;

  } catch (err) {
    console.error("Kritiskt fel i run():", err);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

// Kör koden
run().then(results => {
  console.log("Körning klar.");
});
        
