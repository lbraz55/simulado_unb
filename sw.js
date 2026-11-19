/* =====================================================================
   sw.js — Service worker do Simulado UnB
   Guarda os arquivos do app em cache para funcionar offline.
   As figuras das provas (provas/img) entram no cache à medida que são abertas.
   Ao alterar qualquer arquivo do app, aumente o número de VERSAO.
   ===================================================================== */
const VERSAO = 'simulado-unb-v3';
const ARQUIVOS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './questoes.js',
  './provas/unb-2026.js',
  './provas/unb-2025.js',
  './provas/unb-2024.js',
  './provas/unb-2023.js',
  './provas/unb-2022.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

// Instalação: baixa e guarda todos os arquivos do app
self.addEventListener('install', evento => {
  evento.waitUntil(caches.open(VERSAO).then(cache => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

// Ativação: apaga caches de versões antigas
self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(c => c !== VERSAO).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

// Requisições: tenta a rede primeiro (pega atualizações) e usa o cache se estiver offline
self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  evento.respondWith(
    fetch(req)
      .then(resp => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(VERSAO).then(cache => cache.put(req, copia));
        }
        return resp;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
