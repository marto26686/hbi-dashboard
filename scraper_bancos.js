/**
 * Scraper de reseñas — Google Play Store + Apple App Store
 * Bancos Provinciales Argentinos
 *
 * Instalación:
 *   npm install google-play-scraper@8 app-store-scraper
 *
 * Uso:
 *   node scraper_bancos.js              → Android + iOS
 *   node scraper_bancos.js --android    → solo Google Play
 *   node scraper_bancos.js --ios        → solo App Store
 */

// google-play-scraper@8 usa CommonJS — asegurate de instalar con: npm install google-play-scraper@8
const gplay = require('google-play-scraper');
const store = require('app-store-scraper');

// Verificar que la librería está correctamente instalada
if (typeof gplay.reviews !== 'function') {
  console.error('\n❌ Error de versión: google-play-scraper no está bien instalado.');
  console.error('   Corré: npm install google-play-scraper@8\n');
  process.exit(1);
}
const fs    = require('fs');
const path  = require('path');

// ── Configuración ─────────────────────────────────────────────────────────
const BANCOS = [
  {
    nombre:       'Banco Santa Fe',
    androidAppId: 'com.bancosantafe.mobile',
    iosTerm:      'Banco Santa Fe',       // término de búsqueda en App Store
  },
  {
    nombre:       'Banco Entre Ríos',
    androidAppId: 'com.bancoentrerios.mobile',
    iosTerm:      'Banco Entre Rios',
  },
  {
    nombre:       'Banco Santa Cruz',
    androidAppId: 'com.bancosantacruz.mobile',
    iosTerm:      'Banco Santa Cruz',
  },
  {
    nombre:       'Banco San Juan',
    androidAppId: 'com.bancosanjuan.mobile',
    iosTerm:      'Banco San Juan',
  },
];

const CONFIG = {
  lang:       'es',
  country:    'ar',
  maxReviews: 5000,
  pauseMs:    1500,
  outputDir:  './reviews',
};

// Constantes de sort — v8 las expone en gplay.sort, fallback a numérico
//   1 = HELPFULNESS | 2 = NEWEST | 3 = RATING
const SORT_NEWEST = gplay.sort?.NEWEST ?? 2;

// ── Args ──────────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const hacerAndroid = !args.includes('--ios');
const hacerIos     = !args.includes('--android');

// ── Helpers ───────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-AR');
  console.log(`[${ts}] ${msg}`);
}

function guardar(rutaArchivo, datos) {
  fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });
  fs.writeFileSync(rutaArchivo, JSON.stringify(datos, null, 2), 'utf-8');
}

function nombreArchivo(banco) {
  return banco.nombre
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[íéóúü]/g, c => ({ í:'i', é:'e', ó:'o', ú:'u', ü:'u' })[c] || c);
}

function calcResumen(reviews) {
  if (!reviews.length) return { total: 0, promedio: '0.00' };
  const prom = reviews.reduce((s, r) => s + r.calificacion, 0) / reviews.length;
  return { total: reviews.length, promedio: prom.toFixed(2) };
}

// ── Formateadores ─────────────────────────────────────────────────────────
function fmtAndroid(r) {
  return {
    plataforma:      'android',
    id:              r.id,
    autor:           r.userName   ?? 'Anónimo',
    calificacion:    r.score      ?? 0,
    fecha:           r.date instanceof Date ? r.date.toISOString() : (r.date ?? null),
    titulo:          r.title      ?? null,
    texto:           r.text       ?? '',
    util:            r.thumbsUp   ?? 0,
    version:         r.version    ?? null,
    respuesta_banco: r.replyText  ?? null,
    fecha_respuesta: r.repliedAt instanceof Date ? r.repliedAt.toISOString() : (r.repliedAt ?? null),
  };
}

function fmtIos(r) {
  return {
    plataforma:      'ios',
    id:              r.id,
    autor:           r.userName   ?? 'Anónimo',
    calificacion:    r.score      ?? 0,
    fecha:           r.updated    ?? null,
    titulo:          r.title      ?? null,
    texto:           r.text       ?? '',
    util:            r.thumbsUp   ?? 0,
    version:         r.version    ?? null,
    respuesta_banco: null,
    fecha_respuesta: null,
  };
}

// ── Scraping Android ──────────────────────────────────────────────────────
async function scrapearAndroid(banco) {
  log(`🤖 [Android] ${banco.nombre} — ${banco.androidAppId}`);

  const reviews = [];
  let token     = undefined;

  while (reviews.length < CONFIG.maxReviews) {
    try {
      const res = await gplay.reviews({
        appId:               banco.androidAppId,
        lang:                CONFIG.lang,
        country:             CONFIG.country,
        sort:                SORT_NEWEST,
        num:                 150,
        paginate:            true,
        nextPaginationToken: token,
      });

      // La API puede devolver { data, nextPaginationToken } o el array directo
      const batch = Array.isArray(res) ? res : (res.data ?? []);
      token       = Array.isArray(res) ? null : (res.nextPaginationToken ?? null);

      if (!batch.length) { log('  ✓ Sin más páginas'); break; }

      batch.forEach(r => reviews.push(fmtAndroid(r)));
      log(`  📄 ${reviews.length} reseñas acumuladas`);
      if (!token) break;
      await sleep(400);

    } catch (err) {
      log(`  ⚠️  Error Android: ${err.message}`);
      break;
    }
  }

  log(`  ✅ Android — ${banco.nombre}: ${reviews.length} reseñas\n`);
  return reviews;
}

// ── Buscar App ID en App Store ────────────────────────────────────────────
async function buscarAppIdIos(banco) {
  log(`  🔍 Buscando en App Store AR: "${banco.iosTerm}"...`);
  try {
    const resultados = await store.search({
      term:    banco.iosTerm,
      country: CONFIG.country,
      lang:    CONFIG.lang,
      num:     5,
    });

    if (!resultados.length) {
      log(`  ⚠️  Sin resultados para "${banco.iosTerm}"`);
      return null;
    }

    // Mostrar las opciones encontradas
    log(`  📋 Resultados encontrados:`);
    resultados.slice(0, 3).forEach((app, i) => {
      log(`     ${i + 1}. [ID: ${app.id}] ${app.title} — ${app.developer}`);
    });

    // Intentar elegir el más relevante (que contenga el nombre del banco)
    const palabrasClave = banco.nombre.toLowerCase().split(' ').filter(p => p.length > 3);
    const mejor = resultados.find(app =>
      palabrasClave.some(p => app.title.toLowerCase().includes(p))
    ) ?? resultados[0];

    log(`  ✓ Seleccionado: [ID: ${mejor.id}] "${mejor.title}"`);
    return mejor.id;

  } catch (err) {
    log(`  ⚠️  Error buscando en App Store: ${err.message}`);
    return null;
  }
}

// ── Scraping iOS ──────────────────────────────────────────────────────────
async function scrapearIos(banco) {
  log(`🍎 [iOS] ${banco.nombre}`);

  // 1. Encontrar el App ID real
  const appId = await buscarAppIdIos(banco);
  if (!appId) {
    log(`  ❌ No se pudo encontrar el App ID. Saltando ${banco.nombre}\n`);
    return [];
  }

  // 2. Verificar info de la app
  try {
    const info = await store.app({ id: appId, country: CONFIG.country });
    log(`  📱 "${info.title}" · ⭐ ${info.score?.toFixed(2) ?? 'N/A'} · ${info.reviews ?? '?'} reseñas totales`);
  } catch (_) { /* continuar igual */ }

  // 3. Scrapear reseñas (App Store limita a ~500 reseñas, 10 páginas de 50)
  const reviews  = [];
  const maxPags  = Math.min(10, Math.ceil(CONFIG.maxReviews / 50));

  for (let pag = 1; pag <= maxPags; pag++) {
    try {
      const batch = await store.reviews({
        id:      appId,
        country: CONFIG.country,
        sort:    store.sort.RECENT,
        page:    pag,
      });

      if (!batch?.length) { log(`  ✓ Sin más páginas (pág ${pag})`); break; }

      batch.forEach(r => reviews.push(fmtIos(r)));
      log(`  📄 Página ${pag} → ${reviews.length} reseñas acumuladas`);
      if (reviews.length >= CONFIG.maxReviews) break;
      await sleep(400);

    } catch (err) {
      log(`  ⚠️  Error en página ${pag}: ${err.message}`);
      break;
    }
  }

  log(`  ✅ iOS — ${banco.nombre}: ${reviews.length} reseñas\n`);
  return reviews;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const plats = [hacerAndroid && 'Android', hacerIos && 'iOS'].filter(Boolean).join(' + ');
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Scraper Reseñas — Bancos AR · ${plats}`);
  console.log('═══════════════════════════════════════════════════\n');

  const combinado = {};
  const resumen   = [];

  for (const banco of BANCOS) {
    combinado[banco.nombre] = { android: [], ios: [] };

    if (hacerAndroid) {
      const revs = await scrapearAndroid(banco);
      combinado[banco.nombre].android = revs;
      guardar(
        path.join(CONFIG.outputDir, 'android', `reviews_${nombreArchivo(banco)}.json`),
        { banco: banco.nombre, plataforma: 'android', appId: banco.androidAppId,
          extraido: new Date().toISOString(), ...calcResumen(revs), reviews: revs }
      );
    }

    if (hacerIos) {
      await sleep(CONFIG.pauseMs);
      const revs = await scrapearIos(banco);
      combinado[banco.nombre].ios = revs;
      guardar(
        path.join(CONFIG.outputDir, 'ios', `reviews_${nombreArchivo(banco)}.json`),
        { banco: banco.nombre, plataforma: 'ios',
          extraido: new Date().toISOString(), ...calcResumen(revs), reviews: revs }
      );
    }

    const tot = [...combinado[banco.nombre].android, ...combinado[banco.nombre].ios];
    resumen.push({
      banco:          banco.nombre,
      android:        combinado[banco.nombre].android.length,
      ios:            combinado[banco.nombre].ios.length,
      total:          tot.length,
      'promedio ⭐': calcResumen(tot).promedio,
    });

    if (banco !== BANCOS[BANCOS.length - 1]) {
      log(`⏸  Pausando ${CONFIG.pauseMs}ms...\n`);
      await sleep(CONFIG.pauseMs);
    }
  }

  // Archivo combinado final
  const rutaCombinado = path.join(CONFIG.outputDir, 'reviews_todos_los_bancos.json');
  guardar(rutaCombinado, combinado);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Resumen final');
  console.log('═══════════════════════════════════════════════════');
  console.table(resumen);
  console.log(`\n📦 Combinado: ${rutaCombinado}`);
  console.log('✅ Listo. Subí reviews_todos_los_bancos.json al dashboard.\n');
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
