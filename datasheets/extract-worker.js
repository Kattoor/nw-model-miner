import ffi from 'ffi-napi';
import {promises as fs} from 'fs';
import workerpool from 'workerpool';

const lib = ffi.Library('oo2core_8_win64.dll', {
    'OodleLZ_Decompress': ['void', ['char *', 'int', 'char *', 'int', 'int', 'int', 'int', 'void *', 'void *', 'void *', 'void *', 'void *', 'void *', 'int']]
});

async function extractFromPak(serializedParameters) {
    const {pakFilePath, fileEntries, outPath} = JSON.parse(serializedParameters);
    const fileHandle = await fs.open(pakFilePath, 'r');

    for (let fileEntry of fileEntries) {
        const localHeader = Buffer.alloc(4);
        await fileHandle.read({buffer: localHeader, position: fileEntry.offset + 26});
        const fileNameLength = localHeader.readUInt16LE(0);
        const extraFieldLength = localHeader.readUInt16LE(2);

        const compressedData = Buffer.alloc(fileEntry.compressedSize);
        await fileHandle.read({
            buffer: compressedData,
            position: fileEntry.offset + 30 + fileNameLength + extraFieldLength
        });

        const uncompressedData = Buffer.alloc(fileEntry.uncompressedSize);
        lib.OodleLZ_Decompress(compressedData, fileEntry.compressedSize, uncompressedData, fileEntry.uncompressedSize, 0, 0, 0, null, null, null, null, null, null, 3);

        await saveFile(outPath + fileEntry.fileName, uncompressedData);
    }

    await fileHandle.close()
}

async function saveFile(path, out) {
    const directory = path.slice(0, path.lastIndexOf('/'));
    await fs.mkdir(directory, {recursive: true});
    await fs.writeFile(path, out);
}

workerpool.worker({
    extractFromPak: extractFromPak
});
