
import http from 'http';

const PORT = 9999;

const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        console.log('\n[+] EXFILTRATION RECEIVED:');
        console.log('---------------------------------------------------');
        console.log(body);
        console.log('---------------------------------------------------');
        res.writeHead(200);
        res.end('Received');
    });
});

server.listen(PORT, () => {
    console.log(`[*] Malicious Listener started on port ${PORT}`);
});
