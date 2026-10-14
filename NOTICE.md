# Attribution and reuse status

This is an unofficial community project, with no affiliation with or endorsement by Anthropic.

Claude's character belongs to Anthropic. The reference artwork and animation timing come from [Ayotomiwa Wale-Durojaye's demo](https://ayotomcs.me/claude-mascot), explained in [his Codrops article](https://tympanus.net/codrops/2026/05/05/reverse-engineering-claude-ais-mascot-animations-with-svg-and-gsap/). The activity scenes and gags adapt those reference poses.

The current activity and gag SVGs are imported from [Mascot Studio v1.7.0](https://github.com/Harriszed/mascot-studio/tree/v1.7.0), commit `fd6da2ae83cca75ec81e23d758a8db8922f5d022`, except walking, which is restored unchanged from v1.6.0 (`5ff343742008350b381c1438be1e41ffd8c09241`), and sleeping, imported unchanged from [v1.7.2](https://github.com/Harriszed/mascot-studio/tree/v1.7.2) (`ed7fc7fba7da023bb948fbcf7893383fec0a078b`). Two locally authored idle stories reuse v1.7.0's original actor, story kit and compiler; their editable source is `scripts/build-idle-animations.mjs`. `animation-catalog.js` records source identifiers, durations, checksums, the walking and sleeping source tags and the idle choices.

No explicit licence for redistribution of that artwork was found. The MIT licence in `LICENSE` covers only the project's own code (`main.js`, `preload.js`, `hook.js`, `install-hooks.js`, `make-icon.js` and the logic in `index.html`). It does **not** cover the character artwork, reference geometry, or trademarks in `assets/` or `docs/`. Get permission before reusing those commercially or claiming unrestricted rights to them.
