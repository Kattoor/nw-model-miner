import {execSync} from 'child_process';
import workerpool from 'workerpool';
import {promises as fs} from 'fs';

async function runColladaConverter(modelPath) {
    const fileName = modelPath.slice(modelPath.lastIndexOf('/') + 1);
    const directory = modelPath.slice(0, modelPath.lastIndexOf('/'));

    try {
        execSync('cgf-converter.exe "' + fileName + '"', {
            env: process.env,
            cwd: directory
        });
        await fs.unlink(modelPath);
    } catch (e) {
        console.log('ColladaConverter: error for ' + modelPath);
    }
    return directory + '/' + fileName.slice(0, fileName.lastIndexOf('.')) + '.dae';
}

async function runGltfConverter(colladaFilePath) {
    const gltfFilePath = colladaFilePath.slice(0, colladaFilePath.lastIndexOf('.')) + '.gltf';

    try {
        execSync('COLLADA2GLTF-bin.exe "' + colladaFilePath + '" --doubleSided -o "' + gltfFilePath + '"');
        await fs.unlink(colladaFilePath);
    } catch (e) {
        console.log('GltfConverter: error for ' + colladaFilePath);
        // probably a missing <triangles count="2016" material=" in the Collada file
    }
}


workerpool.worker({
    runColladaConverter: runColladaConverter,
    runGltfConverter: runGltfConverter
});
