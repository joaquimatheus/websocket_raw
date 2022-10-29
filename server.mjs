import { createServer } from "http";
import crypto from "crypto";

const PORT = 1337;
const WEBSOCKET_MAGIC_STRING_KEY = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const SEVEN_BITS_MARKER = 125;
const SIXTEEN_BITS_MARKER = 126;
const SIXTYTEEN_BITS_MARKER = 127;
const FIRST_BIT = 128;

const MAXIMUM_SIXTEENBITS_INTEGER = 2 ** 16
const MASK_KEY_BYTES_LENGTH = 4;
const OPCODE_TEXT = 0x01;

const server = createServer((req, res) => {
    res.writeHead(200);
    res.end("hey there");
}).listen(PORT, () => console.log("server listening to", PORT));

server.on("upgrade", onSocketUpgrade);

function onSocketUpgrade(req, socket, head) {
    const { "sec-websocket-key": socketKey } = req.headers;
    console.log(`${socketKey} connected`);
    const headers = prepareHandshakeHeaders(socketKey);

    socket.write(headers);
    socket.on("readable", () => onSocketReadable(socket));
}

const sendMessage = (msg, socket) => {
    const data = prepareMessage(msg)
    socket.write(data)
}

const prepareMessage = (message) => {
    const msg = Buffer.from(message);
    const messageSize = msg.length;

    let dataFrameBuffer;
    let offset = 2;

    // 0x80 === 128 in binary

    const firstByte = 0x80 | OPCODE_TEXT;

    if(messageSize <= SEVEN_BITS_MARKER) {
        const bytes = [firstByte];
        dataFrameBuffer = Buffer.from(bytes.concat(messageSize));
    }
    else if (messageSize <= MAXIMUM_SIXTEENBITS_INTEGER ) {
        const offsetFourBytes = 4;
        const target = Buffer.allocUnsafe(offsetFourBytes);
        target[0] = firstByte;
        target[1] = SIXTEEN_BITS_MARKER | 0x0

        target.writeUint16BE(messageSize, 2)
        dataFrameBuffer = target;
    }
    else {
        throw new Error('message too long body :(');
    }

    const totalLength = dataFrameBuffer.byteLength + messageSize;
    const dataFrameResponse = concat([ dataFrameBuffer, msg ], totalLength);
    
    return dataFrameResponse;
}

function concat(bufferList, totalLength) {
    const target = Buffer.allocUnsafe(totalLength);
    let offset = 0;
    for(const buffer of bufferList) {
        target.set(buffer, offset);
        offset += buffer.length;
    }

    return target;
}

function onSocketReadable(socket) {
    // consume first bit
    // 1 - 1 byte
    socket.read(1);

    const [markerAndPayloadLength] = socket.read(1);
    // Beccause the first bit is always 1 for client-to-server messages
    // you can subtract one bitr (128 or 10000000)
    // from this byte
    const lengthIndicatorInBits = markerAndPayloadLength - FIRST_BIT;
    let messageLength = 0;

    if (lengthIndicatorInBits <= SEVEN_BITS_MARKER) {
        messageLength = lengthIndicatorInBits;
    } else if(lengthIndicatorInBits === SIXTEEN_BITS_MARKER) {
        messageLength = socket.read(2).readUint16BE(0);
    } 
    else {
        throw new Error(
            `your message is too long! we don't handle 64-bit messages`
        );
    }

    const maskKey = socket.read(MASK_KEY_BYTES_LENGTH);
    const encoded = socket.read(messageLength);
    const decoded = unMask(encoded, maskKey);
    const buffer = decoded.toString("utf8");

    const data = JSON.parse(buffer);
    console.log("message received!", data);

    const msg = JSON.stringify({
        message: data,
        at: new Date().toISOString()
    })
    sendMessage(msg, socket)
}

function unMask(encodedBuffer, maskKey) {
    const finalBuffer = Buffer.from(encodedBuffer);

    const fillWithEightZeros = (t) => t.padStart(8, "0");
    const toBinary = (t) => fillWithEightZeros(t.toString(2));
    const fromBinaryToDecimal = (t) => parseInt(toBinary(t), 2);
    const getCharFromBinary = (t) =>
        String.fromCharCode(parseInt(fromBinaryToDecimal(t)));

    for (let i = 0; i < encodedBuffer.length; i++) {
        finalBuffer[i] = encodedBuffer[i] ^ maskKey[i % 4];

        const logger = {
            unMaskCalc: `${toBinary(encodedBuffer[i])} ^ ${toBinary(
                maskKey[i % MASK_KEY_BYTES_LENGTH]
            )} = ${toBinary(finalBuffer[i])} `,
            decoded: getCharFromBinary(finalBuffer[i]),
        };

        console.log(logger);
    }

    return finalBuffer;
}

function prepareHandshakeHeaders(id) {
    const acceptKey = createSocketAccept(id);
    const headers = [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${acceptKey}`,
        "",
    ]
        .map((line) => line.concat("\r\n"))
        .join("");

    return headers;
}

function createSocketAccept(id) {
    const sha1 = crypto.createHash("sha1");
    sha1.update(id + WEBSOCKET_MAGIC_STRING_KEY);
    return sha1.digest("base64");
}

function fatalHandler(err) {
    console.log(err, { FATA: true });
    process.exit(1);
}

process.on("uncaughtException", fatalHandler);
process.on("unhandleRejection", fatalHandler);
