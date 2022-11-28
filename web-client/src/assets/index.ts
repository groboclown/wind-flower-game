// Load assets.

// getAmmoLibraryRef get the URL path to the ammo library
// In order to work with Vite's bundling and possible
//   embedding in a relative URL, we need to do some
//   work to find the location of the 'ammo' library.
export function getAmmoLibraryRef() {
  return `./${import.meta.env.BASE_URL}/ammo`
}
