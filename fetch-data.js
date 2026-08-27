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

async function fetchCoopDeals() {
  console.log('Startar Puppeteer för Coop partnererbjudanden...');
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent(BROWSER_HEADERS['User-Agent']);

    await page.goto('https://www.coop.se/medlem/partnererbjudanden/', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('a.o_e3019J', { timeout: 10000 }).catch(() => {});

    const rawDeals = await page.evaluate((placeholder) => {
      try {
        const cards = document.querySelectorAll('a.o_e3019J');
        const sourceName = 'Coop Medlem';
        
        return Array.from(cards).map(card => {
          const titleEl = card.querySelector('h3.qCtytrLV');
          const textEl = card.querySelector('.T9KSX3ng');
          const href = card.getAttribute('href');

          const imgDiv = card.querySelector('.cjGGRnc3');
          let imageUrl = placeholder;
          if (imgDiv) {
            const bgStyle = imgDiv.style?.backgroundImage || '';
            const match = bgStyle.match(/url\(['"]?(.*?)['"]?\)/);
            if (match && match[1]) {
              imageUrl = match[1].startsWith('//') ? `https:${match[1]}` : match[1];
            }
          }

          const rawText = textEl ? textEl.innerText.trim() : '';
          const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

          const discountLine = lines.find(line => 
            (/%|rabatt/i.test(line)) && !/bonuspoäng|poäng/i.test(line)
          ) || null;

          const partnerTitle = titleEl ? titleEl.innerText.trim() : '';
          const fullTitle = partnerTitle && discountLine 
            ? `${partnerTitle}: ${discountLine}` 
            : (partnerTitle || discountLine || '');

          let url = href ? href.trim() : '#';
          if (url !== '#' && !url.startsWith('http')) {
            url = `https://www.coop.se${url}`;
          }

          return {
            title: fullTitle,
            searchText: `${sourceName} ${partnerTitle} ${discountLine || ''}`,
            image: imageUrl,
            url: url,
            source: sourceName,
            sourceClass: 'badge-coop',
            discount: discountLine
          };
        });
      } catch (e) {
        return [];
      }
    }, PLACEHOLDER_IMG);

    return rawDeals.filter(deal => deal.discount !== null && deal.title !== '');

  } catch (err) {
    console.error('Coop fel vid Puppeteer-hämtning:', err.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function run() {
  console.log('Startar hämtning av erbjudanden...');

  const mecenatUrl = 'https://www.mecenatalumni.com/service/falcon/v2/se/f/query?site=alumni';
  const hyresgastUrl = 'https://www.hyresgastforeningen.se/api/benefitlistingblock/?benefitListingBlockId=1ab9cc507df44e629eb3bf6584c5cc80&itemsLimit=6000&randomSortOrderSeed=825241421';
  const icaUrl = 'https://www.ica.se/stammis/partnererbjudanden/alla-erbjudanden/';

  let mecenatData = null;
  let hyresgastData = null;
  let icaItems = [];
  let coopItems = [];

  // 1. Mecenat Alumni
  try {
    const res = await fetch(mecenatUrl, { headers: BROWSER_HEADERS });
    if (res.ok) mecenatData = await res.json();
  } catch (err) {
    console.error('Mecenat fel:', err.message);
  }

  // 2. Hyresgästföreningen
  try {
    const res = await fetch(hyresgastUrl, { headers: BROWSER_HEADERS });
    if (res.ok) hyresgastData = await res.json();
  } catch (err) {
    console.error('Hyresgästföreningen fel:', err.message);
  }

  // 3. ICA (Hämta HTML och kör parsning)
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

  // 4. Coop (Kör Puppeteer)
  try {
    coopItems = await fetchCoopDeals();
    console.log(`Hittade ${coopItems.length} Coop-erbjudanden med rabatt!`);
  } catch (err) {
    console.error('Coop fel:', err.message);
  }

  // Spara helt färdig parsad JSON
  try {
    const finalData = {
      updatedAt: new Date().toISOString(),
      mecenat: mecenatData,
      hyresgast: hyresgastData,
      ica: icaItems,
      coop: coopItems
    };

    fs.writeFileSync('data.json', JSON.stringify(finalData, null, 2));
    console.log('data.json uppdaterad med alla källor!');
  } catch (err) {
    console.error('Fel vid skrivning till data.json:', err.message);
  }
}

run();
