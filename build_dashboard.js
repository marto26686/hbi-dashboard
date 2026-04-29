

// Categorías de problemas mobile banking (palabras clave en español AR)
const MOBILE_CATS = {
  'Appdome / Seguridad': [
    'appdome','certificado','control de seguridad','verificacion','verificación',
    'bloqueado por seguridad','no pasa el control','dispositivo no cumple',
    'no cumple los requisitos','root','jailbreak','no me deja por seguridad',
    'proteccion','protección','vpn bloqueada','no pasa la verificacion'
  ],
  'Login / Acceso': [
    'no puedo entrar','no puedo ingresar','no me deja entrar','no me deja ingresar',
    'contraseña incorrecta','clave incorrecta','usuario bloqueado','me bloqueo',
    'bloqueo de cuenta','sesion expirada','sesión expirada','expiró','caduco',
    'caducó','olvide mi clave','olvide la contraseña','cambiar clave',
    'recuperar clave','acceso denegado','no recuerdo','contraseña olvidada',
    'no me reconoce','token incorrecto','pin incorrecto'
  ],
  'Biometría / Huella': [
    'huella','huella dactilar','dactilar','reconocimiento facial','face id',
    'touch id','biometria','biometría','no reconoce mi huella',
    'lector de huella','huella no funciona','no lee la huella',
    'huella no reconoce','biometrico','biométrico'
  ],
  'Performance / Lentitud': [
    'lento','lenta','muy lento','muy lenta','tarda mucho','tarda demasiado',
    'demora mucho','carga lento','lentitud','no carga','tarda siglos',
    'es lentisima','pesima velocidad','pésima velocidad','timeout',
    'se queda cargando','no termina de cargar','tarda en cargar',
    'tarda un monton','tarda una eternidad','tardisimo','tardísimo'
  ],
  'Crashes / Estabilidad': [
    'se cierra','se cae','crash','cierra sola','fuerza el cierre','no abre',
    'error al abrir','se reinicia','deja de funcionar','se cuelga',
    'no responde','pantalla negra','no arranca','no inicia','freezea',
    'se friza','se freza','sale solo','se sale','se cayo','se cayó',
    'se congela','se traba','no carga la app','error al iniciar'
  ],
  'UX / Experiencia': [
    'dificil de usar','difícil de usar','confusa','confuso','complicada',
    'complicado','no encuentro como','no entiendo como','mejorar la interfaz',
    'poco intuitivo','no es intuitivo','mal diseño','fea la app',
    'horrible la interfaz','mejorar el diseño','muy complicada',
    'no se entiende','no es amigable','mala experiencia','mala ux',
    'horrible la navegacion','horrible navegación','mejorar navegacion',
    'no esta claro','no está claro'
  ],
  'Transferencias / Pagos': [
    'transferencia fallida','no puedo transferir','error al transferir',
    'pago rechazado','no puedo pagar','pago fallido','debin','debín',
    'alias incorrecto','alias no encontrado','cbu','cvu',
    'no se acredita','no llega la transferencia','fondos insuficientes',
    'debito fallido','débito fallido','rechazo','rechazan'
  ],
  'Notificaciones / Push': [
    'notificacion','notificación','no recibo notificaciones',
    'no llegan las notificaciones','no me avisa','no me notifica',
    'alerta no llega','push','no recibo alertas','sin notificaciones',
    'no notifica','no avisa'
  ],
  'Actualizacion / Compatibilidad': [
    'actualizacion','actualización','nueva version','nueva versión',
    'despues de actualizar','después de actualizar','desde que actualice',
    'no es compatible','incompatible','android 14','android 13',
    'android 12','no soporta','no funciona con la actualizacion',
    'ultima actualizacion','última actualización'
  ]
};

function computeMobileIssues(reviews) {
  const result = {};
  const total = reviews.length || 1;
  Object.entries(MOBILE_CATS).forEach(([cat, kws]) => {
    const matching = reviews.filter(r => {
      const text = ((r.titulo || '') + ' ' + (r.texto || '')).toLowerCase();
      return kws.some(kw => text.includes(kw));
    });
    const neg = matching.filter(r => r.calificacion <= 2);
    const avgRating = matching.length
      ? Math.round((matching.reduce((s, r) => s + r.calificacion, 0) / matching.length) * 100) / 100
      : 0;
    const worst = [...matching]
      .sort((a, b) => a.calificacion - b.calificacion || new Date(b.fecha || 0) - new Date(a.fecha || 0))
      .slice(0, 10)
      .map(r => ({
        autor: r.autor, calificacion: r.calificacion, fecha: r.fecha,
        titulo: r.titulo, texto: r.texto, version: r.version
      }));
    result[cat] = {
      count:      matching.length,
      pct:        Math.round((matching.length / total) * 1000) / 10,
      avg_rating: avgRating,
      neg_pct:    matching.length ? Math.round((neg.length / matching.length) * 1000) / 10 : 0,
      worst,
    };
  });
  return result;
}

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
  mobile_issues: computeMobileIssues(all),
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
