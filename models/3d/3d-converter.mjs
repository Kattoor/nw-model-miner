import workerpool from 'workerpool';
import {dirname} from 'path';
import {fileURLToPath} from 'url';
import {promises as fs} from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = workerpool.pool(__dirname + '/converter-worker.js', {workerType: 'process'});

export async function convertModels(records, outPath) {
    const colladaFilePaths = await convertToColladaFiles(records);
    await fixColladaFiles(colladaFilePaths);
    await convertToGltfFiles(colladaFilePaths, outPath + '/gltf/');
    await pool.terminate();
}

async function convertToColladaFiles(records, outPath) {
    const toExtract = [];

    for (let record of records) {
        const itemId = record.itemId;

        const skin1Model = record.skin1.model.toLocaleLowerCase();
        const skin2Model = record.skin2.model.toLocaleLowerCase();

        if (skin1Model !== '') {
            const model1Name = skin1Model.slice(skin1Model.lastIndexOf('/') + 1);
            toExtract.push(outPath + itemId + '/' + model1Name);
        }

        if (skin2Model !== '') {
            const model2Name = skin2Model.slice(skin2Model.lastIndexOf('/') + 1);
            toExtract.push(outPath + itemId + '/' + model2Name);
        }
    }

    const start = Date.now();
    let finishedTasks = 0;
    const colladaFilePaths = [];

    return new Promise(resolve => {
        for (let modelPath of toExtract) {
            pool.exec('runColladaConverter', [modelPath])
                .then(createdColladaFilePath => {
                    finishedTasks += 1;
                    process.stdout.write('Converting to Collada files.. ' + Math.round(finishedTasks * 100 / toExtract.length) + '%\r');
                    colladaFilePaths.push(createdColladaFilePath);
                    if (finishedTasks === toExtract.length) {
                        console.log('Converting to Collada files.. finished in ' + (Date.now() - start) + 'ms');
                        resolve(colladaFilePaths);
                    }
                });
        }
    });
}

async function fixColladaFiles(colladaFilePaths) {
    const start = Date.now();

    for (let i = 0; i < colladaFilePaths.length; i++) {
        process.stdout.write('Fixing Collada files.. ' + Math.round(i * 100 / colladaFilePaths.length) + '%\r');

        const colladaFilePath = colladaFilePaths[i];

        const content = await fs.readFile(colladaFilePath, 'utf-8');

        const lines = content.split('\n');
        const withoutNormals = lines.filter(line => !line.trim().startsWith('<input semantic="NORMAL"')).join('\n');

        const fixed = withoutNormals.replace(/<init_from>.*\/(.*)\.(png|dds|tif)<\/init_from>/gm, '<init_from>textures/$1.png</init_from>');

        await fs.writeFile(colladaFilePath, fixed);
    }

    console.log('Fixing Collada files.. finished in ' + (Date.now() - start) + 'ms');
}

export async function convertToGltfFiles(colladaFilePaths) {
    const start = Date.now();
    let finishedTasks = 0;

    return new Promise(resolve => {
        for (let colladaFilePath of colladaFilePaths) {
            pool.exec('runGltfConverter', [colladaFilePath])
                .then(() => {
                    finishedTasks += 1;
                    process.stdout.write('Converting to Gltf files.. ' + Math.round(finishedTasks * 100 / colladaFilePaths.length) + '%\r');
                    if (finishedTasks === colladaFilePaths.length) {
                        console.log('Converting to Gltf files.. finished in ' + (Date.now() - start) + 'ms');
                        resolve(colladaFilePaths);
                    }
                });
        }
    });
}
