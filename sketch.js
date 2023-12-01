const size = 256;
let exclusionThreshold = 2;
let maxAttempts = 1000;
let seedSize = 32;
let foodSize = 32;
let randomStimulus = true;
let speed = 16;
const targetFPS = 60;
const showFPS = true;
const consumeFood = true;

let grid = [];
let nextGrid = [];
let updated = [];
let stimulationPoints = [];
let frozen = true;
let scale;

function setup() {
  const canvasSize = floor(min(windowWidth, windowHeight));
  const c = createCanvas(canvasSize, canvasSize);
  c.parent("container");
  frameRate(targetFPS);
  scale = ceil(canvasSize / size);
  noStroke();
  textSize(16);
  for (let i = 0; i < size; i++) {
    grid.push(new Array(size).fill(0));
    nextGrid.push(new Array(size).fill(0));
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      updated.push([x, y]);
    }
  }
}

function draw() {
  if (!frozen) {
    for (let i = 0; i < speed; i++) {
      if (randomStimulus) {
        stimulateRandom();
      }
      stimulatePoint();
    }
  }

  let coords = updated.pop();
  while (coords) {
    fill(grid[coords[0]][coords[1]] * 100 + 50);
    square(coords[0] * scale, coords[1] * scale, scale);
    coords = updated.pop();
  }
  if (showFPS) {
    stroke(250);
    fill(0);
    rect(0, 0, 48, 32);
    text(floor(frameRate()) + "fps", 4, 22);
    noStroke();
  }
}

function keyPressed() {
  const x = floor(mouseX / scale);
  const y = floor(mouseY / scale);
  switch (keyCode) {
    case CONTROL:
      harden();
      break;
    case SHIFT:
      stimulateRandom();
      console.log(frameRate());
      break;
    case RETURN:
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          updated.push([x, y]);
        }
      }
      harden();
      frozen = !frozen;
      break;
    case OPTION:
      seed([x, y], seedSize);
      break;
    case TAB:
      neighbours([x, y]).forEach((coords) =>
        neighbours(coords).forEach((coords) =>
          addStimulationZone(coords, foodSize)
        )
      );
      break;
    case UP_ARROW:
      exclusionThreshold++;
      break;
    case DOWN_ARROW:
      exclusionThreshold--;
      break;
  }
}

function mouseDragged() {
  const x = floor(mouseX / scale);
  const y = floor(mouseY / scale);
  grid[x][y] = 2;
  updated.push([x, y]);
}

function mousePressed() {
  const x = floor(mouseX / scale);
  const y = floor(mouseY / scale);
  grid[x][y] = 0;
  updated.push([x, y]);
}
// returns the value of each neighbour in order
// [Left, Up, Right, Down]

// or -1 if at the edge of the grid
function neighbours([x, y]) {
  let neighbours = [];
  if (x > 0) neighbours.push([x - 1, y]);
  if (y > 0) neighbours.push([x, y - 1]);
  if (x < size - 1) neighbours.push([x + 1, y]);
  if (y < size - 1) neighbours.push([x, y + 1]);
  return neighbours;
}

function swapGrids() {
  const temp = grid;
  grid = nextGrid;
  nextGrid = temp;
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
  let coords, i;
  let attempts = 0;
  const l = stimulationPoints.length;
  if (l > 0) {
    do {
      attempts++;
      coordIdx = Math.floor(Math.random() * l);
      coords = stimulationPoints[coordIdx];
    } while (!stimulate(coords) && attempts < maxAttempts);
    if (consumeFood) {
      stimulationPoints.splice(coordIdx, 1);
    }
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

// calls callbackFn on all tiles in a diamond shape
function drawDiamond([x, y], radius, callbackFn) {
  for (let i = 0; i < radius; i++) {
    for (let j = 0; j < radius - i; j++) {
      if (x + i < size && y + j < size) {
        callbackFn([x + i, y + j]);
      }
      if (x + i < size && y - j >= 0) {
        callbackFn([x + i, y - j]);
      }
      if (x - i >= 0 && y + j < size) {
        callbackFn([x - i, y + j]);
      }
      if (x - i >= 0 && y - j >= 0) {
        callbackFn([x - i, y - j]);
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
