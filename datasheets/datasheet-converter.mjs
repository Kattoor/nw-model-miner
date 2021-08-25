import {promises as fs} from 'fs';
import {globby} from 'globby';

const amountOfColumnsOffset = 0x44;
const amountOfRowsOffset = 0x48;
const headersOffset = 0x5c;
const amountOfBytesInHeader = 12;
const amountOfBytesInCell = 8;

export async function convertDatasheets(path) {
    const start = Date.now();

    const filePaths = await globby(path + '**/*.datasheet');

    process.stdout.write('Converting datasheets..\r');

    for (let filePath of filePaths) {
        const data = await fs.readFile(filePath);

        const amountOfColumns = data.readInt32LE(amountOfColumnsOffset);
        const amountOfRows = data.readInt32LE(amountOfRowsOffset);

        const cellsOffset = headersOffset + amountOfColumns * amountOfBytesInHeader;
        const amountOfBytesInRow = amountOfBytesInCell * amountOfColumns;
        const stringsOffset = cellsOffset + amountOfRows * amountOfColumns * amountOfBytesInCell;

        const headers = [];
        for (let i = 0; i < amountOfColumns; i++) {
            const headerOffset = headersOffset + i * amountOfBytesInHeader;
            const stringValue = readStringValue(data, headerOffset);
            const type = data.readInt32LE(headerOffset + 8);
            headers.push({stringValue, type});
        }

        let sb = headers.map(h => readCString(data, stringsOffset, h.stringValue.stringOffset)).join(';') + '\n';

        const rows = [];
        for (let i = 0; i < amountOfRows; i++) {
            const cells = [];
            for (let j = 0; j < amountOfColumns; j++) {
                const cellOffset = cellsOffset + i * amountOfBytesInRow + j * amountOfBytesInCell;
                const cellValue = readCell(data, cellOffset);
                const columnType = headers[j].type;
                cells.push(parseCellValueToType(data, stringsOffset, cellValue, columnType));
            }
            rows.push(cells);
        }

        sb += rows.map(cells => cells.join(';')).join('\n');

        await saveFile(filePath.slice(0, -9) + 'csv', sb);
        await fs.unlink(filePath);
    }

    console.log('Converting datasheets.. finished in ' + (Date.now() - start) + 'ms');
}

function readCString(data, stringsOffset, value) {
    const offset = stringsOffset + value.readInt32LE(0);
    let lengthUntilNullTermination = 0;
    let nextByte;
    do {
        nextByte = data.readInt8(offset + lengthUntilNullTermination++);
    } while (nextByte !== 0)
    return data.slice(offset, offset + lengthUntilNullTermination - 1).toString();
}

function parseCellValueToType(data, stringsOffset, cellValue, type) {
    switch (type) {
        case 1:
            return readCString(data, stringsOffset, cellValue);
        case 2:
            return cellValue.readFloatLE(0);
        case 3:
            return !!cellValue.readInt32LE(0);
    }
}

function readCell(data, offset) {
    const stringOffset = data.readInt32LE(offset);
    const cellValue = data.slice(offset + 4, offset + 8);
    return cellValue;
}

function readStringValue(data, offset) {
    const hash = data.slice(offset, offset + 4);
    const stringOffset = data.slice(offset + 4, offset + 8);
    return {hash, stringOffset};
}

async function saveFile(path, out) {
    const directory = path.slice(0, path.lastIndexOf('/'));
    await fs.mkdir(directory, {recursive: true});
    await fs.writeFile(path, out);
}
