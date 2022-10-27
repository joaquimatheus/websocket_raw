import { createServer } from 'http'
const PORT = 1337

createServer((req, res) => {
    res.writeHead(200)
    res.end('hey there')
})
.listen(PORT, () => console.log('server listening to', PORT))


function fatalHandler(err) {
    console.log(err, { FATA: true });
    process.exit(1);
}

process.on('uncaughtException', fatalHandler);
process.on('unhandleRejection', fatalHandler);
