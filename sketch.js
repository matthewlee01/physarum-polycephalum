// --- INPUT PARAMS --- //
const size = 256;
let maxAttempts = 8192;
const targetFPS = 60;
const shaderRender = true;
let dynamicStimulationZones = true;

let transition = 1;

let temperature = 0.5;
let temperature_p = 0.5;
let temperature_n = 0.5;

let pressure = 0.5;
let pressure_p = 0.5;
let pressure_n = 0.5;

let moisture = 0.5;
let moisture_p = 0.5;
let moisture_n = 0.5;

let ts = 0;
let ps = 0;
let ws = 0;
let hs = 0;
let c = 0;

let stimulationRigidity = 64;
let exclusionThreshold = 3;
let speed = 32;
let stimulationSize = 16;
let volatility = 8;
let randomFactor = 0.6;

const MIN_STIMULATION_RIGIDITY = 12;
const MAX_STIMULATION_RIGIDITY = 48;
const MIN_EXCLUSION_THRESHOLD = 1.9;
const MAX_EXCLUSION_THRESHOLD = 4.3;
const MIN_SPEED = 8;
const MAX_SPEED = 64;
const MIN_STIMULATION_SIZE = 4;
const MAX_STIMULATION_SIZE = 32;
const MIN_VOLATILITY = 4;
const MAX_VOLATILITY = 12;
const MIN_RANDOM_FACTOR = 0.4;
const MAX_RANDOM_FACTOR = 1;

let t = 0;
let drawRadius;
let grid = [];
let nextGrid = [];
let updated = [];
let stimulationPoints = [];
let stimulationSeeds = [
  { x: size / 4, y: size / 2, dx: 4, dy: 1 },
  { x: size / 4, y: size / 4, dx: 2, dy: 8 },
  { x: size / 2, y: size / 2, dx: 8, dy: 4 },
];
let frozen = true;
let font, scale, gridShader, g1, g2, blurH, blurV, img, noise;

function preload() {
  if (shaderRender) {
    noise = loadImage("blue470.png");
    gridShader = loadShader("shader.vert", "shader.frag");
    blurH = loadShader("shader.vert", "blur.frag");
    blurV = loadShader("shader.vert", "blur.frag");
  }
  const socket = io("http://localhost:3000");
  socket.on("connect", () => {
    console.log("connected");
  });

  socket.on("message", (data) => {
    console.log(data)
    transition = 0;
    temperature_p = temperature;
    temperature_n = max(0, min(1, data.temperature + temperature));
    pressure_p = pressure;
    pressure_n = max(0, min(1, data.pressure + pressure));
    moisture_p = moisture;
    moisture_n = max(0, min(1, data.moisture + moisture));
    socket.emit("status", {temperature: temperature_n, pressure: pressure_n, moisture: moisture_n})
  });
}

function setup() {
  let canvasSize = 1024;
  if (shaderRender) {
    createCanvas(canvasSize, canvasSize, WEBGL);
    g1 = createGraphics(canvasSize, canvasSize, WEBGL);
    g2 = createGraphics(canvasSize, canvasSize, WEBGL);
  } else {
    createCanvas(canvasSize, canvasSize);
  }
  frameRate(targetFPS);
  scale = ceil(canvasSize / size);
  drawRadius = floor(size / 24);
  noStroke();
  textSize(16);
  for (let i = 0; i < size; i++) {
    grid.push(new Array(size).fill(0));
    nextGrid.push(new Array(size).fill(0));
  }
  if (shaderRender) {
    img = createImage(size, size);
  }
  updateAll();
}

function draw() {
  updateEnvironment();
  runStimulations();
  if (shaderRender) {
    renderShader();
  } else {
    renderGrid();
  }

  updated = [];
}

function keyPressed() {
  switch (keyCode) {
    case TAB:
      stimulateRandom();
      break;
    case RETURN:
      console.log(frameRate());
      console.log("temp", ts / c);
      console.log("humi", hs / c);
      console.log("pres", ps / c);
      console.log(c);
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          updated.push([x, y]);
        }
      }
      harden();
      frozen = !frozen;
      break;
    case UP_ARROW:
      drawRadius++;
      break;
    case DOWN_ARROW:
      drawRadius--;
      break;
    case BACKSPACE:
      fullscreen(!fullscreen());
  }
}

function mouseDragged() {
  drawMouse();
}

function mouseClicked() {
  drawMouse();
}

function drawMouse() {
  const x = floor(mouseX / scale);
  const y = floor(mouseY / scale);
  if (keyIsDown(SHIFT)) {
    addStimulationZone([x, y], drawRadius);
  } else {
    drawDiamond([x, y], drawRadius, ([x, y]) => {
      grid[x][y] = 2;
      updated.push([x, y]);
    });
  }
}

// renders the grid with shaders
function renderShader() {
  img.loadPixels();
  let coords = updated.pop();
  let value, x, y, i;
  while (coords) {
    [x, y] = coords;
    i = 4 * (size * y + x);
    value = 80 * pow(grid[x][y], 1.5);
    img.pixels[i] = value;
    img.pixels[i + 1] = value;
    img.pixels[i + 2] = value;
    img.pixels[i + 3] = 255;
    coords = updated.pop();
  }
  img.updatePixels();

  // horizontal blur
  g1.shader(blurH);
  blurH.setUniform("tex0", img);
  blurH.setUniform("texelSize", [1.0 / width, 1.0 / height]);
  blurH.setUniform("direction", [0.4+(1-pressure)*0.6, 0.0]);

  g1.rect(0, 0, width, height);

  // vertical blur
  g2.shader(blurV);
  blurV.setUniform("tex0", g1);
  blurV.setUniform("texelSize", [1.0 / width, 1.0 / height]);
  blurV.setUniform("direction", [0.0, 0.4+(1-pressure)*0.6]);

  g2.rect(0, 0, width, height);
  gridShader.setUniform("u_grid", g2);
  gridShader.setUniform("u_noise", noise);

  gridShader.setUniform("u_temperature", temperature);
  gridShader.setUniform("u_pressure", pressure);
  gridShader.setUniform("u_moisture", moisture);

  shader(gridShader);
  rect(0, 0, width, height);
  // if (frameRate() < 20) {
  //   ts += temperature;
  //   hs += moisture;
  //   ps += pressure;
  //   c++;

  // }
}

// manually renders the grid (no shaders)
function renderGrid() {
  let coords = updated.pop();
  while (coords) {
    fill(grid[coords[0]][coords[1]] * 100 + 50);
    square(coords[0] * scale, coords[1] * scale, scale);
    coords = updated.pop();
  }

  for ([x, y] of stimulationPoints) {
    fill("rgba(0, 255, 0, 0.1)");
    square(x * scale, y * scale, scale);
  }

  renderFPS();
}

function renderFPS() {
  stroke(250);
  fill(0);
  rect(0, 0, 48, 32);
  text(floor(frameRate()) + "fps", 4, 22);
  noStroke();
}

// returns the coordinates of each neighbour
function neighbours([x, y]) {
  let neighbours = [];
  if (x > 1) neighbours.push([x - 1, y]);
  if (y > 1) neighbours.push([x, y - 1]);
  if (x < size - 1) neighbours.push([x + 1, y]);
  if (y < size - 1) neighbours.push([x, y + 1]);
  return neighbours;
}

function swapGrids() {
  const temp = grid;
  grid = nextGrid;
  nextGrid = temp;
}

function updateEnvironment() {
  // temperature = 0.5 + 0.5 * sin(millis() * 5 * 0.00004);
  // moisture = 0.75 + 0.25 * sin(millis() * 7 * 0.00002);
  // pressure = 0.75 + 0.25 * sin(millis() * 11 * 0.00002);
  if (transition < 1) {
    transition += 0.01;
    temperature = lerp(temperature_p, temperature_n, transition);
    moisture = lerp(moisture_p, moisture_n, transition);
    pressure = lerp(pressure_p, pressure_n, transition);
  }

  stimulationRigidity = floor(
    map(
      2 * pressure - moisture,
      -1,
      2,
      MIN_STIMULATION_RIGIDITY,
      MAX_STIMULATION_RIGIDITY
    )
  );
  exclusionThreshold = map(
    4 * pressure - temperature,
    -1,
    4,
    MIN_EXCLUSION_THRESHOLD,
    MAX_EXCLUSION_THRESHOLD
  );
  speed = map(
    2 * temperature + 2 * pressure - moisture,
    -1,
    4,
    MIN_SPEED,
    MAX_SPEED
  );
  stimulationSize = map(
    3 * pressure + moisture,
    0,
    4,
    MIN_STIMULATION_SIZE,
    MAX_STIMULATION_SIZE
  );
  volatility = map(
    temperature - 2 * moisture,
    -2,
    1,
    MIN_VOLATILITY,
    MAX_VOLATILITY
  );
  randomFactor = map(
    temperature + pressure,
    0,
    2,
    MIN_RANDOM_FACTOR,
    MAX_RANDOM_FACTOR
  );
}

// forms cell inside/walls
function harden() {
  let i = 0;
  while (i < updated.length) {
    const [x, y] = updated[i];
    const state = grid[x][y];
    const neighbourhood = neighbours([x, y]);
    let nextState;
    if (
      state >= 2 &&
      neighbourhood.every((coords) => grid[coords[0]][coords[1]] > 0)
    ) {
      nextState = 1;
    } else {
      nextState = min(state, 2);
    }
    if (state != nextState) {
      neighbourhood.forEach((neighbour) => updated.push(neighbour));
    }
    grid[x][y] = nextState;
    nextGrid[x][y] = nextState;

    i++;
  }
  swapGrids();
}

// the main behaviour of the cell - propogates a "bubble" through the cell
// rules:
// ( 1 ) bubble moves through the cell 1 square at a time
// ( 2 ) bubble cannot move through a cell it has already visited
// ( 3 ) bubble stops moving when:
//       ( a ) bubble has left the cell
//       ( b ) bubble has no valid cell to move to
//       ( c ) bubble movement exceeds maximum move count
function stimulate([x, y]) {
  if (grid[x][y] !== 2) {
    return false;
  }
  let swapped = randomSwap([x, y], [0]);
  if (swapped) {
    updated.push([swapped[0], swapped[1]]);
    neighbours(swapped).forEach((neighbour) => updated.push(neighbour));
  } else {
    return false;
  }
  let moves = 0;
  while (true) {
    updated.push([x, y]);
    neighbours([x, y]).forEach((neighbour) => updated.push(neighbour));

    if (checkExcluded([x, y]) || moves > maxAttempts) break;

    swapped = randomSwap([x, y], [2, 1]);
    if (swapped) {
      moves++;
      grid[x][y] = 3;
      [x, y] = swapped;
    } else {
      break;
    }
  }
  harden();
  return true;
}

// stimulates a random cell
function stimulateRandom() {
  let xStim, yStim;
  do {
    xStim = floor(Math.random() * size);
    yStim = floor(Math.random() * size);
  } while (!stimulate([xStim, yStim]));
}

// stimulates a random cell within a stimulation zone
function stimulatePoint() {
  let coords;
  let attempts = 0;
  let i;
  let l = stimulationPoints.length;
  let found = false;
  if (l > 0) {
    while (attempts < maxAttempts && found === false) {
      i = Math.floor(Math.random() * l);
      coords = stimulationPoints[i];
      found = stimulate(coords);
      attempts++;
    }
  }
  return maxAttempts === attempts;
}

function runStimulations() {
  if (!frozen) {
    for (let i = 0; i < speed * (1 - randomFactor); i++) {
      stimulatePoint();
    }
    for (let i = 0; i < speed * randomFactor; i++) {
      stimulateRandom();
    }
    if (dynamicStimulationZones) {
      updateStimulationZone();
    }

    t++;
  }
}

// checks if a bubble has enough 0 neighbours to be considered excluded from a cell
function checkExcluded([x, y]) {
  const zeroNeighbourCount = neighbours([x, y]).filter(
    (coords) => grid[coords[0]][coords[1]] === 0
  ).length;
  return zeroNeighbourCount >= exclusionThreshold;
}

// swaps (x, y) with a random neighbour with in any of the given states.
// returns coordinates of the swap, or false if no swap.
function randomSwap([x, y], states) {
  const eligibleNeighbours = neighbours([x, y]).filter(([x, y]) =>
    states.includes(grid[x][y])
  );
  if (eligibleNeighbours.length > 0) {
    const [swapX, swapY] =
      eligibleNeighbours[Math.floor(Math.random() * eligibleNeighbours.length)];
    const temp = grid[swapX][swapY];
    grid[swapX][swapY] = grid[x][y];
    grid[x][y] = temp;
    return [swapX, swapY];
  } else {
    return false;
  }
}

function updateAll() {
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      updated.push([x, y]);
    }
  }
}

// calls callbackFn on all tiles in a diamond shape
function drawDiamond([x, y], radius, callbackFn) {
  callbackFn([x, y]);
  for (let i = 0; i < radius; i++) {
    for (let j = 0; j < radius - i; j++) {
      if (j > 0) {
        if (x + i < size && y + j < size) {
          callbackFn([x + i, y + j]);
        }
        if (x - i >= 0 && y - j >= 0) {
          callbackFn([x - i, y - j]);
        }
      }
      if (i > 0) {
        if (x - i >= 0 && y + j < size) {
          callbackFn([x - i, y + j]);
        }
        if (x + i < size && y - j >= 0) {
          callbackFn([x + i, y - j]);
        }
      }
    }
  }
}

// creates a diamond-shaped cell centred at (x, y)
function seed([x, y], radius) {
  drawDiamond([x, y], radius, ([x, y]) => {
    grid[x][y] = 2;
    updated.push([x, y]);
  });
  harden();
}

// creates a diamond-shaped stimulation zone centred at (x, y)
function addStimulationZone([x, y], radius) {
  fill("rgba(0, 255, 0, 0.1)");
  drawDiamond([x, y], radius, ([x, y]) => {
    stimulationPoints.push([x, y]);
    square(x * scale, y * scale, scale);
  });
}

// move the dynamic stimulation areas
function updateStimulationZone() {
  if (t % stimulationRigidity === 0) {
    stimulationPoints = [];
    stimulationSeeds.forEach((seed) => {
      drawDiamond([seed.x, seed.y], stimulationSize, ([x, y]) => {
        stimulationPoints.push([
          min(
            max(floor(x - volatility / 2 + Math.random() * volatility), 0),
            size - 1
          ),
          min(
            max(floor(y - volatility / 2 + Math.random() * volatility), 0),
            size - 1
          ),
        ]);
      });

      if (seed.x + seed.dx >= size || seed.x + seed.dx < 0) {
        seed.dx = -seed.dx;
      }
      if (seed.y + seed.dy >= size || seed.y + seed.dy < 0) {
        seed.dy = -seed.dy;
      }

      seed.x = floor(seed.x + seed.dx);
      seed.y = floor(seed.y + seed.dy);
      seed.dx = seed.dx - volatility / 2 + Math.random() * volatility;
      seed.dy = seed.dy - volatility / 2 + Math.random() * volatility;
    });
  }
}
