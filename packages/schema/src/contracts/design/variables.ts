/** 按模式存储值的设计变量，供节点绑定并随主题模式切换。 */
export interface DesignVariable {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 用于区分数据形态或行为分支的类型。取值：color（颜色）、number（数值）、string（文本）、boolean（布尔值）。 */
  type: 'color' | 'number' | 'string' | 'boolean';
  /** 各模式或选项对应的实际取值。 */
  values: Record<string, string | number | boolean>;
}

/** 共享同一组模式的变量集合，避免变量各自定义不一致的模式名称。 */
export interface VariableCollection {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 集合支持的模式名称。 */
  modes: string[];
  /** 当前集合中的变量定义。 */
  variables: DesignVariable[];
}
