import type { CSSProperties } from 'react';
import type { Project } from '@forma/schema';

/**
 * 呈现项目标识，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.size - 当前对象的尺寸或尺寸规格。
 * @returns 供 React 渲染的界面内容。
 */
export default function ProjectMark({
  project,
  size = 36,
}: {
  /** 当前设计项目或工作空间项目元信息。 */
  project: Pick<Project, 'name' | 'tokens'>;
  /** 当前对象的尺寸或尺寸规格。 */
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
          '--project-accent': project.tokens.primary,
        } as CSSProperties
      }
    >
      {letter}
      <i />
    </span>
  );
}
