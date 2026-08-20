import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';

const browser = await chromium.launch({
  executablePath:
    process.env.PW_EXECUTABLE ??
    'C:/Users/eyapu/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe',
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

async function incQty(n) {
  for (let i = 0; i < n; i++) {
    await page.click('button[aria-label="Aumentar cantidad"]');
  }
}

await page.goto(BASE, { waitUntil: 'networkidle' });

// --- FASE 1: producto con unidad nueva ---
await page.click('nav a:has-text("Productos")');
await page.click('button:has-text("Nuevo producto")');
await page.waitForSelector('input#p-name', { timeout: 5000 });
await page.fill('input#p-name', 'Arroz 1 kg');
await page.click('input#p-unit');
await page.fill('input#p-unit', 'bidon');
const createUnit = page.locator('button:has-text("Crear nuevo")').first();
await createUnit.waitFor({ timeout: 3000 });
await createUnit.click();
await page.click('button:has-text("Guardar")');
await page.waitForSelector('li:has-text("Arroz 1 kg") >> text=bido', { timeout: 5000 });
console.log('CREATE_PRODUCT_OK');

// --- FASE 2: entrada 10 ---
await page.click('nav a:has-text("Inicio")');
await page.click('a[href="/movimiento?tipo=entrada"]');
await page.waitForSelector('input#m-product', { timeout: 5000 });
await page.fill('input#m-product', 'arroz');
await page.locator('li:has-text("Arroz 1 kg") >> button').first().click();
await incQty(9);
await page.click('button:has-text("Registrar entrada")');
await page.waitForSelector('text=Entrada registrada', { timeout: 5000 });
console.log('ENTRADA_OK');

// --- salida 4 → stock 6 ---
await page.goto(BASE + '/movimiento?tipo=salida');
await page.waitForSelector('input#m-product', { timeout: 5000 });
await page.fill('input#m-product', 'arroz');
await page.locator('li:has-text("Arroz 1 kg") >> button').first().click();
await incQty(3);
await page.click('button:has-text("Registrar salida")');
await page.waitForSelector('text=Salida registrada', { timeout: 5000 });

// --- salida 6 → stock 0 (permitido) ---
await page.click('input#m-product');
await page.fill('input#m-product', 'arroz');
await page.locator('li:has-text("Arroz 1 kg") >> button').first().click();
await incQty(5);
await page.click('button:has-text("Registrar salida")');
await page.waitForSelector('text=Salida registrada', { timeout: 5000 });

// --- salida 1 → bloqueado por stock negativo ---
await page.click('input#m-product');
await page.fill('input#m-product', 'arroz');
await page.locator('li:has-text("Arroz 1 kg") >> button').first().click();
await page.click('button:has-text("Registrar salida")');
await page.waitForSelector('text=Stock insuficiente', { timeout: 5000 });
console.log('NEGATIVE_BLOCK_OK');

// --- verificar stock en lista = 0 ---
await page.click('nav a:has-text("Productos")');
await page.waitForSelector('li:has-text("Arroz 1 kg")', { timeout: 5000 });
const stock = await page.locator('li:has-text("Arroz 1 kg") >> span.text-numeric-lg').textContent();
if (!stock.trim().startsWith('0')) throw new Error('stock esperado 0, got ' + stock);
console.log('STOCK_0_OK');

// --- dashboard KPIs (1er valor = entradas hoy = 10) ---
await page.click('nav a:has-text("Inicio")');
await page.waitForSelector('section.bg-card >> p.text-numeric-lg', { timeout: 5000 });
await page.waitForFunction(
  () => {
    const el = document.querySelector('section.bg-card p.text-numeric-lg');
    return el && el.textContent !== '…';
  },
  { timeout: 5000 },
);
const entradaKpi = await page.locator('section.bg-card >> p.text-numeric-lg').first().textContent();
if (!entradaKpi.trim().startsWith('10')) throw new Error('KPI entradas esperado 10, got ' + entradaKpi);
console.log('DASHBOARD_KPIS_OK');

// --- historial ---
await page.click('nav a:has-text("Más")');
await page.click('a:has-text("Movimientos")');
await page.waitForSelector('nav a:has-text("Más")', { timeout: 5000 });
await page.waitForSelector('h1:has-text("Movimientos")', { timeout: 5000 });
await page.waitForSelector('text=Arroz 1 kg', { timeout: 5000 });
const movCount = await page.locator('main ul li').count();
if (movCount < 3) throw new Error('se esperaban >=3 movimientos, got ' + movCount);
console.log('HISTORIAL_OK');

// --- FASE 3: kits ---
// reponer stock del componente para poder ensamblar
await page.goto(BASE + '/movimiento?tipo=entrada');
await page.waitForSelector('input#m-product', { timeout: 5000 });
await page.fill('input#m-product', 'arroz');
await page.locator('li:has-text("Arroz 1 kg") >> button').first().click();
await incQty(4);
await page.click('button:has-text("Registrar entrada")');
await page.waitForSelector('text=Entrada registrada', { timeout: 5000 });

// crear kit con 1 componente
await page.click('nav a:has-text("Kits")');
await page.waitForSelector('button:has-text("Nuevo kit")', { timeout: 5000 });
await page.click('button:has-text("Nuevo kit")');
await page.waitForSelector('input#k-name', { timeout: 5000 });
await page.fill('input#k-name', 'Caja navideña');
await page.click('input#k-unit');
await page.fill('input#k-unit', 'caja');
await page.locator('li:has-text("Caja") >> button').first().click();
await page.fill('input#k-add-product', 'arroz');
await page.locator('li:has-text("Arroz 1 kg") >> button').first().click();
await page.waitForSelector('li:has-text("Arroz 1 kg") >> text=1', { timeout: 3000 });
await page.click('button:has-text("Guardar")');
await page.waitForSelector('text=Caja navideña', { timeout: 5000 });
console.log('KIT_CREATE_OK');

// ensamblar 2 kits (consume 2 arroz)
await page.locator('li:has-text("Caja navideña") >> button:has-text("Ensamblar")').click();
await page.waitForSelector('text=¿Cuántos kits', { timeout: 3000 });
await incQty(1);
await page.click('div[role="dialog"] >> button:has-text("Ensamblar")');
await page.waitForSelector('text=Kit ensamblado', { timeout: 5000 });
await page.waitForFunction(() => {
  const row = [...document.querySelectorAll('li')].find((li) => li.textContent.includes('Caja navideña'));
  const el = row?.querySelector('span.text-numeric-lg');
  return el?.textContent.trim().startsWith('2');
}, { timeout: 5000 });
console.log('KIT_BUILD_OK');

// entregar 1 kit → stock 1
await page.locator('li:has-text("Caja navideña") >> button:has-text("Entregar")').click();
await page.waitForSelector('text=¿Cuántos kits', { timeout: 3000 });
await page.click('div[role="dialog"] >> button:has-text("Entregar")');
await page.waitForSelector('text=Entrega registrada', { timeout: 5000 });
await page.waitForFunction(() => {
  const row = [...document.querySelectorAll('li')].find((li) => li.textContent.includes('Caja navideña'));
  const el = row?.querySelector('span.text-numeric-lg');
  return el?.textContent.trim().startsWith('1');
}, { timeout: 5000 });
console.log('KIT_DELIVER_OK');

// detalle: histórico con 2 eventos y componentes
await page.click('a:has-text("Caja navideña")');
await page.waitForSelector('text=Historial', { timeout: 5000 });
await page.waitForSelector('text=Ensamble', { timeout: 3000 });
await page.waitForSelector('text=Entrega', { timeout: 3000 });
await page.waitForSelector('li:has-text("Arroz 1 kg")', { timeout: 3000 });
console.log('KIT_DETAIL_OK');

if (errors.length > 0) {
  console.log('CONSOLE_ERRORS', JSON.stringify(errors));
  process.exitCode = 1;
} else {
  console.log('NO_CONSOLE_ERRORS');
}

await browser.close();
console.log('SMOKE_PASS');