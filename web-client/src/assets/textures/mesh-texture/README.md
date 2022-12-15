# About

The Mesh texture is the single texture that's applied to the board layout, but with each triangle in the mesh assigned to a different UV coordinate in the texture.

So this texture requires a UV mapping between the tile type and the location in the image.

All source triangles must be based on `_source.svg`.  Each triangle has dimensions (500, 433).  Each image contains 6 triangles, each will be placed on the corresponding hexagon tile position.  The rendered UV positions for each triangle are:
  * 0: (  0, 432), (499, 432), (249,   0)
  * 1: (749,   0), (250,   0), (500, 432)
  * 2: (500, 432), (999, 432), (749,   0)
  * 3: (499, 433), (  0, 433), (249, 865)
  * 4: (250, 865), (749, 865), (499, 433)
  * 5: (999, 433), (500, 433), (749, 865)

Each token category requires these variations:
  * (X).(v) - the standard hexagon token
  * (X).(v).hover - mouse-over hover
  * (X).(v).select - selected token
  * (X).(v).hover-select - selected hexagon token

where "(X)" is the token category name, and "(v)" is the graphical variation (integer as 2 digits).

The actual placed tiles will be split by triangle.

Current colors:
  * select: `113358ff`
  * hover: `c7aff6ff`
