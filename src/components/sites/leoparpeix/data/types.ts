export interface Link {
  name?: string;
  text?: string;
  url?: string;
}

export interface Agency {
  name: string;
  url?: string;
}

export interface CameraParams {
  /** Optional end of a header path, before the camera reaches its scene's floor. */
  scrollProgressMax?: number;
  scrollRangePosition: Vec3;
  scrollRangeRotation: Vec3;
  scrollOffsetPosition: Vec3;
  scrollOffsetRotation: Vec3;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface HeaderContent {
  description: string;
  scrollIndication: string;
  cameraParams: CameraParams;
}

export interface SliderProject {
  title?: string;
  cursorIndication: string;
  sectionType: "slider";
  projectIndex: number;
  mediasCount: number;
  name: string;
  type: string;
  recognitions?: string[];
  date: string;
  team: { text: string; agency: Agency };
  projectLink?: { text: string; url: string };
  roles: { text: string; items: string[] };
}

export interface WebglSection {
  sectionType: "webgl";
  textLines: string[];
  cameraParams: CameraParams;
}

export type ProjectSection = SliderProject | WebglSection;

export interface ArchiveMedia {
  url?: string;
  url2?: string;
  isVideo: boolean;
}

export interface ArchiveItem {
  name: string;
  type: string;
  roles: string;
  date: string;
  agency: Agency;
  infos: string[];
  projectLink?: { text: string; url: string };
  media?: ArchiveMedia;
}

export interface HomeContent {
  header: HeaderContent;
  hero: {
    titles: string[];
    titlesReveal: string[];
    indication: string;
    city: string;
    textAgency: string[];
    textFormer: string;
    agencies: Agency[];
  };
  intro: {
    bigTexts: string[];
    smallTexts: string[];
    urlReel: string;
    urlReelPreview: string;
    urlReelPoster: string;
    cursorIndication: string;
  };
  projects: ProjectSection[];
  archives: { title: string; cursorIndication: string; items: ArchiveItem[] };
}

export interface AboutContent {
  header: HeaderContent;
  hero: {
    titles: string[];
    titlesReveal: string[];
    indication: string;
    infosLeft: string;
    infosCenter: string;
    infosRight: string;
  };
  intro: { imageUrl: string; place: string; date: string; credit: string; texts: string[] };
  flowers: { text1: string; lines: string[]; text2: string };
  cards: {
    experiences: {
      indication: string;
      title: string;
      jobs: { date: string; agency: { name: string; roles: string; currentText?: string } }[];
    };
    cameraParams: CameraParams;
  };
  content: {
    titleText: string;
    imageUrl: string;
    texts: string[];
    recognitions: { title: string; awards: { name: string; number?: number }[] };
    clients: { title: string; names: string[] };
  };
}

export interface PlaygroundMedia {
  url: string;
  url2?: string;
  isVideo?: boolean;
  title: string;
  date: string;
  parallaxAmount: number;
}

export interface PlaygroundContent {
  /** 3D header over the crystal daisy pavilion (playground addition, see webgl/env/crystal/). */
  header: HeaderContent;
  hero: { titles: string[]; titlesReveal: string[]; indication: string; text: string };
  content: { medias: PlaygroundMedia[]; paragraph?: string }[];
}

export interface BeeTexts {
  idle: string[];
  hover: string[];
  conversation: { id: string; lines: string[] }[];
}

export interface GlobalContent {
  title: string;
  infos: string;
  navbar: { links: string[]; lab: { text: string; url: string }; contact: string };
  loader: { progressText: string; cursorIndication: string[] };
  orientation: { title: string; text: string };
  footer: {
    titles: string[];
    titlesReveal: string[];
    date: string;
    creditsBtn: string;
    networks: { name: string; url?: string }[];
    copyright: string;
    infos: string;
    smallTexts: string[][];
    bigTexts: string[];
    credits: { name: string; link: string };
  };
}
