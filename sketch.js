let size = 512;
let exclusionThreshold = 3;
let maxMoves = 10000;
let seedSize = 64;
let randomStimulus = true;

let grid = [];
let nextGrid = [];
let toDraw = [];
let stimulusCandidates = [];
let frozen = true;
let scale;

let timing = {
  draw: 0,
  calc: 0
}

function setup() {
  let canvasSize = min(windowWidth, windowHeight);
  let c = createCanvas(canvasSize, canvasSize);
  c.parent("container");
  frameRate(60);
  scale = canvasSize / size;
  noStroke();
  for (let i = 0; i < size; i++) {
    grid.push(new Array(size).fill(0));
    nextGrid.push(new Array(size).fill(0));
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      toDraw.push([x, y]);
    }
  }
}

function draw() {
  if (!frozen && randomStimulus) {
    for (let i = 0; i < 16; i++) {
      stimulateRandom()
    }
  };

  let coords = toDraw.pop();
  while(coords) {
    fill(grid[coords[0]][coords[1]]*100+50);
    square(coords[0]*scale, coords[1]*scale, scale);
    coords = toDraw.pop();
  }
  
}

function swapGrids() {
  let temp = grid;
  grid = nextGrid;
  nextGrid = temp;
}

// returns the value of each neighbour in order
// [Left, Up, Right, Down]
// or -1 if at the edge of the grid
function neighbours(x, y) {
  let neighbours = [-1, -1, -1, -1];
  if (x > 0) neighbours[0] = grid[x-1][y];
  if (y > 0) neighbours[1] = grid[x][y-1];
  if (x < size-1) neighbours[2] = grid[x+1][y];
  if (y < size-1) neighbours[3] = grid[x][y+1];
  return neighbours;
}


function mouseDragged() {
  let x = floor(mouseX/scale);
  let y = floor(mouseY/scale);
  grid[x][y] = 2;
  toDraw.push([x, y]);
}

function mousePressed() {
  let x = floor(mouseX/scale);
  let y = floor(mouseY/scale);
  grid[x][y] = 0;
  toDraw.push([x, y]);
}

// forms cell inside/walls
function harden() {
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      let state = grid[x][y];
      if (
        (state >= 2) &&
        neighbours(x, y).every((state) => state >= 2))
      {
        nextGrid[x][y] = 1
      } else {
        nextGrid[x][y] = min(state, 2);
      }
      if (randomStimulus && nextGrid[x][y] === 2) {
        stimulusCandidates.push([x, y]);
      }
    }
  }
  swapGrids();
}

// the main behaviour of the cell, taken from Gunji paper
function stimulate(x, y) {
  // (1) check that site is in state 2
  if (grid[x][y] === 2) {
    
    // (2) randomly choose a neighbour in state 0, then swap
    let swapped = conditionalSwap(x, y, 0);
    if (swapped) {
      toDraw.push([swapped[0], swapped[1]]);
    } else {
      return;
    }
    
    // (3) set all state 1 sites to state 2
    hardenAll();
    let moves = 0;
    while (true) {
      
      // (4) mark current site of bubble
      toDraw.push([x, y]);
      
      // (5) check if bubble has been excluded
      if (checkExcluded(x, y)) break;
      
      // (6) check if move count has been exceeded
      if (moves > maxMoves) {
        break;
      }
      
      // (7) swap bubble with neighbour in state 2
      swapped = conditionalSwap(x, y, 2);
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
  } else {
    return false;
  }
}

// stimulates a random cell
function stimulateRandom() {
  let coords = stimulusCandidates[Math.floor(Math.random()*stimulusCandidates.length)];
  if (coords) {
    stimulusCandidates = [];
    stimulate(coords[0], coords[1]);
  }
}

// stimulates a random cell
// function stimulateRandom() {
//   let xStim, yStim;
//   do {
//     xStim = floor(Math.random() * size);
//     yStim = floor(Math.random() * size);
//   } while (!stimulate(xStim, yStim));
// }

// sets all cell sites to hardened state
function hardenAll() {
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (grid[x][y] === 1) {
        grid[x][y] = 2;
      }
    }
  }
}

// checks if a bubble has enough 0 neighbours to be considered excluded from a cell
function checkExcluded(x, y) {
  let zeroNeighbourCount = 
      neighbours(x, y).filter(
        (state) => state === 0
      ).length;
  return zeroNeighbourCount >= exclusionThreshold;
}

// swaps (x, y) with a random neighbour with given state.
// returns coordinates of the swap, or false if no swap.
function conditionalSwap(x, y, state) {
  let swapDirections = [];
  if (x > 0 && grid[x-1][y] === state) {
    swapDirections.push([-1, 0])
  }
  if (x < size-1 && grid[x+1][y] === state) {
    swapDirections.push([1, 0]);
  }
  if (y > 0 && grid[x][y-1] === state) {
    swapDirections.push([0, -1]);
  }
  if (y < size-1 && grid[x][y+1] === state) {
    swapDirections.push([0, 1]);
  }
  if (swapDirections.length === 0) {
    return false;
  }
  direction = swapDirections[
    Math.floor(Math.random()*swapDirections.length)
  ];
  let newX = x+direction[0];
  let newY = y+direction[1];
  grid[newX][newY] = grid[x][y];
  grid[x][y] = state;
  return [newX, newY];
}

// creates a cell of size seedSize at (x, y)
function seed(x, y) {
  for (let i = 0; i < seedSize; i++) {
    for (let j = 0; j < seedSize; j++) {
      grid[x+i][y+j] = 2;
      toDraw.push([x+i, y+j]);
      grid[x+i][y-j] = 2;
      toDraw.push([x+i, y-j]);
      grid[x-i][y+j] = 2;
      toDraw.push([x-i, y+j]);
      grid[x-i][y-j] = 2;
      toDraw.push([x-i, y-j]);
    }
  }
}

function keyPressed() {
  switch (keyCode) {
    case CONTROL:
      harden();
      break;
    case SHIFT:
      stimulate(floor(mouseX/scale), floor(mouseY/scale));
      console.log(frameRate())
      break;
    case RETURN:
      harden();
      frozen = !frozen;
      console.log(timing);
      break;
    case OPTION:
      seed(floor(mouseX/scale), floor(mouseY/scale));
  }
}
