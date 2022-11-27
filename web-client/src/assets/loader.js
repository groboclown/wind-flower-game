// Very explicitly a .js file, not a .ts file.
import * as PIXI from "pixi.js";

import triangle from './images/triangle/*.svg';

const spriteNames = {
  triangle: Object.values(triangle),
};

// GetSprite get a named sprite as a list of Texture.
export function GetSprite(name) {
  return new PIXI.AnimatedSprite(
    spriteNames[name].map((path) => PIXI.Texture.from(path))
  );
}
