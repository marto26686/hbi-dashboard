/**
 * Scraper de resenas -- Google Play Store + Apple App Store
 * Bancos Provinciales Argentinos
 *
 * Uso:
 *   node scraper_bancos.js           -> Android + iOS
 *   node scraper_bancos.js --android -> solo Google Play
 *   node scraper_bancos.js --ios     -> solo App Store
 */

const gplay = require('google-play-scraper');

if (typeof gplay.reviews !== 'function') {
  console.error('Error: google-play-scraper no esta bien instalado. Corre: npm install google-play-scraper@8');
  process.exit(1);
}

const fs   = require('fs');
const path = require('path');

const BANCOS = [
  { nombre: 'Banco Santa Fe',   androidAppId: 'com.bancosantafe.mobile',   iosTerm: 'Banco Santa Fe'   },
  { nombre: 'Banco Entre Rios', androidAppId: 'com.bancoentrerios.mobile',  iosTerm: 'Banco Entre Rios' },
  { nombre: 'Banco Santa Cruz', androidAppId: 'com.bancosantacruz.mobile',  iosTerm: 'Banco Santa Cruz' },
  { nombre: 'Banco San Juan',   androidAppId: 'com.bancosanjuan.mobile',    iosTerm: 'Banco San Juan'   },
];

const CONFIG = {
  lang:       'es',
  country:    'ar',
  maxReviews: 5000,
  pauseMs:    1500,
  outputDir:  './reviews',
};

const SORT_NEWEST = gplay.sort && gplay.sort.NEWEST ? gplay.sort.NEWEST : 2;

const args         = process.argv.slice(2);
const hacerAndroid = !args.includes('--ios');
const hacerIos     = !args.includes('--android');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-AR');
  console.log('[' + ts + '] ' + msg);
}

function guardar(rutaArchivo, datos) {
  fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });
  fs.writeFileSync(rutaArchivo, JSON.stringify(datos, null, 2), 'utf-8');
}

function nombreArchivo(banco) {
  return banco.nombre
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[ieoua]/g, c => c);
}

function calcResumen(reviews) {
  if (!reviews.length) return { total: 0, promedio: '0.00' };
  const prom = reviews.reduce((s, r) => s + r.calificacion, 0) / reviews.length;
  return { total: reviews.length, promedio: prom.toFixed(2) };
}

function fmtAndroid(r) {
  return {
    plataforma:      'android',
    id:              r.id,
    autor:           r.userName   || 'Anonimo',
    calificacion:    r.score      || 0,
    fecha:           r.date instanceof Date ? r.date.toISOString() : (r.date || null),
    titulo:          r.title      || null,
    texto:           r.text       || '',
    util:            r.thumbsUp   || 0,
    version:         r.version    || null,
    respuesta_banco: r.replyText  || null,
    fecha_respuesta: r.repliedAt instanceof Date ? r.repliedAt.toISOString() : (r.repliedAt || null),
  };
}

async function scrapearAndroid(banco) {
  log('[Android] ' + banco.nombre + ' -- ' + banco.androidAppId);

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

      const batch = Array.isArray(res) ? res : (res.data || []);
      token       = Array.isArray(res) ? null : (res.nextPaginationToken || null);

      if (!batch.length) { log('Sin mas paginas'); break; }
      batch.forEach(r => reviews.push(fmtAndroid(r)));
      log(reviews.length + ' resenas acumuladas');
      if (!token) break;
      await sleep(400);
    } catch (err) {
      log('Error Android: ' + err.message);
      break;
    }
  }

  log('Android -- ' + banco.nombre + ': ' + reviews.length + ' resenas');
  return reviews;
}

async function scrapearIos(banco) {
  // Carga lazy para no fallar si no esta instalado
  let store;
  try { store = require('app-store-scraper'); }
  catch (e) { log('app-store-scraper no instalado. Saltando iOS para ' + banco.nombre); return []; }

  log('[iOS] ' + banco.nombre);

  let appId = null;
  try {
    const resultados = await store.search({ term: banco.iosTerm, country: CONFIG.country, num: 5 });
    if (resultados.length) {
      appId = resultados[0].id;
      log('App ID: ' + appId);
    }
  } catch (err) { log('Error buscando en App Store: ' + err.message); }

  if (!appId) { log('No se encontro App ID. Saltando'); return []; }

  const reviews = [];
  for (let pag = 1; pag <= 10; pag++) {
    try {
      const batch = await store.reviews({ id: appId, country: CONFIG.country, sort: store.sort.RECENT, page: pag });
      if (!batch || !batch.length) break;
      batch.forEach(r => reviews.push({
        plataforma: 'ios', id: r.id, autor: r.userName || 'Anonimo',
        calificacion: r.score || 0, fecha: r.updated || null,
        titulo: r.title || null, texto: r.text || '', util: 0,
        version: r.version || null, respuesta_banco: null, fecha_respuesta: null,
      }));
      log('Pagina ' + pag + ' -> ' + reviews.length + ' resenas');
      await sleep(400);
    } catch (err) { log('Error pagina ' + pag + ': ' + err.message); break; }
  }
  return reviews;
}

async function main() {
  console.log('=== Scraper Resenas Bancos AR ===');
  const combinado = {};
  const resumen   = [];

  for (const banco of BANCOS) {
    combinado[banco.nombre] = { android: [], ios: [] };

    if (hacerAndroid) {
      const revs = await scrapearAndroid(banco);
      combinado[banco.nombre].android = revs;
      const nombre = banco.nombre.toLowerCase().replace(/\s+/g, '_');
      guardar(path.join(CONFIG.outputDir, 'android', 'reviews_' + nombre + '.json'),
        { banco: banco.nombre, plataforma: 'android', appId: banco.androidAppId,
          extraido: new Date().toISOString(), ...calcResumen(revs), reviews: revs });
    }

    if (hacerIos) {
      await sleep(CONFIG.pauseMs);
      const revs = await scrapearIos(banco);
      combinado[banco.nombre].ios = revs;
      const nombre = banco.nombre.toLowerCase().replace(/\s+/g, '_');
      guardar(path.join(CONFIG.outputDir, 'ios', 'reviews_' + nombre + '.json'),
        { banco: banco.nombre, plataforma: 'ios',
          extraido: new Date().toISOString(), ...calcResumen(revs), reviews: revs });
    }

    const tot = [...combinado[banco.nombre].android, ...combinado[banco.nombre].ios];
    resumen.push({ banco: banco.nombre, android: combinado[banco.nombre].android.length,
                   ios: combinado[banco.nombre].ios.length, total: tot.length });

    if (banco !== BANCOS[BANCOS.length - 1]) await sleep(CONFIG.pauseMs);
  }

  guardar(path.join(CONFIG.outputDir, 'reviews_todos_los_bancos.json'), combinado);
  console.table(resumen);
  console.log('Listo.');
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });
