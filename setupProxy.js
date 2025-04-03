import http from 'http';
import {API_URL_ORIGIN, WS_URL_ORIGIN} from './test/vars.js';
import httpProxy from "http-proxy";

const proxy = httpProxy.createProxyServer({
    target: WS_URL_ORIGIN,
    changeOrigin: true,
    ws: true,
    headers: {origin: WS_URL_ORIGIN}
});

const proxyServer = http.createServer((req, res) => {
    proxy.web(req, res);
});

proxy.on('error', (err) => {
    console.error('Proxy error:', err);
});

proxyServer.on('upgrade', (req, socket, head) => {
    proxy.ws(req, socket, head);
});

proxyServer.listen(8014, () => {
    console.log('WS proxy started at port 8014');
});

const proxyHttp = httpProxy.createProxyServer({
    target: API_URL_ORIGIN,
    changeOrigin: true,
});

const server = http.createServer((req, res) => {
    // Устанавливаем CORS‑заголовки в ответ
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'origin, x-requested-with, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    // Обрабатываем preflight-запросы
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    delete req.headers['cookie'];
    delete req.headers['cookie2'];

    proxyHttp.web(req, res);
});

server.listen(3001, () => {
    console.log('CORS proxy started at port 3001');
});
