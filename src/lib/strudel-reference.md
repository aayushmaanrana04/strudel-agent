# Strudel.cc Syntax Reference

## Mini Notation (Pattern Language)

Strings in double quotes `"..."` are parsed as mini notation.

| Symbol | Name | Example | Description |
|--------|------|---------|-------------|
| ` ` | Sequence | `"bd sd hh cp"` | Events distributed evenly in one cycle |
| `[ ]` | Group | `"bd [hh hh] sd cp"` | Nest events into one time slot |
| `< >` | Alternate | `"<bd sd hh>"` | One element per cycle, rotating |
| `*N` | Multiply | `"hh*4"` | Repeat N times in its slot |
| `/N` | Divide | `"[bd sd]/2"` | Stretch across N cycles |
| `~` | Rest | `"bd ~ sd ~"` | Silence |
| `,` | Stack | `"bd sd, hh*4"` | Play simultaneously |
| `@N` | Elongate | `"c@3 e"` | Set temporal weight |
| `!N` | Replicate | `"bd!3 sd"` | Duplicate without speeding up |
| `?` | Random drop | `"hh*8?"` | 50% chance of silence |
| `\|` | Random choice | `"bd \| sd \| cp"` | Pick one at random |
| `(b,s)` | Euclidean | `"bd(3,8)"` | b beats over s steps |
| `(b,s,o)` | Euclidean+offset | `"bd(3,8,2)"` | With rotation |
| `_` | Extend | `"c _ e _"` | Sustain previous event |
| `:N` | Sample index | `"hh:0 hh:1 hh:2"` | Select variant |

## Core Functions

```js
s("bd sd hh cp")              // trigger samples by name
note("c4 e4 g4")              // pitch by letter+octave or MIDI number
n("0 2 4").scale("C:minor")   // scale degree (zero-indexed)
freq("220 330 440")           // direct frequency in Hz
```

## Pattern Combinators

```js
stack(s("bd sd"), s("hh*4"))           // play simultaneously
cat(s("bd sd"), s("hh*4"))            // one per cycle, alternating
seq(s("bd"), s("sd"), s("hh"))        // all squeezed into one cycle
arrange([4, s("bd sd")], [2, s("cp*4")]) // multi-cycle sequencing
```

`$:` prefix plays independent parallel patterns:
```js
$: s("bd sd, hh*4").bank("RolandTR808")
$: note("c3 eb3 g3").s("piano")
```

## Transformations

### Speed/Time
```js
.fast(2)  .slow(2)  .hurry(2)  .early(0.25)  .late(0.125)
.cpm(90)  .swing(4)
```

### Reversal/Rotation
```js
.rev()  .palindrome()  .iter(4)  .iterBack(4)
```

### Structural
```js
.struct("x ~ x ~ ~ x ~ x")  .mask("<1 [0 1]>")
.euclid(3,8)  .euclidRot(3,8,2)  .compress(0.25,0.75)
.segment(16)  .ply(2)
```

### Conditional
```js
.firstOf(4, x => x.rev())     // every 4th cycle
.lastOf(4, x => x.rev())
.sometimes(x => x.speed(2))   // 50% chance
.often(...)  .rarely(...)  .almostAlways(...)
.someCycles(x => x.fast(2))
.degrade()  .degradeBy(0.2)
```

### Layering
```js
.superimpose(x => x.add(7))   // layer original + transformed
.off(1/8, x => x.add(7))      // superimpose shifted in time
.jux(rev)                      // original left, transformed right
.juxBy(0.5, rev)               // adjustable stereo width
.add(7)  .sub(5)               // transpose
```

### Repetition
```js
.echo(3, 1/6, 0.8)            // echoes, time gap, decay
.ply(2)                        // repeat each event in its slot
```

## Effects

### Filters
```js
.lpf(2000)  .lpq(10)          // low-pass + resonance
.hpf(200)   .hpq(10)          // high-pass + resonance
.bpf(1000)  .bpq(2)           // band-pass
.vowel("<a e i o u>")         // formant filter
```

### Envelope (ADSR)
```js
.attack(0.01)  .decay(0.1)  .sustain(0.5)  .release(0.2)
```

### Dynamics
```js
.gain(0.8)  .velocity(0.5)  .postgain(1.5)
```

### Distortion
```js
.crush(4)  .coarse(8)  .shape(0.5)  .distort(3)
```

### Spatial
```js
.pan(0.5)                      // 0=left, 0.5=center, 1=right
.delay(0.5)  .delaytime(0.25)  .delayfeedback(0.7)
.room(0.5)  .roomsize(4)
```

### Shorthand
```js
.delay(".65:.25:.9")           // level:time:feedback
.room("0.9:4")                // level:size
```

## Sound Sources

### Oscillators
```js
note("c3").s("sine")       // sine, sawtooth, square, triangle
```

### FM Synthesis
```js
note("c2").s("sine").fm(4).fmh(2).fmdecay(0.2)
```

### Noise
```js
s("white")  s("pink")  s("brown")
```

### Common Drum Samples
`bd` (kick), `sd` (snare), `hh` (hihat), `oh` (open hat), `cp` (clap), `cb` (cowbell), `rim` (rimshot), `cr` (crash), `rd` (ride), `ht` `mt` `lt` (toms)

### Banks
```js
.bank("RolandTR808")  .bank("RolandTR909")  .bank("RolandTR707")
```

### GM Soundfonts
```js
note("c4").s("gm_acoustic_grand_piano")
note("c3").s("gm_acoustic_bass")
note("c4").s("gm_xylophone")
```

### Sample Controls
```js
.speed(2)  .speed("-1")        // playback speed (negative=reverse)
.begin(0.25)  .end(0.75)      // start/end points
.loopAt(2)  .fit()             // fit sample to cycles
.cut(1)                        // cut group (hi-hat choke)
.chop(4)  .slice(8, "0 1 2 3 4 5 6 7")
```

## Scales and Music Theory

```js
n("0 1 2 3").scale("C:major")
n("0 2 4").scale("A:minor")
note("c e g").transpose(7)
n("0 2 4").scale("C:major").scaleTranspose(2)
```

Common scales: `major`, `minor`, `dorian`, `mixolydian`, `lydian`, `phrygian`, `minor:pentatonic`, `major:pentatonic`, `blues`, `harmonic:minor`, `chromatic`, `whole:tone`

### Chords
```js
chord("<C^7 Dm7 G7>").voicing().s("piano")
```

## Signals (Continuous Patterns)

```js
sine  cosine  saw  tri  square     // 0-1 range
rand  irand(8)  perlin             // random
sine.range(200, 2000)              // remap range
saw.range(0, 7).segment(8)        // discretize
```

Usage:
```js
s("hh*16").gain(sine)
s("hh*16").lpf(saw.range(200, 4000))
```

## Tempo

```js
setcpm(30)         // cycles per minute (default 30)
setcpm(120/4)      // 120 BPM in 4/4
.cpm(90)           // per-pattern tempo
```

## Working Examples

```js
// Basic beat
s("bd sd [~ bd] sd, hh*8").bank("RolandTR909")

// Melodic with effects
note("c3 [eb3,g3] bb2 [g2,bb2]")
  .s("sawtooth").lpf(sine.range(400,4000).slow(4)).room(0.3)

// Layered composition
setcpm(120/4)
$: s("bd [~ bd] sd [bd ~], [~ hh]*4").bank("RolandTR808")
$: note("<c2 bb1 f2 eb2>").s("sawtooth").lpf(400).gain(0.6)
$: n("0 2 4 <[6,8] [7,9]>").scale("C:minor").s("piano").room(0.3)

// Euclidean polyrhythm
stack(
  s("bd").euclid(3,8),
  s("sd").euclid(5,8),
  s("hh").euclid(7,8).gain(0.5)
).bank("RolandTR808")

// Evolving pattern
n("0 [2 4] <3 5> [~ <4 1>]").scale("C:minor").s("piano")
  .off(1/8, x => x.add(7).s("triangle").gain(0.3))
  .firstOf(4, rev).room(0.4)

// Generative
n(irand(8)).struct("x(5,8)").scale("D:minor:pentatonic")
  .s("gm_xylophone").sometimes(x => x.add(7)).room(0.5)
```
