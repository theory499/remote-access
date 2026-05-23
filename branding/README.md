# Proxia branding

Source assets for the **Proxia** product mark. Everything else can be
re-exported from these.

## Files

| File | Purpose |
| --- | --- |
| `logo.svg` | The canonical 512x512 product logo. Source for every other size. |

## Mark

- Two concentric rings represent proximity and the live signal between
  desktop and phone.
- A cursor arrow at the lower-right of the rings represents the user's
  reach into the remote machine.
- Brand colour: `#1976D2` (also `colorPrimary` in the Android theme).
- Text colour on brand background: `#FFFFFF`.

## Regenerating platform-specific assets

### Android

Adaptive icon is already wired up via the vector
`mobile/android/app/src/main/res/drawable/ic_launcher_foreground.xml`
and the colour `mobile/android/app/src/main/res/values/colors.xml`.
No PNG generation needed - Android renders the vector at every
density.

### iOS

iOS still requires PNG icons at the standard set of sizes. To
regenerate from `logo.svg`:

```sh
brew install librsvg
for size in 20 29 40 58 60 76 80 87 120 152 167 180 1024; do
  rsvg-convert -w $size -h $size logo.svg \
    -o ../mobile/ios/RemoteDesktop/Resources/Assets.xcassets/AppIcon.appiconset/icon-$size.png
done
```

(Then update `Contents.json` to reference each generated PNG.)

### Desktop (Electron)

To produce installer icons:

```sh
brew install librsvg imagemagick
rsvg-convert -w 1024 logo.svg -o icon.png
# Then:
mkdir -p iconset.iconset
sips -z 16   16   icon.png --out iconset.iconset/icon_16x16.png
sips -z 32   32   icon.png --out iconset.iconset/icon_16x16@2x.png
sips -z 32   32   icon.png --out iconset.iconset/icon_32x32.png
# ... etc.
iconutil -c icns iconset.iconset    # macOS
convert icon.png ../desktop/build/icon.ico  # Windows
```

## Naming

- Product name: **Proxia**
- Wordmark capitalisation: `Proxia` (initial cap only).
- Pronunciation: PROK-see-uh.
- Etymology: coined from "proxy". Your phone acts as a proxy for your
  desk - you reach the desk through it.
