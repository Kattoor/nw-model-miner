import {extractDatasheets} from './datasheet-extractor.mjs';
import {convertDatasheets} from './datasheet-converter.mjs';

export async function extract(pakFilePaths, outPath) {
    await extractDatasheets(pakFilePaths, outPath);
}

export async function convert(outPath) {
    await convertDatasheets(outPath);
}
