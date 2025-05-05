import http from 'http';
import {API_URL_ORIGIN, BASE_HOST_ORIGIN, WS_URL_ORIGIN} from './test/vars.js';
import httpProxy from "http-proxy";

const proxyWS = httpProxy.createProxyServer({
    target: WS_URL_ORIGIN,
    changeOrigin: true,
    ws: true,
    headers: {origin: WS_URL_ORIGIN}
});

const proxyServerWS = http.createServer((req, res) => {
    proxyWS.web(req, res);
});

proxyWS.on('error', (err) => {
    console.error('Proxy error:', err);
});

proxyServerWS.on('upgrade', (req, socket, head) => {
    proxyWS.ws(req, socket, head);
});

proxyServerWS.listen(8014, () => {
    console.log('WS proxy started at port 8014');
});

const proxyHttp = httpProxy.createProxyServer({
    target: API_URL_ORIGIN,
    changeOrigin: true,
});

const proxyServerHTTP = http.createServer((req, res) => {
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

proxyServerHTTP.listen(3001, () => {
    console.log('CORS proxy started at port 3001');
});

const proxyHttp1 = httpProxy.createProxyServer({
    target: `https://${BASE_HOST_ORIGIN}`,
    changeOrigin: true,
});

const proxyServerHTTP1 = http.createServer((req, res) => {
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

    proxyHttp1.web(req, res);
});

proxyServerHTTP1.listen(3002, () => {
    console.log('CORS proxy started at port 3002');
});

