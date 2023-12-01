const size = 256;
const exclusionThreshold = 4;
const maxAttempts = 10000;
const seedSize = 8;
const foodSize = 32;
const randomStimulus = false;
const speed = 32;
const targetFPS = 60;

let grid = [];
let nextGrid = [];
let updated = [];
let stimulationPoints = [];
let frozen = true;
let scale;

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  const c = createCanvas(canvasSize, canvasSize);
  c.parent("container");
  frameRate(targetFPS);
  scale = canvasSize / size;
  noStroke();
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
}

function swapGrids() {
  const temp = grid;
  grid = nextGrid;
  nextGrid = temp;
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

// the main behaviour of the cell, taken from Gunji paper
function stimulate([x, y]) {
  // (1) check that site is in state 2
  if (grid[x][y] === 2) {
    // (2) randomly choose a neighbour in state 0, then swap
    let swapped = conditionalSwap([x, y], [0]);
    if (swapped) {
      updated.push([swapped[0], swapped[1]]);
      neighbours(swapped).forEach((neighbour) => updated.push(neighbour));
    } else {
      return false;
    }

    let moves = 0;
    while (true) {
      // (4) mark current site of bubble
      updated.push([x, y]);
      neighbours([x, y]).forEach((neighbour) => updated.push(neighbour));

      // (5) check if bubble has been excluded
      // (6) check if move count has been exceeded
      if (checkExcluded([x, y]) || moves > maxAttempts) break;

      // (7) swap bubble with neighbour in state 2
      swapped = conditionalSwap([x, y], [2, 1]);
      if (swapped) {
        moves++;
        grid[x][y] = 3;
        [x, y] = swapped;
      } else {
        break;
      }
    }

    // (8) reconstruct structure
    harden();
    return true;
  } else {
    return false;
  }
}

// stimulates a random cell
function stimulateRandom() {
  let xStim, yStim;
  do {
    xStim = floor(Math.random() * size);
    yStim = floor(Math.random() * size);
  } while (!stimulate([xStim, yStim]));
}

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
    // stimulationPoints.splice(coordIdx, 1);
  }
}

// checks if a bubble has enough 0 neighbours to be considered excluded from a cell
function checkExcluded([x, y]) {
  const zeroNeighbourCount = neighbours([x, y]).filter(
    (coords) => grid[coords[0]][coords[1]] === 0
  ).length;
  return zeroNeighbourCount >= exclusionThreshold;
}

// swaps (x, y) with a random neighbour with given state.
// returns coordinates of the swap, or false if no swap.
function conditionalSwap([x, y], states) {
  let swapDirections = [];
  if (x > 0 && states.includes(grid[x - 1][y])) {
    swapDirections.push([-1, 0]);
  }
  if (x < size - 1 && states.includes(grid[x + 1][y])) {
    swapDirections.push([1, 0]);
  }
  if (y > 0 && states.includes(grid[x][y - 1])) {
    swapDirections.push([0, -1]);
  }
  if (y < size - 1 && states.includes(grid[x][y + 1])) {
    swapDirections.push([0, 1]);
  }
  if (swapDirections.length === 0) {
    return false;
  }
  direction = swapDirections[Math.floor(Math.random() * swapDirections.length)];
  const newX = x + direction[0];
  const newY = y + direction[1];
  grid[newX][newY] = grid[x][y];
  grid[x][y] = states[0];
  return [newX, newY];
}

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

// creates a diamond-shaped cell of size seedSize at (x, y)
function seed([x, y], radius) {
  drawDiamond([x, y], radius, ([x, y]) => {
    grid[x][y] = 2;
    updated.push([x, y]);
  });
  harden();
}

function addStimulationZone([x, y], radius) {
  fill("rgba(0, 255, 0, 0.1)");
  drawDiamond([x, y], radius, ([x, y]) => {
    stimulationPoints.push([x, y]);
    square(x * scale, y * scale, scale);
  });
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
      console.log(grid);
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
      console.log(stimulationPoints.length);
      break;
  }
}
