// generate the texture image mesh from the source svg files.
const fs = require('node:fs')
const path = require('node:path')
const util = require('node:util')
const execFile = util.promisify(require('node:child_process').execFile)
const Jimp = require('jimp')


// Arguments
const ARG_SOURCES = '--source='
const ARG_OUTPUT = '--output='
const ARG_TEMP = '--tempdir='
const ARG_SVG_CMD = '--svg-arg='
const ARG_DEBUG = '--debug'
const ARG_VERBOSE = '--verbose'

// Output files
const MESH_PNG_FILE = 'mesh-texture.png'
const BUMP_PNG_FILE = 'mesh-bump.png'
const UV_MAP_FILE = 'uv-map.json'

// Source files
const SOURCE_IMAGE_EXT = 'svg'
const SOURCE_BUMP_TYPE = 'bump'
const HOVER_MODE = '_hover'
const SELECT_MODE = '_select'
const HOVER_SELECT_MODE = '_hover_select'
const NORMAL_MODE = '_normal'
const MODE_NAMES = [
  NORMAL_MODE,
  HOVER_MODE,
  SELECT_MODE,
  HOVER_SELECT_MODE,
]

// Image Numbers
const HEX_WIDTH = 1000
const HEX_HEIGHT = 866
const LEFT_PIXEL_ADJ = 4
const TOP_PIXEL_ADJ = 4
const RIGHT_PIXEL_ADJ = -6
const BOTTOM_PIXEL_ADJ = -6




// Default SVG to PNG command
const DEFAULT_SVG_CONVERT_CMD = [
  'inkscape', '--export-filename=(o)',
  '--export-overwrite',
  '--export-type=png',
  '--export-width=(w)',
  '--export-height=(h)',
  '(s)',
]


// Logging

const LOG_DEBUG = 0
const LOG_VERBOSE = 1
const LOG_NORMAL = 2

const args = parseArgs()
args.problems.forEach((text) => { console.error(text) })
if (args.help === true) {
  console.log(`Usage: ${args.cmd} [--help] [-h] [--debug] [--verbose] (--source=source-dir) (--output=output-dir)`)
  console.log(`Where:`)
  console.log(`  --help | -h      This help text.`)
  console.log(`  --debug          Debug logging.`)
  console.log(`  --verbose        More logging than usual.`)
  console.log(`  --source=X       Read the SVG files from the source directory X.`)
  console.log(`  --output=X       Write the temporary files and the final files to directory X.`)
  process.exit(args.okay === false ? 1 : 0)
}

if (fs.lstatSync(args.output, {throwIfNoEntry: false}) === undefined) {
  fs.mkdirSync(args.output, {recursive: true})
  if (fs.lstatSync(args.output, {throwIfNoEntry: false}) === undefined) {
    error(`Failed to create output directory ${args.output}`)
    process.exit(2)
  }
  verbose(`Created output directory ${args.output}`)
}

run()


async function run() {
  // First, all the source files must be discovered.
  const sourceInfo = await findSourcesAsync(args.sources)

  // The UV mapping json file depends on the source info, but nothing
  //   else depends on it.
  const uvMapGenerationFuture = generateUvMapAsync(path.join(args.output, UV_MAP_FILE), sourceInfo.categories)

  // Generate the texture and bump images.
  //   They are joined into a single image, which requires:
  //      1. creating the target images.
  //      2. converting the source images into PNG files.
  //      3. For each of the categories, blitting it and the modes into the image.
  //   The images and the modes have a distinct ordering which can help take
  //   advantage of the image processing.

  // The svg -> png takes the longest, so fire those off first.
  const pngFutures = convertAllSourcesToPngFutures(sourceInfo)

  // Then, create the target images.
  const textureSize = getImagePosition(
    { rowIndex: Object.values(sourceInfo.categories).length },
    'final',
  )
  const textureFuture = createEmptyImageAsync(textureSize)
  const bumpFuture = createEmptyImageAsync(textureSize)

  // Load up the mode images, as every category uses these.
  const modeFutures = loadModeImageFutures(pngFutures, sourceInfo)

  // Populate the images with the data.
  const populateFuture = blitCategoriesAsync(
    textureFuture,
    bumpFuture,
    sourceInfo,
    pngFutures,
    modeFutures,
  )

  // Now wrap things up.
  // Parallel isn't that important at this point.
  await populateFuture

  const textureImage = await textureFuture
  verbose(`Writing to ${MESH_PNG_FILE}`)
  await textureImage.writeAsync(path.join(args.output, MESH_PNG_FILE))

  const bumpImage = await bumpFuture
  verbose(`Writing to ${BUMP_PNG_FILE}`)
  await bumpImage.writeAsync(path.join(args.output, BUMP_PNG_FILE))

  await uvMapGenerationFuture
  verbose(`Cleaning up temporary files.`)
  await deleteTemporarySourcesAsync(sourceInfo)
  verbose(`Complete.`)
}


// generateUvMapAsync turn the catetories: {} mapping into the uv-map.json file.
function generateUvMapAsync(outfile, sourceDetails) {
  // For details on the expected format, see src/scenes/gameboard/texture-handler.ts
  // Texture UV map format:
  //   { "categories": {
  //        "(category name)": {
  //            "normal|hover|select|hover-select": [
  //                   // one per triangle, so 6 of these.
  //                   [[u, v], [u, v], [u, v]],
  //            ]
  //        }
  //     }, "width": (image width), "height": (image height)
  //   }
  const fullSize = getImagePosition(
    { rowIndex: Object.keys(sourceDetails).length },
    'final',
  )
  const output = {
    categories: {},
    width: fullSize.x,
    height: fullSize.y,
  }

  Object.values(sourceDetails).forEach((details) => {
    let cat = output.categories[details.category]
    if (cat === undefined) {
      cat = {}
      output.categories[details.category] = cat
    }
    MODE_NAMES.forEach((modeName) => {
      const pos = getImagePosition(details, modeName)
      let h0 = pos.y + TOP_PIXEL_ADJ
      let h432= pos.y + 432 + BOTTOM_PIXEL_ADJ
      let h433 = pos.y + 433 + TOP_PIXEL_ADJ
      let h865= pos.y + 865 + BOTTOM_PIXEL_ADJ
      let w0= pos.x + LEFT_PIXEL_ADJ
      let w249 = pos.x + 249 + RIGHT_PIXEL_ADJ
      let w250 = pos.x + 250 + LEFT_PIXEL_ADJ
      let w499 = pos.x + 499 + RIGHT_PIXEL_ADJ
      let w500 = pos.x + 500 + LEFT_PIXEL_ADJ
      let w749 = pos.x + 749 + RIGHT_PIXEL_ADJ
      let w999 = pos.x + 999 + RIGHT_PIXEL_ADJ

      cat[modeName] = [
        // triangle 0
        [[w249, h0  ], [w0  , h432], [w499, h432]],

        // triangle 1
        [[w500, h432], [w749, h0  ], [w250, h0  ]],

        // triangle 2
        [[w749, h0  ], [w500, h432], [w999, h432]],

        // triangle 3
        [[w249, h865], [w499, h433], [w0  , h433]],

        // triangle 4
        [[w499, h433], [w250, h865], [w749, h865]],

        // triangle 5
        [[w749, h865], [w999, h433], [w500, h433]],
      ]
    })
  })

  return new Promise((resolve, reject) => {
    verbose(`Generating UV Map file ${outfile}`)
    fs.writeFile(outfile, JSON.stringify(output), (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}


// getImagePostion get the upper-left position of the image + mode in the output giant image.
function getImagePosition(imageDetails, modeName) {
  let modeIndex = 0
  for (; modeIndex < MODE_NAMES.length; modeIndex++) {
    if (MODE_NAMES[modeIndex] === modeName) {
      break
    }
  }
  // special case for computing the full image width; use the mode name length.

  return {
    x: modeIndex * HEX_WIDTH,
    y: imageDetails.rowIndex * HEX_HEIGHT,
  }
}


function blitCategoriesAsync(targetTextureFuture, targetBumpFuture, sources, pngGenerationFutures, modeFutures) {
  return Promise.all(
    Object.values(sources.categories).map((details) => {
      return blitCategoryModesAsync(targetTextureFuture, targetBumpFuture, details, pngGenerationFutures, modeFutures)
    })
  )
}


function blitCategoryModesAsync(targetTextureFuture, targetBumpFuture, details, pngGenerationFutures, modeFutures) {
  const textureFuture =
      targetTextureFuture
    .then(async (targetImage) => {
      await blitCategoryAsync(targetImage, details, details.outputTexture, pngGenerationFutures)
      await Promise.all(
        MODE_NAMES.map((modeName) => {
          return blitModeAsync(targetImage, modeFutures.textures[modeName], details, modeName)
        })
      )
    })
  const bumpFuture =
      targetBumpFuture
    .then(async (targetImage) => {
      await blitCategoryAsync(targetImage, details, details.outputBump, pngGenerationFutures)
      await Promise.all(
        MODE_NAMES.map((modeName) => {
          return blitModeAsync(targetImage, modeFutures.bumps[modeName], details, modeName)
        })
      )
    })

  return Promise.all([textureFuture, bumpFuture])
}


// blitCategoryAsync puts the category down for every mode.
//   The mode mask must be added after.
async function blitCategoryAsync(targetImage, details, pngFileName, pngGenerationFutures) {
  await pngGenerationFutures[pngFileName]
  const categoryImage = await Jimp.read(pngFileName)
  MODE_NAMES.forEach((modeName) => {
    const pos = getImagePosition(details, modeName)
    debug(`Blitting ${pngFileName} at (${pos.x},${pos.y})`)
    targetImage.blit(categoryImage, pos.x, pos.y)
  })
}


function blitModeAsync(targetImage, modeImageFuture, categoryImageDetails, modeName) {
  const pos = getImagePosition(categoryImageDetails, modeName)
  return modeImageFuture.then((modeImage) => {
    debug(`Blitting ${modeName} at (${pos.x},${pos.y})`)
    targetImage.blit(modeImage, pos.x, pos.y)
  })
}



// deleteTemporarySourcesAsync delete all the mode and category temporary output files
function deleteTemporarySourcesAsync(sources) {
  const ret = []
  Object.values(sources.modes).forEach((details) => {
    ret.push(deleteDetailsAsync(details))
  })
  Object.values(sources.categories).forEach((details) => {
    ret.push(deleteDetailsAsync(details))
  })
  return Promise.all(ret)
}


// deleteDetailsAsync delete the temporary output files for the image
function deleteDetailsAsync(imageDetails) {
  return Promise.all([
    deleteAsync(imageDetails.outputTexture),
    deleteAsync(imageDetails.outputBump)
  ])
}


// convertAllSourcesToPngFutures returns a map of output png file name to a future that generates it.
function convertAllSourcesToPngFutures(sourceInfo) {
  const ret = {}
  Object.values(sourceInfo.modes).forEach((details) => {
    convertSourceInfoToPngFutures(ret, details)
  })
  Object.values(sourceInfo.categories).forEach((details) => {
    convertSourceInfoToPngFutures(ret, details)
  })
  return ret
}


// convertSourceInfoToPngFutures adds the png generator for the images into the out map
function convertSourceInfoToPngFutures(out, details) {
  if (!details.sourceBump || !details.sourceTexture) {
    throw new Error(`No source bump or texture for ${JSON.stringify(details)}`)
  }
  out[details.outputTexture] = svg2pngAsync(details.sourceTexture, details.outputTexture)
  out[details.outputBump] = svg2pngAsync(details.sourceBump, details.outputBump)
}


// loadModeImageFutures each mode texture & bump is loaded into a future.
//    The mode files are reused by all the categories, so just load them once.
function loadModeImageFutures(pngFutures, sourceInfo) {
  const ret = {
    textures: {},
    bumps: {},
  }
  MODE_NAMES.forEach((modeName) => {
    const textureFile = sourceInfo.modes[modeName].outputTexture
    const bumpFile = sourceInfo.modes[modeName].outputBump
    debug(`Reading texture for ${modeName}`)
    ret.textures[modeName] =
      pngFutures[textureFile].then(() => { return Jimp.read(textureFile) })
    debug(`Reading bump for ${modeName}`)
    ret.bumps[modeName] =
      pngFutures[bumpFile].then(() => { return Jimp.read(bumpFile) })
  })
  return ret
}


// createEmptyImage create a transparent image of the given {x, y} size
function createEmptyImageAsync(size) {
  return Jimp.create(size.x, size.y, '#00000000')
}


// findSources Find all the source files, and decodes their meanings
// Uses the naming convention of the sources.
async function findSourcesAsync(sourceDir) {
  // File format naming is "(category).(variation index)[.frame index][.bump].svg"
  return new Promise((resolve, reject) => {
    fs.readdir(sourceDir, (err, files) => {
      if (err) {
        reject(err)
      }
      const ret = {
        // Each of these collections is set up such that the bump map + texture map
        //   are in the same stored object, which means the key must uniquely define
        //   the pair.

        // mode name -> image description
        modes: {},

        // category.variation.frame -> image description
        categories: {},
      }
      let categoryIndex = 0
      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx]
        const fqn = path.join(sourceDir, file)
        if (fs.lstatSync(fqn).isFile()) {
          // See if we can split it into pieces.
          debug(`Inspecting ${file}`)
          let nameParts = file.split('.')
          let category = nameParts[0] || ''
          let variation = nameParts[1] || ''
          let frame = '0'
          let bump = false
          let ext = nameParts[nameParts.length - 1] || ''

          // The .bump and .ext are removed from the inspection, because
          //   the variance of .bump existing or not makes the break-down complex.
          if (nameParts[nameParts.length - 2] === SOURCE_BUMP_TYPE) {
            bump = true
            nameParts = nameParts.slice(0, nameParts.length - 2)
          } else if (nameParts.length > 1) {
            nameParts = nameParts.slice(0, nameParts.length - 1)
          }

          if (nameParts.length === 3) {
            frame = nameParts[2]
          }

          const variationInt = parseInt(variation)
          const frameInt = parseInt(frame)

          if (nameParts.length < 2 || nameParts.length > 3) {
            verbose(`Ignoring ${file} - invalid file name format`)
          } else if (ext === SOURCE_IMAGE_EXT && category !== '' && variationInt !== NaN && frameInt !== NaN) {
            let collection
            let key
            let isMode = false
            if (MODE_NAMES.some((x) => x === category)) {
              // This is a mode, not a category.
              // Modes are stored differently.
              key = category
              collection = ret.modes
              isMode = true
            } else {
              key = `${category}.${variationInt}.${frameInt}`
              collection = ret.categories
            }

            let srcTxt = null
            let outTxt = null
            let srcBmp = null
            let outBmp = null
            if (bump) {
              srcBmp = fqn
              outBmp = path.join(args.tempdir, `${category}.${variation}.${frame}.b.png`)
            } else {
              srcTxt = fqn
              outTxt = path.join(args.tempdir, `${category}.${variation}.${frame}.t.png`)
            }
            let details = collection[key]
            if (details === undefined) {
              // Create the key
              collection[key] = {
                category,
                variation: variationInt,
                frame: frameInt,
                rowIndex: categoryIndex,
                sourceTexture: srcTxt,
                outputTexture: outTxt,
                sourceBump: srcBmp,
                outputBump: outBmp,
              }
              if (!isMode) {
                debug(`Assigning ${category}.${variation}.${frame} to ${categoryIndex}`)
                categoryIndex++
              }
            } else {
              if (bump) {
                details.sourceBump = srcBmp
                details.outputBump = outBmp
              } else {
                details.sourceTexture = srcTxt
                details.outputTexture = outTxt
              }
            }
          } else if (ext === SOURCE_IMAGE_EXT && category !== '') {
            debug(`Ignoring ${file} - doesn't smell normal.`)
          }
        }
      }
      resolve(ret)
    })
  })
}


// svg2pngAsync Convert a single SVG file into a PNG.
async function svg2pngAsync(sourceFile, outputFile) {
  // TODO if the png has a latet date than the svg, don't generate.
  const executable = args.svgCmd[0]
  const arguments = []
  args.svgCmd.slice(1).forEach((arg) => {
    arguments.push(
      arg
        .replaceAll('(o)', outputFile)
        .replaceAll('(s)', sourceFile)
        .replaceAll('(w)', HEX_WIDTH)
        .replaceAll('(h)', HEX_HEIGHT)
    )
  })
  debug(`Running [${executable}] ${JSON.stringify(arguments)}`)
  const { stdout, stderr } = await execFile(executable, arguments)
  debug(`Completed ${sourceFile}: stdout: ${stdout}`)
  verbose(`Completed ${sourceFile}: stderr: ${stderr}`)
}


function deleteAsync(filename) {
  return new Promise((resolve, reject) => {
    debug(`Deleting ${filename}`)
    fs.unlink(filename, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}


function parseArgs() {
  let idx = 2
  let ret = {
    cmd: `${process.argv[0]} ${process.argv[1]}`,
    sources: '',
    output: '',
    tempdir: '',
    svgCmd: [],
    logging: LOG_NORMAL,
    okay: false,
    help: false,
    problems: [],
  }
  while (idx < process.argv.length) {
    const arg = process.argv[idx++]
    if (arg.startsWith(ARG_SOURCES)) {
      const sources = arg.substring(ARG_SOURCES.length)
      if (fs.lstatSync(sources).isDirectory()) {
        ret.sources = sources
      } else {
        ret.problems.push(`Source directory ${sources} does not exist or is not a directory.`)
      }
    } else if (arg.startsWith(ARG_OUTPUT)) {
      const output = arg.substring(ARG_OUTPUT.length)
      let ostat = fs.lstatSync(output, {throwIfNoEntry: false})
      if (ostat === undefined || ostat.isDirectory()) {
        ret.output = output
      } else {
        ret.problems.push(`Output directory ${output} is not a directory.`)
      }
    } else if (arg.startsWith(ARG_TEMP)) {
      const tempdir = arg.substring(ARG_TEMP.length)
      let ostat = fs.lstatSync(tempdir, {throwIfNoEntry: false})
      if (ostat.isDirectory()) {
        ret.tempdir = tempdir
      }
    } else if (arg.startsWith(ARG_SVG_CMD)) {
      ret.svgCmd.push(arg.substring(ARG_SVG_CMD.length))
    } else if (arg === ARG_DEBUG) {
      ret.logging = LOG_DEBUG
    } else if (arg === ARG_VERBOSE) {
      ret.logging = LOG_VERBOSE
    } else if (arg === "--help" || arg === "-h") {
      ret.help = true
    } else {
      ret.problems.push(`Unknown argument: ${arg}`)
    }
  }
  if (
      ret.sources !== ''
      && ret.output !== ''
      && ret.problems.length <= 0
  ) {
    ret.okay = true
  } else {
    ret.help = true
  }
  if (ret.svgCmd.length <= 0) {
    ret.svgCmd = DEFAULT_SVG_CONVERT_CMD
  }
  if (ret.tempdir === '') {
    ret.tempdir = ret.output
  }
  return ret
}


function debug(text) {
  if (args.logging >= LOG_DEBUG) {
    console.debug(text)
  }
}

function verbose(text) {
  if (args.logging >= LOG_VERBOSE) {
    console.verbose(text)
  }
}

function log(text) {
  if (args.logging >= LOG_NORMAL) {
    console.log(text)
  }
}

function error(text) {
  console.error(text)
}