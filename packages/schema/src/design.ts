export interface ThemeTokens {
  primary: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  radius: number;
  fontFamily: string;
  spacing: number;
}
export type NodeType =
  | "frame"
  | "text"
  | "rectangle"
  | "button"
  | "image"
  | "component"
  | "group"
  | "ellipse"
  | "line"
  | "polygon"
  | "star"
  | "path"
  | "section";
export interface DesignNode {
  id: string;
  name: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  color?: string;
  text?: string;
  fontSize?: number;
  radius?: number;
  opacity?: number;
  parentId?: string;
  componentId?: string;
  tokenBindings?: Record<string, keyof ThemeTokens>;
  visible?: boolean;
  locked?: boolean;
  variableBindings?: Record<
    string,
    { collectionId: string; variableId: string }
  >;
  layout?: "none" | "horizontal" | "vertical" | "wrap";
  gap?: number;
  src?: string;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  stroke?: string;
  strokeWidth?: number;
  strokeAlign?: "inside" | "center" | "outside";
  strokeDash?: "solid" | "dashed" | "dotted";
  gradient?: {
    type: "linear" | "radial";
    from: string;
    to: string;
    angle: number;
  };
  shadow?: {
    x: number;
    y: number;
    blur: number;
    spread: number;
    color: string;
    inset?: boolean;
  };
  blur?: number;
  blendMode?:
    "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right" | "justify";
  verticalAlign?: "top" | "center" | "bottom";
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: "none" | "underline" | "line-through";
  polygonSides?: number;
  starRatio?: number;
  path?: string;
  points?: { x: number; y: number }[];
  closed?: boolean;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  alignItems?: "start" | "center" | "end" | "stretch";
  justifyContent?: "start" | "center" | "end" | "space-between";
  sizingHorizontal?: "fixed" | "hug" | "fill";
  sizingVertical?: "fixed" | "hug" | "fill";
  constraints?: {
    horizontal: "left" | "right" | "center" | "left-right" | "scale";
    vertical: "top" | "bottom" | "center" | "top-bottom" | "scale";
  };
  clipContent?: boolean;
  aspectRatioLocked?: boolean;
  prototype?: {
    action: "navigate" | "overlay" | "back" | "url";
    target?: string;
    animation?: "instant" | "dissolve" | "slide";
    duration?: number;
    trigger?: "click" | "hover";
  };
  overrides?: Record<
    string,
    { text?: string; fill?: string; visible?: boolean }
  >;
}
export interface DesignPage {
  id: string;
  name: string;
  width: number;
  height: number;
  nodes: DesignNode[];
  background?: string;
  grid?: {
    size: number;
    enabled: boolean;
    type?: "grid" | "columns";
    columns?: number;
    gutter?: number;
    margin?: number;
  };
  prototypeStart?: boolean;
}
export interface DesignComponent {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: DesignNode[];
  width: number;
  height: number;
  setId?: string;
  variantProperties?: Record<string, string>;
}
export interface DesignComment {
  id: string;
  pageId: string;
  x: number;
  y: number;
  text: string;
  author: string;
  createdAt: string;
  resolved?: boolean;
}
export interface DesignSnapshot {
  id: string;
  name: string;
  createdAt: string;
  pages: DesignPage[];
  components: DesignComponent[];
  tokens: ThemeTokens;
  variableCollections?: VariableCollection[];
  themeModes?: Record<string, ThemeTokens>;
  activeMode?: string;
  activeVariableModes?: Record<string, string>;
}
export interface DesignVariable {
  id: string;
  name: string;
  type: "color" | "number" | "string" | "boolean";
  values: Record<string, string | number | boolean>;
}
export interface VariableCollection {
  id: string;
  name: string;
  modes: string[];
  variables: DesignVariable[];
}
export interface WorkspaceBinding {
  kind: "local" | "github";
  path?: string;
  repo?: string;
  branch?: string;
  autoSync?: boolean;
}
export interface GenerationState {
  prompt: string;
  imageUrl?: string;
  approved?: boolean;
  generatedAt?: string;
  contextHash?: string;
}
export interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "draft" | "in-progress" | "synced";
  themeId: string;
  tokens: ThemeTokens;
  pages: DesignPage[];
  components: DesignComponent[];
  updatedAt: string;
  workspace?: WorkspaceBinding;
  revision: number;
  lastSyncedRevision?: number;
  cover: "dashboard" | "commerce" | "travel" | "finance" | "blank";
  generation?: GenerationState;
  comments?: DesignComment[];
  snapshots?: DesignSnapshot[];
  variableCollections?: VariableCollection[];
  themeModes?: Record<string, ThemeTokens>;
  activeMode?: string;
  activeVariableModes?: Record<string, string>;
}
export interface DesignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  tokens: ThemeTokens;
  cover: Project["cover"];
  featured?: boolean;
}
export type TextProtocol = 'openai' | 'openai-responses' | 'anthropic' | 'gemini' | 'none';
export type ImageProtocol = 'openai-images' | 'gemini' | 'imagen' | 'none';
export type ProviderAuth = 'auto' | 'bearer' | 'api-key' | 'none';
export interface ModelBinding { providerId: string; model: string }
export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  textProtocol: TextProtocol;
  imageProtocol: ImageProtocol;
  auth: ProviderAuth;
  hasApiKey: boolean;
  headerNames: string[];
  modelsPath: string;
  textPath: string;
  imagePath: string;
  timeoutMs: number;
  maxOutputTokens: number;
  jsonMode: boolean;
  imageSize: string;
}
export interface ProviderModel { id: string; name: string }
export interface ProviderSettings {
  configured: boolean;
  imageConfigured: boolean;
  providers: ModelProvider[];
  text: ModelBinding;
  image: ModelBinding;
  /** Compatibility summary of the currently selected connections. */
  baseUrl: string;
  textModel: string;
  imageModel: string;
}

