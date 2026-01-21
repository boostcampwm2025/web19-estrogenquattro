// 음악 리스트
export const TRACKS = [
  {
    id: "1",
    title: "Ice Cave",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/8_bit_ice_cave_lofi.mp3",
  },
  {
    id: "2",
    title: "A Cup of Tea",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/A cup of tea.mp3",
  },
  {
    id: "3",
    title: "Bartender",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/Bartender.mp3",
  },
  {
    id: "4",
    title: "Cat Caffe",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/Cat caffe.mp3",
  },
  {
    id: "5",
    title: "Chill Lofi R",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/ChillLofiR.mp3",
  },
  {
    id: "6",
    title: "Countryside",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/Countryside.mp3",
  },
  {
    id: "7",
    title: "Cue",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/Cue.mp3",
  },
  {
    id: "8",
    title: "Florist",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/Florist.mp3",
  },
  {
    id: "9",
    title: "Lofi Loop",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/LofiLoop.mp3",
  },
  {
    id: "10",
    title: "Morning Rain",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/Morning rain.mp3",
  },
  {
    id: "11",
    title: "Oceanside",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/Oceanside.mp3",
  },
  {
    id: "12",
    title: "Rainy Forest",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/Rainy Forest.mp3",
  },
  {
    id: "13",
    title: "Lofi Hiphop",
    artist: "Lo-Fi",
    src: "/assets/music/lo-fi/lofihiphop.mp3",
  },
] as const;

// 반복 모드 상수
export const LOOP_MODES = {
  OFF: "OFF",
  ALL: "ALL",
  ONE: "ONE",
} as const;

// localStorage 키 상수
export const STORAGE_KEYS = {
  VOLUME: "musicPlayer_volume",
  LOOP_MODE: "musicPlayer_loopMode",
  LAST_TRACK_ID: "musicPlayer_lastTrackId",
} as const;
