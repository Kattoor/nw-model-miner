import {open} from 'yauzl';
import {promises as fs, existsSync} from 'fs';

export async function dumpPakHeaders(pakFilePaths, outPath) {
    const start = Date.now();

    process.stdout.write('Dumping headers..\r');

    let textures = [];
    let models = [];
    let materials = [];

    for (let pakFilePath of pakFilePaths) {
        const entries = await getHeaders(pakFilePath);
        textures = textures.concat(entries.textures);
        models = models.concat(entries.models);
        materials = materials.concat(entries.materials);
    }

    if (!existsSync(outPath + '/header-entries')) {
        await fs.mkdir(outPath + '/header-entries');
    }

    await fs.writeFile(outPath + '/header-entries/textures.json', JSON.stringify(toMapAndRemoveRedundantTextures(textures)));
    await fs.writeFile(outPath + '/header-entries/models.json', JSON.stringify(toMap(models)));
    await fs.writeFile(outPath + '/header-entries/materials.json', JSON.stringify(toMap(materials)));

    console.log('Dumping headers.. finished in ' + (Date.now() - start) + 'ms');
}

function getHeaders(pakFilePath) {
    return new Promise(resolve => {
        const textures = [];
        const models = [];
        const materials = [];

        open(pakFilePath, {lazyEntries: true}, (err, zipFile) => {
            zipFile.readEntry();

            zipFile.on('entry', entry => {
                let collectionToPushTo = null;

                if (/(\.dds(.[0-9])?|\.tif(.[0-9])?)$/gm.test(entry.fileName)) {
                    collectionToPushTo = textures;
                } else if (/(\.cgf|(?<!(_lod[0-9]))\.skin)$/gm.test(entry.fileName)) {
                    collectionToPushTo = models;
                } else if (/\.mtl$/gm.test(entry.fileName)) {
                    collectionToPushTo = materials;
                }

                if (collectionToPushTo != null) {
                    collectionToPushTo.push({
                        pakFile: pakFilePath.toLocaleLowerCase(),
                        offset: entry.relativeOffsetOfLocalHeader,
                        fileName: entry.fileName.toLocaleLowerCase(),
                        compressedSize: entry.compressedSize,
                        uncompressedSize: entry.uncompressedSize
                    });
                }

                zipFile.readEntry();
            });

            zipFile.once('end', () => resolve({textures, models, materials}));
        });
    });
}

function toMapAndRemoveRedundantTextures(textureHeaders) {
    const groupedByFileName =
        textureHeaders
            .reduce((acc, textureHeader) => {
                const isFirst = textureHeader.fileName.endsWith('.dds') || textureHeader.fileName.endsWith('.tif');
                const fileNameWithoutExtension =
                    textureHeader.fileName.slice(0,
                        isFirst
                            ? -4
                            : (textureHeader.fileName.lastIndexOf('.') - 4));

                if (acc[fileNameWithoutExtension] == null) {
                    acc[fileNameWithoutExtension] = [textureHeader];
                } else {
                    acc[fileNameWithoutExtension].push(textureHeader);
                }

                return acc;
            }, {});

    for (let textureHeadersGroup of Object.values(groupedByFileName)) {
        textureHeadersGroup.sort((textureHeader1, textureHeader2) => textureHeader1.fileName.localeCompare(textureHeader2.fileName));
        if (textureHeadersGroup.length > 2) {
            textureHeadersGroup.splice(1, textureHeadersGroup.length - 2);
        }
    }

    return groupedByFileName;
}

function toMap(recordHeaders) {
    return recordHeaders
        .reduce((acc, recordHeader) => {
            const fileName = recordHeader.fileName;
            delete recordHeader.fileName;
            acc[fileName] = recordHeader;
            return acc;
        }, {});
}
