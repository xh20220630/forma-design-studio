export type PageKind = 'page' | 'modal' | 'drawer' | 'state';
export type Platform = 'desktop' | 'mobile';

export interface ProjectMeta {
  schemaVersion: 1 | 2;
  revision: number;
  id: string;
  name: string;
  theme: {
    id: string;
    version: string;
    status: 'draft' | 'approved';
    confirmation: string;
    designPath: string;
    tokensPath: string;
    anchorImage?: string;
  };
}

export interface TokenCollection {
  schemaVersion: 1 | 2;
  themeVersion: string;
  tokens: SemanticTokenGroups;
}

export interface SemanticTokenGroups {
  color: Record<string, unknown>;
  typography: Record<string, unknown>;
  spacing: Record<string, unknown>;
  radius: Record<string, unknown>;
  shadow: Record<string, unknown>;
  layout: Record<string, unknown>;
  motion: Record<string, unknown>;
}

export interface DesignComponentSpec {
  id: string;
  version: string;
  name: string;
  status: 'draft' | 'approved' | 'deprecated';
  scope: string[];
  excludes: string[];
  tags: string[];
  specPath: string;
  specContent: string;
}

export interface ComponentReference {
  id: string;
  version: string;
  adaptation: string;
}

export interface DesignImpactReason {
  type: 'tokens' | 'component';
  subject: string;
  fromVersion: string;
  toVersion: string;
  message: string;
}

export interface DesignImpact {
  pageRef: string;
  reasons: DesignImpactReason[];
}

export interface ImageNode {
  id: string;
  type: 'image';
  assetPath: string;
  width: number;
  height: number;
  intrinsicWidth: number;
  intrinsicHeight: number;
  locked: true;
}

export interface AnnotationNode {
  id: string;
  label: string;
  text: string;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  target?: string;
}

export interface FlowPageNode {
  id: string;
  pageRef: string;
  name: string;
  goal: string;
  kind: PageKind;
  platform: Platform;
  parent?: string;
  frame: { x: number; y: number; width: number; height: number };
  image: ImageNode;
  annotations: AnnotationNode[];
  componentUsage: ComponentReference[];
  imageRevision: number;
  themeVersion: string;
  promptPath?: string;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  trigger: string;
  condition: string;
  effect: string;
  crossFlow: boolean;
  intent?: 'open' | 'navigate' | 'close' | 'cancel' | 'success' | 'back';
}

export interface WorkspaceFlow {
  id: string;
  name: string;
  goal: string;
  sourcePath: string;
  brief?: { path: string; content: string };
  entryPage: string;
  consistencyNotes: string[];
  defaultViewport?: { x: number; y: number; zoom: number };
  nodes: FlowPageNode[];
  edges: FlowEdge[];
}

export interface WorkspaceDocument {
  project: ProjectMeta;
  designSystem: {
    tokens: TokenCollection;
    components: DesignComponentSpec[];
    impacts: DesignImpact[];
  };
  flows: WorkspaceFlow[];
  revision: number;
}

export interface WorkspaceLocalState {
  schemaVersion: 1;
  skills?: Record<string, unknown>;
  viewports: Record<string, { x: number; y: number; zoom: number }>;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  path: string;
  message: string;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
}

export type WorkspaceOperation =
  | { type: 'set-component-spec'; componentId: string; version: string; content: string; expectedContent: string }
  | { type: 'set-flow-brief'; flowId: string; content: string; expectedContent: string }
  | { type: 'update-annotation'; flowId: string; pageId: string; annotation: AnnotationNode; expectedAnnotation: AnnotationNode }
  | { type: 'set-node-position'; flowId: string; pageId: string; x: number; y: number }
  | { type: 'set-default-viewport'; flowId: string; x: number; y: number; zoom: number };

export interface WorkspaceChangeSet {
  baseRevision: number;
  operations: WorkspaceOperation[];
}

export interface ApplyResult {
  revision: number;
  document: WorkspaceDocument;
  changedFiles: string[];
}

export interface WorkspaceEvent {
  type: 'revision';
  revision: number;
}

export interface Disposable {
  dispose(): Promise<void>;
}
