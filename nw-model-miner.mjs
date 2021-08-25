import {promises as fs} from 'fs';
import {globby} from 'globby';
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import {extract as extractDatasheets, convert as convertDatasheets} from './datasheets/extract-and-convert.mjs';
import {dumpPakHeaders} from './pak-headers/pak-header-dumper.mjs';
import {extractAndAssemble as extractAndAssembleModels} from './models/extract-and-assemble.mjs';

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('Usage: node nw-model-miner.mjs "PATH_TO_PAKS"');
    console.log('Example: node nw-model-miner.mjs "C:/Program Files (x86)/Steam/steamapps/common/New World Closed Beta"');
    process.exit();
}

let assetsPath = args[0].replace(/"/g, '').replace(/\\/g, '/');
if (assetsPath.endsWith('/')) {
    assetsPath = assetsPath.slice(0, -1);
}
const pakFilePaths = await globby(assetsPath + '/**/*.pak');

const outPath = dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/') + '/out/';
await fs.mkdir(outPath, {recursive: true});

await extractDatasheets(pakFilePaths, outPath);
await convertDatasheets(outPath);

await dumpPakHeaders(pakFilePaths, outPath);

await extractAndAssembleModels(outPath);

/* Remove empty folders */
const dirs = await fs.readdir(outPath, {withFileTypes: true});
dirs.forEach(dir => removeIfEmpty(outPath, dir));

async function removeIfEmpty(pathPrefix, path) {
    if (!path.isDirectory()) {
        return false;
    }

    const dirsAndFiles = await fs.readdir(pathPrefix + '/' + path.name, {withFileTypes: true});

    if (dirsAndFiles.length === 0) {
        await fs.rmdir(pathPrefix + '/' + path.name);
        return true;
    }

    const subDirsAreEmpty = dirsAndFiles.map(dir => removeIfEmpty(pathPrefix + '/' + path.name, dir)).every(isEmpty => isEmpty === true);
    if (subDirsAreEmpty) {
        await fs.rmdir(pathPrefix + '/' + path.name);
        return true;
    }
}
