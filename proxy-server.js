import corsAnywhere from 'cors-anywhere';

const host = 'localhost';
const port = 3001;
corsAnywhere.createServer({
    originWhitelist: [],
    requireHeader: ['origin', 'x-requested-with'],
    removeHeaders: ['cookie', 'cookie2'],
}).listen(port, host, () => {
    console.log(`Running CORS Anywhere on ${host}:${port}`);
});