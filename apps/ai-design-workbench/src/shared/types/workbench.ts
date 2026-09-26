/** x/y 为屏幕像素平移，zoom 为世界坐标到屏幕坐标的缩放倍率。 */
export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

/** 当前选中的流程对象，驱动画布高亮与侧栏详情。 */
export type Selection =
  | {
      type: 'node';
      id: string;
    }
  | {
      type: 'edge';
      id: string;
    }
  | undefined;

export type ViewMode = 'flows' | 'tokens' | 'components';
