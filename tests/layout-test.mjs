import { chromium, devices } from 'playwright';

const URL = 'https://race.kwstudio.by/';
const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

const SECTIONS = [
  { id: 'hero', label: 'Hero' },
  { id: 'mechanics', label: 'Механика игры' },
  { id: 'main-prize', label: 'Главный приз' },
  { id: 'prizes', label: 'Другие призы' },
  { id: 'cards', label: 'Карты' },
  { id: 'virtual-card', label: 'Виртуальная карта' },
  { id: 'faq', label: 'FAQ' },
];

function hasHorizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollW = Math.max(doc.scrollWidth, body.scrollWidth);
    const clientW = doc.clientWidth;
    return { overflow: scrollW > clientW + 1, scrollW, clientW, diff: scrollW - clientW };
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = { passed: [], warnings: [], failed: [], info: [] };

  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  // --- Page load ---
  try {
    const response = await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    if (!response || !response.ok()) {
      results.failed.push(`Страница вернула статус ${response?.status() ?? 'нет ответа'}`);
    } else {
      results.passed.push(`Страница загружена (HTTP ${response.status()})`);
    }
  } catch (e) {
    results.failed.push(`Не удалось загрузить страницу: ${e.message}`);
    await browser.close();
    printReport(results);
    process.exit(1);
  }

  await page.waitForTimeout(1500);

  // --- Title ---
  const title = await page.title();
  if (title.includes('Приорбанком') && title.includes('Баку')) {
    results.passed.push(`Title корректный: «${title}»`);
  } else {
    results.warnings.push(`Title неожиданный: «${title}»`);
  }

  // --- Viewport meta ---
  const viewportMeta = await page.$eval('meta[name="viewport"]', (el) => el.content).catch(() => null);
  if (viewportMeta?.includes('width=device-width')) {
    results.passed.push(`Viewport meta: ${viewportMeta}`);
  } else {
    results.failed.push(`Viewport meta отсутствует или некорректен`);
  }

  // --- Horizontal overflow per viewport ---
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(400);
    const { overflow, scrollW, clientW, diff } = await hasHorizontalOverflow(page);
    if (overflow) {
      results.failed.push(`[${vp.name}] Горизонтальный overflow: scrollWidth=${scrollW}px, clientWidth=${clientW}px (+${diff}px)`);
    } else {
      results.passed.push(`[${vp.name}] Нет горизонтального overflow`);
    }
  }

  // --- Sections visibility (desktop) ---
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const sec of SECTIONS) {
    const el = page.locator(`#${sec.id}`);
    const count = await el.count();
    if (count === 0) {
      results.failed.push(`Секция #${sec.id} (${sec.label}) не найдена в DOM`);
      continue;
    }
    await el.scrollIntoViewIfNeeded();
    const visible = await el.isVisible();
    const box = await el.boundingBox();
    if (!visible || !box || box.height < 10) {
      results.failed.push(`Секция #${sec.id} (${sec.label}) не видна или имеет нулевую высоту`);
    } else {
      results.passed.push(`Секция #${sec.id} (${sec.label}) видна (${Math.round(box.height)}px)`);
    }
  }

  // --- Broken images ---
  const brokenImages = await page.evaluate(() => {
    return [...document.querySelectorAll('img')].filter((img) => {
      if (!img.complete) return false;
      return img.naturalWidth === 0 && img.getAttribute('src');
    }).map((img) => ({ src: img.getAttribute('src'), alt: img.alt }));
  });
  if (brokenImages.length) {
    for (const img of brokenImages.slice(0, 10)) {
      results.failed.push(`Битое изображение: ${img.src} (alt: ${img.alt || '—'})`);
    }
    if (brokenImages.length > 10) results.failed.push(`...и ещё ${brokenImages.length - 10} битых изображений`);
  } else {
    results.passed.push('Все загруженные изображения отображаются');
  }

  // --- Header fixed ---
  const header = page.locator('.site-header');
  const headerPos = await header.evaluate((el) => getComputedStyle(el).position);
  if (headerPos === 'fixed' || headerPos === 'sticky') {
    results.passed.push(`Шапка закреплена (position: ${headerPos})`);
  } else {
    results.warnings.push(`Шапка не fixed/sticky (position: ${headerPos})`);
  }

  // --- Mobile menu ---
  await page.setViewportSize({ width: 375, height: 812 });
  const menuBtn = page.locator('.site-header__menu-btn');
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await page.waitForTimeout(500);
    const offcanvas = page.locator('#mobileMenu.show, #mobileMenu.showing');
    const menuOpen = (await offcanvas.count()) > 0;
    if (menuOpen) {
      results.passed.push('Мобильное меню открывается');
      await page.locator('#mobileMenu .btn-close').click();
      await page.waitForTimeout(300);
    } else {
      const offcanvasVisible = await page.locator('#mobileMenu').evaluate((el) => el.classList.contains('show'));
      if (offcanvasVisible) {
        results.passed.push('Мобильное меню открывается');
      } else {
        results.failed.push('Мобильное меню не открывается по клику');
      }
    }
  } else {
    results.warnings.push('Кнопка мобильного меню не видна на 375px');
  }

  // --- FAQ accordion ---
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('#faq').scrollIntoViewIfNeeded();
  const firstFaqBtn = page.locator('#faq .accordion-button').first();
  if (await firstFaqBtn.count()) {
    const expandedBefore = await firstFaqBtn.getAttribute('aria-expanded');
    await firstFaqBtn.click();
    await page.waitForTimeout(400);
    const expandedAfter = await firstFaqBtn.getAttribute('aria-expanded');
    if (expandedBefore !== expandedAfter) {
      results.passed.push('FAQ-аккордеон работает');
    } else {
      results.warnings.push('FAQ-аккордеон: aria-expanded не изменился после клика');
    }
  }

  // --- Swiper prizes carousel ---
  const swiper = page.locator('.prizes-swiper, .swiper').first();
  if (await swiper.count()) {
    const swiperVisible = await swiper.isVisible();
    if (swiperVisible) results.passed.push('Слайдер призов отображается');
    else results.warnings.push('Слайдер призов не виден');
  }

  // --- Anchor links ---
  const brokenAnchors = await page.evaluate(() => {
    const ids = new Set([...document.querySelectorAll('[id]')].map((el) => el.id));
    const issues = [];
    for (const a of document.querySelectorAll('a[href^="#"]')) {
      const href = a.getAttribute('href');
      if (!href || href === '#') continue;
      const id = href.slice(1);
      if (!ids.has(id)) issues.push(href);
    }
    return [...new Set(issues)];
  });
  if (brokenAnchors.length) {
    for (const href of brokenAnchors) {
      results.failed.push(`Якорная ссылка ведёт в никуда: ${href}`);
    }
  } else {
    results.passed.push('Все внутренние якорные ссылки ведут на существующие id');
  }

  // --- Font loading ---
  const fonts = await page.evaluate(() => {
    return [...document.fonts].map((f) => ({ family: f.family, status: f.status }));
  });
  const failedFonts = fonts.filter((f) => f.status === 'error');
  if (failedFonts.length) {
    results.warnings.push(`Шрифты с ошибкой загрузки: ${failedFonts.map((f) => f.family).join(', ')}`);
  } else {
    results.passed.push('Шрифты загружены без ошибок');
  }

  // --- Console & network ---
  if (consoleErrors.length) {
    const unique = [...new Set(consoleErrors)];
    for (const err of unique.slice(0, 5)) {
      results.warnings.push(`Console error: ${err.slice(0, 200)}`);
    }
    if (unique.length > 5) results.warnings.push(`...и ещё ${unique.length - 5} ошибок в консоли`);
  } else {
    results.passed.push('Нет ошибок в консоли браузера');
  }

  const criticalFailed = failedRequests.filter((r) => !r.url.includes('favicon') && !r.url.includes('analytics'));
  if (criticalFailed.length) {
    for (const req of criticalFailed.slice(0, 5)) {
      results.warnings.push(`Не загрузился ресурс: ${req.url} (${req.failure})`);
    }
  }

  // --- Touch targets mobile ---
  await page.setViewportSize({ width: 375, height: 812 });
  const smallTargets = await page.evaluate(() => {
    const min = 44;
    const interactive = [...document.querySelectorAll('a, button, .accordion-button')].filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    return interactive.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width < min || r.height < min;
    }).map((el) => ({
      tag: el.tagName,
      cls: el.className?.toString?.().slice(0, 60) || '',
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
    })).slice(0, 8);
  });
  if (smallTargets.length) {
    results.info.push(`Элементы меньше 44×44px (рекомендация WCAG): ${smallTargets.length} в viewport`);
    for (const t of smallTargets.slice(0, 4)) {
      results.info.push(`  • ${t.tag}.${t.cls}: ${t.w}×${t.h}px`);
    }
  }

  // --- CLS rough check ---
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(URL, { waitUntil: 'load' });
  let shifts = 0;
  await page.evaluate(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.waitForTimeout(3000);
  shifts = await page.evaluate(() => window.__cls || 0);
  if (shifts > 0.1) {
    results.warnings.push(`CLS ≈ ${shifts.toFixed(3)} (рекомендуется < 0.1)`);
  } else {
    results.passed.push(`CLS в норме (≈ ${shifts.toFixed(3)})`);
  }

  await browser.close();
  printReport(results);
  process.exit(results.failed.length > 0 ? 1 : 0);
}

function printReport(results) {
  console.log('\n========================================');
  console.log('  ОТЧЁТ ТЕСТИРОВАНИЯ ВЁРСТКИ');
  console.log(`  ${URL}`);
  console.log('========================================\n');

  if (results.failed.length) {
    console.log('❌ ОШИБКИ (' + results.failed.length + '):');
    results.failed.forEach((m) => console.log('   • ' + m));
    console.log('');
  }
  if (results.warnings.length) {
    console.log('⚠️  ПРЕДУПРЕЖДЕНИЯ (' + results.warnings.length + '):');
    results.warnings.forEach((m) => console.log('   • ' + m));
    console.log('');
  }
  if (results.info.length) {
    console.log('ℹ️  ИНФО (' + results.info.length + '):');
    results.info.forEach((m) => console.log('   • ' + m));
    console.log('');
  }
  console.log('✅ ПРОЙДЕНО (' + results.passed.length + '):');
  results.passed.forEach((m) => console.log('   • ' + m));

  console.log('\n----------------------------------------');
  console.log(`Итого: ${results.passed.length} OK | ${results.warnings.length} предупр. | ${results.failed.length} ошибок`);
  console.log('----------------------------------------\n');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
