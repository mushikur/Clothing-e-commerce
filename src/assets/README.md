# Storefront animation

`fashion-bag.json` is an original vector shopping-bag illustration drawn for this project. It contains no external images, fonts, audio, or downloaded animation assets and can be used and modified with this application.

The file uses a single shape layer and a slow 5-pixel vertical movement. The renderer is imported only when the illustration enters the viewport. Offscreen instances are destroyed; hidden-document playback pauses. Reduced-motion users receive a static SVG without downloading the animation player.

The player is `lottie-web`, distributed under its MIT license in `node_modules/lottie-web/LICENSE.md`.
