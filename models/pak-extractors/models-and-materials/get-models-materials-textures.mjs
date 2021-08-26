import {promises as fs} from 'fs';
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import workerpool from 'workerpool';
import {globby} from 'globby';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = workerpool.pool(__dirname + '/extract-worker.js', {workerType: 'process'});

export async function extractModelsMaterialsTextures(records, outPath) {
    const modelHeaders = JSON.parse(await fs.readFile(outPath + '/header-entries/models.json', 'utf-8'));
    const materialHeaders = JSON.parse(await fs.readFile(outPath + '/header-entries/materials.json', 'utf-8'));
    const textureHeaders = JSON.parse(await fs.readFile(outPath + '/header-entries/textures.json', 'utf-8'));

    await extractModelsAndMaterials(records, modelHeaders, materialHeaders, outPath + '/gltf/');
    await extractNecessaryTextures(records, textureHeaders, outPath + '/gltf/');

    await fs.unlink(outPath + '/header-entries/models.json');
    await fs.unlink(outPath + '/header-entries/materials.json');
    await fs.unlink(outPath + '/header-entries/textures.json');

    await pool.terminate();
}

async function extractModelsAndMaterials(records, modelHeaders, materialHeaders, outPath) {
    let finishedTasks = 0;

    const start = Date.now();

    return new Promise(async resolve => {
        for (let record of records) {
            const itemId = record.itemId;
            const skin1Model = record.skin1.model.toLocaleLowerCase();
            const skin1Material = record.skin1.material.toLocaleLowerCase();
            const skin2Model = record.skin2.model.toLocaleLowerCase();
            const skin2Material = record.skin2.material.toLocaleLowerCase();

            const recordPath = outPath + itemId;
            const texturesPath = recordPath + '/textures';
            await fs.mkdir(texturesPath, {recursive: true});

            pool.exec('extractModelsAndMaterials', [
                recordPath,
                skin1Model !== '' ? modelHeaders[skin1Model] : null,
                skin1Material !== '' ? materialHeaders[skin1Material] : null,
                skin1Model,
                skin2Model !== '' ? modelHeaders[skin2Model] : null,
                skin2Material !== '' ? materialHeaders[skin2Material] : null,
                skin2Model
            ])
                .then(() => {
                    finishedTasks += 1;
                    process.stdout.write('Extracting models and materials.. ' + Math.round(finishedTasks * 100 / records.length) + '%\r');
                    if (finishedTasks === records.length) {
                        console.log('Extracting models and materials.. finished in ' + (Date.now() - start) + 'ms');
                        resolve();
                    }
                });
        }
    });
}

async function extractNecessaryTextures(records, textureHeaders, outPath) {
    const materialFilePaths = await globby(outPath + '**/@(*.mtl)');

    const toExtract = [];

    let finishedTasks = 0;

    const start = Date.now();

    for (let materialFilePath of materialFilePaths) {
        const texturesOutputPath = materialFilePath.slice(0, materialFilePath.lastIndexOf('/')) + '/textures/';
        const requiredTextureFiles = await getRequiredTexturePaths(materialFilePath);
        for (let requiredTextureFile of requiredTextureFiles) {
            toExtract.push({
                texturesOutputPath,
                textureHeader: textureHeaders[requiredTextureFile.slice(0, -4)],
                requiredTextureFile
            });
        }
    }

    return new Promise(async resolve => {
        for (let {texturesOutputPath, textureHeader, requiredTextureFile} of toExtract) {
            pool.exec('extractTextures', [
                texturesOutputPath,
                textureHeader,
                requiredTextureFile
            ])
                .then(() => {
                    finishedTasks += 1;
                    process.stdout.write('Extracting necessary textures.. ' + Math.round(finishedTasks * 100 / toExtract.length) + '%\r');
                    if (finishedTasks === toExtract.length) {
                        console.log('Extracting necessary textures.. finished in ' + (Date.now() - start) + 'ms');
                        resolve();
                    }
                });
        }
    });
}

async function getRequiredTexturePaths(materialFilePath) {
    const materialFileContent = await fs.readFile(materialFilePath, 'utf-8');
    const fileSplit = materialFileContent.split('File="');
    if (fileSplit.length > 1) {
        return [...new Set(fileSplit
            .slice(1)
            .map(part => part.split('"')[0])
            .filter(imageUrl => imageUrl.endsWith('.dds') || imageUrl.endsWith('.tif'))
            .map(imageUrl => imageUrl.toLocaleLowerCase()))];
    }
}
