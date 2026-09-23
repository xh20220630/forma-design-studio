import type { CSSProperties } from "react";
import type { Project } from "@forma/schema";

export default function ProjectMark({
  project,
  size = 36,
}: {
  project: Pick<Project, "name" | "tokens">;
  size?: number;
}) {
  const letter =
    project.name
      .trim()
      .match(/[a-z\d]/i)?.[0]
      ?.toUpperCase() ?? project.name.trim().slice(0, 1);
  return (
    <span
      className="project-mark"
      aria-hidden="true"
      style={
        {
          width: size,
          height: size,
          fontSize: size * 0.44,
          "--project-accent": project.tokens.primary,
        } as CSSProperties
      }
    >
      {letter}
      <i />
    </span>
  );
}
