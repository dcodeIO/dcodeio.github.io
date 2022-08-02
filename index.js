var r = 2;
var w = 960;
var h = 960;
var s = w * h;

var mem = new WebAssembly.Memory({ initial: Math.ceil((24 + 2 * s) / 65536) });
var buf = new Uint8Array(mem.buffer, 24);

var cnv = document.createElement("canvas"); cnv.width = w * r; cnv.height = h * r;
var ctx = cnv.getContext("2d");

function resize(init) {
  r = Math.max(Math.ceil(Math.max(cnv.width = window.innerWidth, cnv.height = window.innerHeight) / 960), 2)|0;
  w = (window.innerWidth / r)|0;
  h = (window.innerHeight / r)|0;
  s = w * h;
  init(w, h);
}

function update(step) {
  buf.set(buf.subarray(s, 2 * s), 0);
  if (Math.random() < 0.0025) {
    var keys = Object.keys(structures);
    insert(structures[keys[(Math.random() * keys.length)|0]]);
  }
  step();
}

function render() {
  requestAnimationFrame(render);
  ctx.clearRect(0, 0, cnv.width, cnv.height);
  for (var y = 0; y < h; ++y)
    for (var x = 0, v; x < w; ++x)
      if (v = buf[s + w * y + x]) {
        ctx.fillStyle = "rgba(" + (v = 7 + (v>>2)) + "," + ((v*1.1)|0) + "," + ((v*1.2)|0) + ",1)";
        ctx.fillRect(x * r, y * r, r, r);
      }
}

function insert(struct) {
  var x = (Math.random() * w)|0;
  var y = (Math.random() * h)|0;
  var r = Math.random();
  for (var iy = 0; iy < struct.length; ++iy) {
    for (var ix = 0; ix < struct[iy].length; ++ix) {
      var dy = y + (r > 0.33 ? iy : struct.length - iy - 1);
      var dx = x + (r > 0.33 && r < 0.66 ? ix : struct[iy].length - ix - 1);
      buf[(dy % h) * w + dx % w] = struct[iy][ix] ? 255 : 0;
    }
  }
}

function start(init, step) {
  resize(init);
  window.addEventListener("resize", () => resize(init));
  setInterval(() => update(step), 33);
  render();
  document.body.appendChild(cnv);
  console.log("The Game of Life: A cellular automaton devised by the British mathematician John Horton Conway in 1970.");
}

fetch("index.wasm").then(response =>
  response.arrayBuffer()
).then(buffer =>
  WebAssembly.instantiate(buffer, { env: { memory: mem, Math_random: Math.random }})
).then(result => {
  start(result.instance.exports.init, result.instance.exports.step);
}).catch(err => {
  throw err;
});


var currentView = null;

function changeView() {
  if (currentView) {
    currentView.style.display = "none";
    currentView = null;
  }
  const view = document.getElementById(location.hash.substring(1));
  if (view) {
    view.style.display = "block";
    view.scrollTop = 0;
    currentView = view;
  } else {
    document.location.hash = "";
  }
}

addEventListener("hashchange", changeView);
addEventListener("load", changeView);

for (let view of document.getElementsByClassName("view")) {
  const x = document.createElement("a");
  x.href = "#";
  x.className = "x";
  x.innerHTML = "X";
  view.appendChild(x);
}
