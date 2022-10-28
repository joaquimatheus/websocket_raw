import { createServer } from 'http';
import crypto from 'crypto';

const PORT = 1337
const WEBSOCKET_MAGIC_STRING_KEY = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

const SEVEN_BITS_MARKER = 125
const SIXTEEN_BITS_MARKER = 126
const SIXTYTEEN_BITS_MARKER = 127

const server = createServer((req, res) => {
    res.writeHead(200)
    res.end('hey there')
})
.listen(PORT, () => console.log('server listening to', PORT))

server.on('upgrade', onSocketUpgrade )

function onSocketUpgrade(req, socket, head) {
    const { 'sec-websocket-key': socketKey } = req.headers;
    console.log(`${socketKey} connected`);
    const headers = prepareHandshakeHeaders(socketKey);

    socket.write(headers);
    socket.on('readable', () => onSocketUpgrade(socket))
}

function onSocketReadable(socket) {
    // consume first bit
    // 1 - 1 byte
    socket.read(1);

    socket.read(1)
}

function prepareHandshakeHeaders(id) {
    const acceptKey = createSocketAccept(id)
    const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        ''
    ].map(line => line.concat('\r\n')).join('');

    return headers;
}

function createSocketAccept(id) {
    const sha1 = crypto.createHash('sha1')
    sha1.update(id + WEBSOCKET_MAGIC_STRING_KEY)
    return sha1.digest('base64')
}

function fatalHandler(err) {
    console.log(err, { FATA: true });
    process.exit(1);
}

process.on('uncaughtException', fatalHandler);
process.on('unhandleRejection', fatalHandler);
