#include <stdint.h>

#define import extern
#define export __attribute__((visibility ("default")))

uint32_t w; // 12
uint32_t h; // 16
uint32_t s; // 24

#define has(y,x)   (*((uint8_t*)(24     + w * y + x)) > 2)
#define get(y,x)   (*((uint8_t*)(24     + w * y + x))    )
#define set(y,x,v) (*((uint8_t*)(24 + s + w * y + x)) = v)

import float Math_random();

void fillX(float p) {
  uint32_t x, y;
  for (x = Math_random() * (float)w, y = 0; y < h; ++y)
    if (Math_random() < p)
      set(y, x, 255);
}

void fillY(float p) {
  uint32_t y, x;
  for (y = Math_random() * (float)h, x = 0; x < w; ++x)
    if (Math_random() < p)
      set(y, x, 255);
}

export void init(uint32_t w_, uint32_t h_) {
  w = w_;
  h = h_;
  s = w * h;
  fillX(0.5);
  fillY(0.5);
}

export void step() {
  uint32_t y, ym1, yp1, x, xm1, xp1, n, v;
  for (y = 0; y < h; ++y) {
    ym1 = y == 0 ? h - 1 : y - 1;
    yp1 = y == h - 1 ? 0 : y + 1;
    for (x = 0; x < w; ++x) {
      xm1 = x == 0 ? w - 1 : x - 1;
      xp1 = x == w - 1 ? 0 : x + 1;
      n = has(ym1, xm1) + has(ym1, x) + has(ym1, xp1)
        + has(y  , xm1)               + has(y  , xp1)
        + has(yp1, xm1) + has(yp1, x) + has(yp1, xp1);
      v = get(y, x);
      if (v)
        set(y, x, n >= 2 && n <= 3 ? v - 1 : 0);
      else if (n == 3)
        set(y, x, 255);
    }
  }
  float p = Math_random();
  if (p < 0.0025)
    fillY(0.5);
  else if (p < 0.005)
    fillX(0.5);
}
