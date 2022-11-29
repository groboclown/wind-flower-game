// Load assets.

// getAmmoLibraryRef get the URL path to the ammo library
// In order to work with Vite's bundling and possible
//   embedding in a relative URL, we need to do some
//   work to find the location of the 'ammo' library.
export function getAmmoLibraryRef() {
  // See https://vitejs.dev/guide/build.html#public-base-path
  // If we used the import.meta.env.BASE_URL format, TypeScript
  //   would throw an error because it doesn't know about vite's
  //   dynamic insertion of the env value.
  // return `./${import.meta.env.BASE_URL}/ammo`
  // return `${import.meta.env.BASE_URL}ammo`
  // But it turns out, this value will work both for absolute
  //   paths, local tests, and embedded paths.
  return './ammo'
}
