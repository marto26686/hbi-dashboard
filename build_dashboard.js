
const fs   = require('fs');
const path = require('path');

const BANCOS = [
  { nombre: 'Banco Santa Fe',   file: 'banco_santa_fe'   },
  { nombre: 'Banco Entre Ríos', file: 'banco_entre_rios'  },
  { nombre: 'Banco Santa Cruz', file: 'banco_santa_cruz'  },
  { nombre: 'Banco San Juan',   file: 'banco_san_juan'    },
];

// Palabras clave por tema
const TOPICS_KW = {
  'App / Digital':        ['app', 'aplicacion', 'aplicación', 'digital', 'movil', 'móvil',
                           'pantalla', 'actuali', 'version', 'versión', 'instalar', 'descarg', 'interfaz'],
  'Atención al Cliente':  ['atencion', 'atención', 'cliente', 'empleado', 'personal',
                           'trato', 'amable', 'asesor', 'representante', 'sucursal'],
  'Turnos / Espera':      ['turno', 'espera', 'cola', 'fila', 'lento', 'demora',
                           'tardanza', 'minuto', 'hora', 'tardó', 'tarda'],
  'Cajero / ATM':         ['cajero', 'atm', 'efectivo', 'billete', 'plata en'],
  'Transferencias/Pagos': ['transferencia', 'pago', 'débito', 'debito', 'crédito', 'credito',
                           'transaccion', 'transacción', 'debin', 'alias', 'cvu', 'cbu'],
  'Errores / Fallas':     ['error', 'falla', 'bug', 'problema', 'no funciona', 'caída',
                           'caida', 'fallo', 'crash', 'cuelga', 'cierra', 'no carga', 'no abre'],
};

function classifyTopics(reviews) {
  const counts = {};
  Object.keys(TOPICS_KW).forEach(t => (counts[t] = 0));
  reviews.forEach(r => {
    const text = ((r.titulo || '') + ' ' + (r.texto || '')).toLowerCase();
    Object.entries(TOPICS_KW).forEach(([topic, kws]) => {
      if (kws.some(kw => text.includes(kw))) counts[topic]++;
    });
  });
  const total = reviews.length || 1;
  const result = {};
  Object.entries(counts).forEach(([t, c]) => {
    result[t] = Math.round((c / total) * 1000) / 10;
  });
  return result;
}

function monthlyAvg(reviews) {
  const byMonth = {};
  reviews.forEach(r => {
    if (!r.fecha) return;
    const m = r.fecha.substring(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(r.calificacion);
  });
  const result = {};
  Object.keys(byMonth).sort().forEach(m => {
    const arr = byMonth[m];
    result[m] = Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100;
  });
  return result;
}

function calcDist(reviews) {
  const d = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  reviews.forEach(r => {
    const k = String(r.calificacion);
    d[k] = (d[k] || 0) + 1;
  });
  return d;
}

function calcAvg(reviews) {
  if (!reviews.length) return 0;
  return Math.round((reviews.reduce((s, r) => s + r.calificacion, 0) / reviews.length) * 100) / 100;
}

function loadReviews(platform, filename) {
  const fp = path.join('reviews', platform, `reviews_${filename}.json`);
  if (!fs.existsSync(fp)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    return Array.isArray(data.reviews) ? data.reviews : [];
  } catch { return []; }
}

function processBank(androidRevs, iosRevs) {
  const all   = [...androidRevs, ...iosRevs];
  const total = all.length;
  const avg   = calcAvg(all);
  const dist  = calcDist(all);
  const neg   = all.filter(r => r.calificacion <= 2).length;
  const neg_pct = total ? Math.round((neg / total) * 1000) / 10 : 0;

  // Las 300 más recientes para la pestaña de reseñas
  const sorted = [...all].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

  return {
    total,
    avg,
    dist,
    neg_pct,
    topics:  classifyTopics(all),
    monthly: monthlyAvg(all),
    android: { total: androidRevs.length, avg: calcAvg(androidRevs), dist: calcDist(androidRevs) },
    ios:     { total: iosRevs.length,     avg: calcAvg(iosRevs),     dist: calcDist(iosRevs)     },
    reviews: sorted.slice(0, 300),
  };
}

function main() {
  const DATA = {};

  for (const banco of BANCOS) {
    const android = loadReviews('android', banco.file);
    const ios     = loadReviews('ios',     banco.file);
    DATA[banco.nombre] = processBank(android, ios);
    const total = android.length + ios.length;
    console.log(`✅ ${banco.nombre}: ${android.length} Android + ${ios.length} iOS = ${total} reseñas`);
  }

  // Leer index.html
  let html = fs.readFileSync('index.html', 'utf-8');

  // Reemplazar const DATA = {...};  (está en una sola línea)
  const dataStart = html.indexOf('\nconst DATA = ');
  if (dataStart === -1) {
    console.error('❌ No se encontró "const DATA = " en index.html');
    process.exit(1);
  }
  const lineEnd = html.indexOf('\n', dataStart + 1);
  const newLine = `\nconst DATA = ${JSON.stringify(DATA)};`;
  html = html.substring(0, dataStart) + newLine + html.substring(lineEnd);

  // Actualizar fecha en el footer
  const now     = new Date();
  const meses   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const fechaStr = `${meses[now.getMonth()]} ${now.getFullYear()}`;
  html = html.replace(/Google Play · App Store · [A-Za-záéíóúÁÉÍÓÚ]+ \d{4}/,
                      `Google Play · App Store · ${fechaStr}`);

  fs.writeFileSync('index.html', html, 'utf-8');
  console.log(`\n🎉 index.html actualizado — ${now.toISOString()}`);
}

main();
