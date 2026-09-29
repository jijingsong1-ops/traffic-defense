"use strict";

// 六首独立的小型配乐：MIDI 音高，null 为休止；八分音符为一个步进。
// 旋律、拍号、速度、和弦、节奏与音色分别配置，完全本地合成。
const MUSIC_TRACKS = {
  city: {
    name: "街灯", bpm: 112, meter: 8, voice: "square", gate: .62,
    melody: [64,null,67,71,69,67,64,null,62,64,67,null,71,74,71,67,64,67,69,71,null,69,67,64,62,null,59,62,64,null,67,null],
    bass: [40,45,36,43], chords: [[52,55,59],[57,60,64],[48,52,55],[55,59,62]], drums: [0,3,4,6]
  },
  country: {
    name: "麦风", bpm: 94, meter: 8, voice: "triangle", gate: .72,
    melody: [67,71,74,71,69,67,64,null,62,64,67,69,71,null,69,67,74,76,74,71,69,71,67,null,64,62,64,67,69,67,62,null],
    bass: [43,36,38,43], chords: [[55,59,62],[48,52,55],[50,54,57],[55,59,62]], drums: [0,4]
  },
  desert: {
    name: "沙影", bpm: 82, meter: 8, voice: "sine", gate: 1.3,
    melody: [62,null,63,66,69,null,70,69,66,63,62,null,57,null,62,null,69,70,74,null,73,70,69,66,63,null,62,57,58,57,54,null],
    bass: [38,34,33,38], chords: [[50,54,57],[46,50,53],[45,49,52],[50,54,57]], drums: [0,2,5,7]
  },
  hills: {
    name: "山行", bpm: 104, meter: 8, voice: "triangle", gate: .9,
    melody: [48,null,55,55,58,null,55,null,53,55,60,null,58,55,53,null,48,51,55,null,60,58,55,51,53,null,55,58,55,null,48,null],
    bass: [36,41,32,43], chords: [[48,51,55],[53,56,60],[44,48,51],[55,58,62]], drums: [0,2,4,6]
  },
  sea: {
    name: "潮歌", bpm: 90, meter: 6, voice: "sine", gate: 1.55,
    melody: [69,73,76,78,76,73,71,74,78,76,74,71,69,73,76,81,78,76,74,73,71,69,null,null,66,69,73,76,73,69,71,73,74,73,71,69],
    bass: [45,47,42,40,38,45], chords: [[57,61,64],[59,62,66],[54,57,61],[52,56,59],[50,54,57],[57,61,64]], drums: [0,3]
  },
  forest: {
    name: "萤火", bpm: 72, meter: 8, voice: "sine", gate: 1.8,
    melody: [76,null,79,null,83,79,null,74,76,null,null,71,74,null,79,null,83,null,86,83,null,79,76,null,74,null,71,null,67,71,null,null],
    bass: [40,36,43,38], chords: [[52,55,59],[48,52,55],[55,59,62],[50,54,57]], drums: [0]
  }
};
