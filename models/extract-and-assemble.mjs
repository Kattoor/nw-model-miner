import {globby} from 'globby';
import {promises as fs} from 'fs';

import {convertModels} from './3d/3d-converter.mjs';
import {extractModelsMaterialsTextures} from './pak-extractors/models-and-materials/get-models-materials-textures.mjs';

export async function extractAndAssemble(path) {
    const filePaths = await globby(path + '**/*.csv');

    /* Read item definitions */
    const itemDefinitions = [];
    for (let filePath of filePaths) {
        if (/javelindata_itemdefinitions_master_(named|common|quest|crafting|faction|store)\.csv$/.test(filePath)) {
            const data = await fs.readFile(filePath, 'utf-8');
            const lines = data.split('\n');

            const itemIdIndex = 0;
            const nameIndex = 1;
            const itemTypeIndex = 2;
            const armorAppearanceMIndex = 41;
            const armorAppearanceFIndex = 42;

            for (let line of lines) {
                const cells = line.split(';');
                if (cells[itemTypeIndex] === 'Armor' && (cells[armorAppearanceMIndex] !== '' || cells[armorAppearanceFIndex] !== '')) {
                    itemDefinitions.push({
                        itemId: cells[itemIdIndex],
                        name: cells[nameIndex],
                        armorAppearanceF: cells[armorAppearanceFIndex],
                        armorAppearanceM: cells[armorAppearanceMIndex]
                    });
                }
            }
        }
    }

    /* Read item appearance definitions */
    const itemAppearanceDefinitions = [];
    for (let filePath of filePaths) {
        if (/javelindata_itemappearancedefinitions.csv$/.test(filePath)) {
            const data = await fs.readFile(filePath, 'utf-8');
            const lines = data.split('\n');

            const itemIdIndex = 0;
            const skin1Index = 27;
            const material1Index = 28;
            const isSkin1Index = 29;
            const mask1Index = 30;
            const skin2Index = 31;
            const material2Index = 32;
            const isSkin2Index = 33;
            const mask2Index = 34;

            for (let line of lines) {
                const cells = line.split(';');
                itemAppearanceDefinitions.push({
                    itemId: cells[itemIdIndex],
                    skin1: cells[skin1Index],
                    material1: cells[material1Index],
                    isSkin1: cells[isSkin1Index],
                    mask1: cells[mask1Index],
                    skin2: cells[skin2Index],
                    material2: cells[material2Index],
                    isSkin2: cells[isSkin2Index],
                    mask2: cells[mask2Index]
                });
            }
        }
    }

    /* Couple definitions */
    const records = [];
    for (let itemDefinition of itemDefinitions) {
        const itemAppearanceDefinition = itemAppearanceDefinitions.find(appearanceDefinition => itemDefinition.armorAppearanceM === appearanceDefinition.itemId);
        records.push({
            itemId: itemDefinition.itemId,
            name: itemDefinition.name,
            armorAppearanceM: itemDefinition.armorAppearanceM,
            armorAppearanceF: itemDefinition.armorAppearanceF,
            skin1: {
                model: itemAppearanceDefinition.skin1,
                material: itemAppearanceDefinition.material1,
                isSkin: itemAppearanceDefinition.isSkin1,
                mask: itemAppearanceDefinition.mask1
            },
            skin2: {
                model: itemAppearanceDefinition.skin2,
                material: itemAppearanceDefinition.material2,
                isSkin: itemAppearanceDefinition.isSkin2,
                mask: itemAppearanceDefinition.mask2
            }
        });
    }

    await extractModelsMaterialsTextures(records, path);

    await convertModels(records);

    const filesToDelete = await globby(path + '**/!(*.gltf)', {expandDirectories: true});
    for (let fileToDelete of filesToDelete) {
        await fs.unlink(fileToDelete);
    }
}
