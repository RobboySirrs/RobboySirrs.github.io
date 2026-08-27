const fs = require('fs');
const puppeteer = require('puppeteer');

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7'
};

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23ccc' stroke-width='2'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

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

          let url = item.url ? item.url.replace(/\\u002F/g, '/') : '#';
          if (url !== '#' && !url.startsWith('http')) {
            url = `https://www.ica.se${url}`;
          }

          icaItems.push({
            title: fullTitle.trim(),
            searchText: `${sourceName} ${item.image?.altText || ''} ${item.prefix || ''}`,
            image: imageUrl,
            url: url,
            source: sourceName,
            sourceClass: 'badge-ica'
          });
        } catch (e) {
          // Hoppa över trasiga objekt
        }
      });
    }
  } catch (err) {
    console.error("Fel vid parsning av ICA-data:", err);
  }

  return icaItems;
}

function parseCoopHtml(html) {
  if (!html) return [];
  const coopItems = [];
  try {
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    if (match && match[1]) {
      const data = JSON.parse(match[1]);
      const offers = data?.props?.pageProps?.offers || [];
      
      offers.forEach(item => {
        coopItems.push({
          title: item.title || item.heading || '',
          source: 'Coop Erbjudanden',
          image: item.imageUrl || PLACEHOLDER_IMG,
          url: item.url ? `https://www.coop.se${item.url}` : '#'
        });
      });
    }
  } catch (err) {
    console.error("Fel vid parsing av Coop HTML:", err);
  }
  return coopItems;
}

async function fetchCoopData() {
  const coopUrl = 'https://www.coop.se/handla/erbjudanden/';
  let browser = null;
  let page = null;

  try {
    console.log('[Steg 4/4] Startar Puppeteer för Coop...');
    browser = await puppeteer.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });

    page = await browser.newPage();
    await page.setExtraHTTPHeaders(BROWSER_HEADERS);
    await page.goto(coopUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const html = await page.content();
    const coopItems = parseCoopHtml(html);
    console.log(`[Coop] Hittade ${coopItems.length} erbjudanden!`);
    return coopItems;

  } catch (err) {
    console.error('[Coop] Fel vid hämtning med Puppeteer:', err.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

async function run() {
  console.log('=== Startar hämtning av erbjudanden ===');

  const mecenatUrl = 'https://www.mecenatalumni.com/service/falcon/v2/se/f/query?site=alumni';
  const hyresgastUrl = 'https://www.hyresgastforeningen.se/api/benefitlistingblock/?benefitListingBlockId=1ab9cc507df44e629eb3bf6584c5cc80&itemsLimit=6000&randomSortOrderSeed=825241421';
  const icaUrl = 'https://www.ica.se/stammis/partnererbjudanden/alla-erbjudanden/';

  let mecenatData = null;
  let hyresgastData = null;
  let icaItems = [];
  let coopItems = [];

  // 1. Mecenat Alumni
  console.log('[Steg 1/4] Påbörjar anrop till Mecenat...');
  try {
    const res = await fetch(mecenatUrl, { headers: BROWSER_HEADERS });
    if (res.ok) {
      mecenatData = await res.json();
      console.log('[Mecenat] Hämtning lyckades!');
    }
  } catch (err) {
    console.error('Mecenat fel:', err.message);
  }

  // 2. Hyresgästföreningen
  console.log('[Steg 2/4] Påbörjar anrop till Hyresgästföreningen...');
  try {
    const res = await fetch(hyresgastUrl, { headers: BROWSER_HEADERS });
    if (res.ok) {
      hyresgastData = await res.json();
      console.log('[Hyresgästföreningen] Hämtning lyckades!');
    }
  } catch (err) {
    console.error('Hyresgästföreningen fel:', err.message);
  }

  // 3. ICA
  console.log('[Steg 3/4] Påbörjar anrop till ICA...');
  try {
    const res = await fetch(icaUrl, { headers: BROWSER_HEADERS });
    if (res.ok) {
      const html = await res.text();
      icaItems = parseIcaHtml(html);
      console.log(`Hittade ${icaItems.length} ICA-erbjudanden!`);
    }
  } catch (err) {
    console.error('ICA fel:', err.message);
  }

  // 4. Coop (Puppeteer)
  coopItems = await fetchCoopData();

  // Spara allt till JSON
  console.log('[Slutsteg] Sparar finalData till fil...');
  try {
    const finalData = {
      updatedAt: new Date().toISOString(),
      mecenat: mecenatData,
      hyresgast: hyresgastData,
      ica: icaItems,
      coop: coopItems
    };

    fs.writeFileSync('data.json', JSON.stringify(finalData, null, 2));
    console.log('data.json uppdaterad!');
  } catch (err) {
    console.error('Kritiskt fel vid skrivning av data.json:', err.message);
  }
}

run();
