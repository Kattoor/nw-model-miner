# ⛏️ nw-model-miner ⛏️

1. Download [cgf-converter.exe](https://github.com/Markemp/Cryengine-Converter/releases) and add the path of cgf-converter.exe to your PATH environment variable.
2. Download [texconv.exe](https://github.com/microsoft/DirectXTex/releases) and add the path of texconv.exe to your PATH environment variable.
3. Download [COLLADA2GLTF](https://github.com/KhronosGroup/COLLADA2GLTF/releases) and add the path of COLLADA2GLTF-bin.exe to your PATH environment variable.
4. `npm install` - you'll need to have a [Python installation](https://www.python.org/downloads/) since I use [ffi-napi](https://www.npmjs.com/package/ffi-napi) (which uses [node-gyp](https://github.com/nodejs/node-gyp)) to automatically create bindings to the Oodle compression DLL.
5. `node nw-model-miner.mjs "PATH_TO_ASSETS"`
6. Browse [The Useless Web](https://theuselessweb.com/) for about 20 minutes until the application finishes.
7. Open nw-model-miner/viewer/index.html - drag a GLTF file onto the page to load it.

![Model Viewer](https://i.imgur.com/9gmkzLZ.gifv)
