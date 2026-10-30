# Pokémon with friends – Android v0.2

Offline HeartGold overworld prototype for Android / BlueStacks. Choose among eight trainers (Klarin, Lyra, Silber, Camper, Picknickerin, Falk, Kai, Sandra), spawn outside the player's house in Neuborkia, and walk using held touch controls, WASD, or arrow keys. Trainer selection can be reopened while exploring. There are no battles, story events, multiplayer, interior maps or route transitions yet.

## Play

1. Install the APK from **Actions → Android APK bauen → Pokemon-with-friends-debug-APK**.
2. Copy your private **HeartGold-Neuborkia.pwf.zip** to the device / BlueStacks shared folder.
3. Open the app and tap **HeartGold-Paket importieren**, selecting that ZIP without unpacking it.
4. Pick a trainer, optionally edit your name, and tap **In Neuborkia starten**.

The pack is imported once into the app's private files. All play is offline. Existing public builds do not bundle a ROM or extracted game assets. They now show an import screen instead of presenting the old placeholder map as HeartGold.

## Generate a private pack

```sh
python -m pip install numpy pillow
python tools/import_heartgold.py /path/to/HeartGold.nds /private/HeartGold-Neuborkia.pwf.zip
```

A ZIP containing one `.nds` is also accepted. This importer currently requires the German 128 MiB release (`IPKD`). It extracts the town's real mesh, textures, placed building models, tile collision flags and animated trainer textures from that image. The 3D town is rasterized into a fixed orthographic view with a depth map, allowing trainers to pass behind scenery. Spawn: local tile `(23,13)`, world tile `(695,397)`, one tile south of the player's house door. Ground height is fixed to this town's main walking level.

The importer writes a map preview alongside the pack. Keep both outside the public repository. Unsupported geometry or prop transforms fail explicitly. The selected scope is this one town; crossing map borders and entering doors is intentionally unavailable in this version. Water, trees, buildings and walking-only barriers remain blocked by the town's collision data.

For a private local build with the pack already included, copy it to `app/src/main/assets/town.pwf.zip` (gitignored) before `gradle assembleDebug`. That local file is never required by the public CI build.

## Verify / build

```sh
python -m unittest discover -s tools -p 'test_*.py'
gradle --no-daemon assembleDebug
```

CI uses Java 17, Gradle 8.9 and Android SDK 35. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the Nitro format decoder attribution.
