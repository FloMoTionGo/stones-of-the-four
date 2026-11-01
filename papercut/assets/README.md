# Emblem models

`models/*.glb`: one textured mesh per element, made on 2026-11-01 with the Higgsfield CLI: a reference image from Z Image, then SAM 3D Objects (`sam_3_3d --export_textured_glb true`). `scene.js` holds the per-model rotation and height.

The reference images live in `ref/` on the machine that generated them and are not committed (5 MB each). To regenerate one:

```bash
higgsfield generate create z_image --aspect_ratio 1:1 --wait --prompt "A single papercraft sculpture of a stylised <flame with three tongues | cresting ocean wave with a curling foam tip | rounded mountain mound with two humps | puffy cumulus cloud>, built from stacked layers of thick coloured card stock, cut-paper style with clearly visible paper thickness and stepped layers, chunky and solid: <three tones>. It stands directly on the white surface with no base. Alone, centred on a plain pure white background, three-quarter view from slightly above, soft even studio light, no cast shadow, no text, no other objects. Board game token emblem."
higgsfield generate create sam_3_3d --image ./ref/fire.png --export_textured_glb true --prompt "papercraft flame sculpture" --wait
```

Tones used: fire red, orange, yellow; water deep teal, bright blue, pale blue; earth dark forest green, green, light green; air slate blue-grey, pale blue-grey, bone white.
