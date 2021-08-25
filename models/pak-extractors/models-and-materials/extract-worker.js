import {promises as fs} from 'fs';
import workerpool from 'workerpool';
import ffi from 'ffi-napi';
import sharp from 'sharp';
import {execSync} from 'child_process';

const lib = ffi.Library('oo2core_8_win64.dll', {
    'OodleLZ_Decompress': ['void', ['char *', 'int', 'char *', 'int', 'int', 'int', 'int', 'void *', 'void *', 'void *', 'void *', 'void *', 'void *', 'int']]
});

async function extractModelsAndMaterials(recordPath, skin1ModelHeader, skin1MaterialHeader, skin1FileName, skin2ModelHeader, skin2MaterialHeader, skin2FileName) {
    if (skin1ModelHeader != null) {
        await extractFromPak(skin1ModelHeader, recordPath + '/' + getFileName(skin1FileName));
    }

    if (skin1MaterialHeader != null) {
        const materialOutPath = recordPath + '/' + getMaterialFileName(skin1FileName);
        await extractFromPak(skin1MaterialHeader, materialOutPath);
    }

    if (skin2ModelHeader != null) {
        await extractFromPak(skin2ModelHeader, recordPath + '/' + getFileName(skin2FileName));
    }

    if (skin2MaterialHeader != null) {
        const materialOutPath = recordPath + '/' + getMaterialFileName(skin2FileName);
        await extractFromPak(skin2MaterialHeader, materialOutPath);
    }
}

async function extractTextures(texturesOutputPath, textureHeader, textureFileName) {
    await extractTextureFromPak(textureHeader, texturesOutputPath + getTextureFileName(textureFileName));
}

function getFileName(path) {
    return path.slice(path.lastIndexOf('/') + 1);
}

function getMaterialFileName(path) {
    const fileNameWithExtension = getFileName(path);
    return fileNameWithExtension.slice(0, fileNameWithExtension.lastIndexOf('.') + 1) + 'mtl';
}

function getTextureFileName(path) {
    return getFileName(path).replace('.tif', '.dds');
}

async function extract(header) {
    const fileHandle = await fs.open(header.pakFile, 'r');

    const localHeader = Buffer.alloc(4);
    await fileHandle.read({buffer: localHeader, position: header.offset + 26});
    const fileNameLength = localHeader.readUInt16LE(0);
    const extraFieldLength = localHeader.readUInt16LE(2);

    const compressedData = Buffer.alloc(header.compressedSize);
    await fileHandle.read({
        buffer: compressedData,
        position: header.offset + 30 + fileNameLength + extraFieldLength
    });

    const uncompressedData = Buffer.alloc(header.uncompressedSize);
    lib.OodleLZ_Decompress(compressedData, header.compressedSize, uncompressedData, header.uncompressedSize, 0, 0, 0, null, null, null, null, null, null, 3);

    await fileHandle.close()

    return uncompressedData;
}

async function extractFromPak(header, savePath) {
    const data = await extract(header);
    await fs.writeFile(savePath, data);
}

async function extractTextureFromPak(textureHeader, savePath) {
    if (textureHeader == null) {
        console.log('JASPER ERROR', textureHeader, savePath);
        return;
    }

    if (textureHeader.length === 1) {
        await extractFromPak(textureHeader, savePath);
    } else {
        const firstFileData = await extract(textureHeader[0]);
        const secondFileData = await extract(textureHeader[1]);

        firstFileData[0x1c] = 0; // set mip count
        const header = firstFileData.slice(0, 0x94);

        await fs.writeFile(savePath, Buffer.concat([header, secondFileData]));
    }

    /* to png */
    await convertDds(savePath);

    /*/!* shrink *!/
    const pngPath = savePath.slice(0, -3) + 'png';
    const pngFile = await fs.readFile(pngPath);
    const {width, height} = await sharp(pngFile).metadata();
    const w = Math.round(width / 8);
    const h = Math.round(height / 8);
    await fs.writeFile(pngPath, await sharp(pngFile).resize(w, h).toBuffer());*/
}

async function convertDds(path) {
    const fileName = path.slice(path.lastIndexOf('/') + 1);
    const directory = path.slice(0, path.lastIndexOf('/'));

    if (fileName.endsWith('ddn.dds') || fileName.endsWith('ddna.dds')) {
        await convertSpecialDds(fileName, directory, path);
        return;
    }

    try {
        execSync(`texconv.exe "${fileName}" -ft png -y`, {env: process.env, cwd: directory});
        await fs.unlink(path);
    } catch (e) {
        await convertSpecialDds(fileName, directory, path);
    }
}

async function convertSpecialDds(fileName, directory, path) {
    try {
        execSync(`texconv.exe "${fileName}" -ft png -f rgba -y`, {env: process.env, cwd: directory});
        await fs.unlink(path);
    } catch (e) {
        console.log('Couldn\'t convert ' + directory + '\t' + fileName);
    }
}

workerpool.worker({
    extractModelsAndMaterials: extractModelsAndMaterials,
    extractTextures: extractTextures
});
