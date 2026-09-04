const fs = require('fs');
const puppeteer = require('puppeteer');

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7'
};

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23ccc' stroke-width='2'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

/**
 * Läser in gamla data.json och skapar en uppsättning (Set) med alla titlar som fanns tidigare.
 */
function getOldTitles() {
  const oldTitles = new Set();
  if (!fs.existsSync('data.json')) return oldTitles;

  try {
    const raw = fs.readFileSync('data.json', 'utf8');
    const oldData = JSON.parse(raw);

    // 1. Mecenat
    if (oldData.mecenat && Array.isArray(oldData.mecenat.discounts)) {
      oldData.mecenat.discounts.forEach(item => {
        const title = item.brandName ? `${item.brandName}: ${item.title}` : item.title;
        if (title) oldTitles.add(title.trim().toLowerCase());
      });
    }

    // 2. Hyresgästföreningen
    if (oldData.hyresgast && Array.isArray(oldData.hyresgast.items)) {
      oldData.hyresgast.items.forEach(item => {
        let brandName = '';
        if (item.url) {
          const segments = item.url.split('/').filter(Boolean);
          if (segments.length > 0) {
            const slug = segments[segments.length - 1];
            brandName = slug.split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }
        }
        const title = brandName ? `${brandName}: ${item.title}` : item.title;
        if (title) oldTitles.add(title.trim().toLowerCase());
      });
    }

    // 3. ICA Stammis
    if (Array.isArray(oldData.ica)) {
      oldData.ica.forEach(item => {
        const title = item.title || item.name || '';
        if (title) oldTitles.add(title.trim().toLowerCase());
      });
    }

    // 4. Coop Medlem
    if (Array.isArray(oldData.coop)) {
      oldData.coop.forEach(item => {
        const title = item.title || '';
        if (title) oldTitles.add(title.trim().toLowerCase());
      });
    }

  } catch (e) {
    console.warn('Kunde inte läsa in gamla titlar från data.json:', e.message);
  }

  return oldTitles;
}

function parseIcaHtml(html, oldTitles) {
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

          const cleanTitle = fullTitle.trim();
          const isNew = cleanTitle ? !oldTitles.has(cleanTitle.toLowerCase()) : false;

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
            title: cleanTitle,
            searchText: `${sourceName} ${item.image?.altText || ''} ${item.prefix || ''}`,
            image: imageUrl,
            url: url,
            source: sourceName,
            sourceClass: 'badge-ica',
            isNew: isNew
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

async function fetchCoopDeals(oldTitles) {
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

    return rawDeals
      .filter(deal => deal.discount !== null && deal.title !== '')
      .map(deal => ({
        ...deal,
        isNew: !oldTitles.has(deal.title.trim().toLowerCase())
      }));

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

  // Hämta alla gamla titlar innan vi läser in ny data
  const oldTitles = getOldTitles();
  console.log(`Hittade ${oldTitles.size} befintliga titlar från tidigare data.json.`);

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
    if (res.ok) {
      mecenatData = await res.json();
      if (mecenatData && Array.isArray(mecenatData.discounts)) {
        mecenatData.discounts = mecenatData.discounts.map(item => {
          const title = item.brandName ? `${item.brandName}: ${item.title}` : item.title;
          const isNew = title ? !oldTitles.has(title.trim().toLowerCase()) : false;
          return { ...item, isNew };
        });
      }
    }
  } catch (err) {
    console.error('Mecenat fel:', err.message);
  }

  // 2. Hyresgästföreningen
  try {
    const res = await fetch(hyresgastUrl, { headers: BROWSER_HEADERS });
    if (res.ok) {
      hyresgastData = await res.json();
      if (hyresgastData && Array.isArray(hyresgastData.items)) {
        hyresgastData.items = hyresgastData.items.map(item => {
          let brandName = '';
          if (item.url) {
            const segments = item.url.split('/').filter(Boolean);
            if (segments.length > 0) {
              const slug = segments[segments.length - 1];
              brandName = slug.split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }
          }
          const title = brandName ? `${brandName}: ${item.title}` : item.title;
          const isNew = title ? !oldTitles.has(title.trim().toLowerCase()) : false;
          return { ...item, isNew };
        });
      }
    }
  } catch (err) {
    console.error('Hyresgästföreningen fel:', err.message);
  }

  // 3. ICA (Hämta HTML och kör parsning)
  try {
    const res = await fetch(icaUrl, { headers: BROWSER_HEADERS });
    if (res.ok) {
      const html = await res.text();
      icaItems = parseIcaHtml(html, oldTitles);
      console.log(`Hittade ${icaItems.length} ICA-erbjudanden!`);
    }
  } catch (err) {
    console.error('ICA fel:', err.message);
  }

  // 4. Coop (Kör Puppeteer)
  try {
    coopItems = await fetchCoopDeals(oldTitles);
    console.log(`Hittade ${coopItems.length} Coop-erbjudanden med rabatt!`);
  } catch (err) {
    console.error('Coop fel:', err.message);
  }

  // Spara helt färdig parsad JSON med isNew-flaggor
  try {
    const finalData = {
      updatedAt: new Date().toISOString(),
      mecenat: mecenatData,
      hyresgast: hyresgastData,
      ica: icaItems,
      coop: coopItems
    };

    fs.writeFileSync('data.json', JSON.stringify(finalData, null, 2));
    console.log('data.json uppdaterad med alla källor och "isNew"-märkningar!');
  } catch (err) {
    console.error('Fel vid skrivning till data.json:', err.message);
  }
}

run();
