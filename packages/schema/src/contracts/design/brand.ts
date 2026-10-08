/** Only path data is accepted; executable SVG markup and embedded images are excluded. */
export interface BrandVector {
  width: number;
  height: number;
  paths: { d: string; fill: string; fillRule: 'nonzero' | 'evenodd' }[];
}

export interface BrandArtifact {
  id: string;
  name: string;
  parentId?: string;
  imageUrl: string;
  width: number;
  height: number;
  prompt: string;
  vector?: BrandVector;
  createdAt: string;
}

export interface BrandDesign {
  artifacts: BrandArtifact[];
  adoptedArtifactId?: string;
  /** Preserve earlier briefs and concepts when migrating from the form-based workflow. */
  legacy?: Record<string, unknown>;
}
