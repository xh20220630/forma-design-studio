import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, ChevronRight, Component, LayoutGrid, Plus, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useStudioTheme, normalizeStudioAccent, type StudioThemePreset, type StudioThemeSettings } from "../theme/StudioTheme";
import { Button } from "@forma/ui/button";
import { Input } from "@forma/ui/input";
import { RinAvatar, RinIcon } from "./brand/RinBrand";
import { ChromaticLoom } from "./motion/ChromaticLoom";
import "./theme-studio.css";

const accentSwatches = ["#38bdf8", "#0875e1", "#7959ef", "#dd5895", "#f1843d", "#f0b72d", "#2aad85", "#8491a4"];

function PresetPreview({ preset, accent }: { preset: StudioThemePreset; accent: string }) {
  return (
    <div className="theme-preset-preview" aria-hidden="true" style={{
      "--preview-bg": preset.colors.background,
      "--preview-surface": preset.colors.surface,
      "--preview-text": preset.colors.foreground,
      "--preview-muted": preset.colors.muted,
      "--preview-border": preset.colors.border,
      "--preview-accent": accent,
    } as CSSProperties}>
      <div className="theme-preset-preview__sidebar"><i /><b /><i /><i /></div>
      <div className="theme-preset-preview__main">
        <header><i /><span /></header>
        <strong>每一个想法，都值得成形。</strong>
        <div className="theme-preset-scene"><img src="/brand/rin/v4/rin-full-body-640.webp" alt="" /></div>
        <div className="theme-preset-preview__cards"><div /><div /><div /></div>
        <footer><i /><i /></footer>
      </div>
    </div>
  );
}

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="theme-setting-row">
      <div className="theme-setting-row__label"><h3>{title}</h3><p>{description}</p></div>
      {children}
    </div>
  );
}

function Choices<K extends keyof StudioThemeSettings>({ name, value, choices, onChange }: {
  name: K;
  value: StudioThemeSettings[K];
  choices: { value: StudioThemeSettings[K]; label: string }[];
  onChange: (value: StudioThemeSettings[K]) => void;
}) {
  return (
    <div className="theme-choices" role="group" aria-label={{ cardStyle: "容器样式", radius: "圆角", density: "信息密度", personality: "凛的陪伴方式", motion: "动态效果", preset: "主题", accent: "强调色" }[name]}>
      {choices.map((choice) => (
        <label key={choice.value} className={`theme-choice ${value === choice.value ? "is-selected" : ""}`}>
          <input type="radio" name={`studio-${name}`} value={choice.value} checked={value === choice.value} onChange={() => onChange(choice.value)} />
          <span>{choice.label}</span>
        </label>
      ))}
    </div>
  );
}

export function ThemeStudio() {
  const { settings, presets, updateSettings, resetSettings } = useStudioTheme();
  const reduced = useReducedMotion();
  const [colorDraft, setColorDraft] = useState(settings.accent);
  const [colorError, setColorError] = useState(false);
  const [previewSelected, setPreviewSelected] = useState(false);
  const [feedback, setFeedback] = useState("");
  const motionOff = Boolean(reduced) || settings.motion === "off";
  const currentPreset = presets.find((preset) => preset.id === settings.preset)!;

  useEffect(() => {
    setColorDraft(settings.accent);
    setColorError(false);
  }, [settings.accent]);

  const commitAccent = () => {
    const normalized = normalizeStudioAccent(colorDraft);
    if (!normalized) { setColorError(true); return; }
    updateSettings({ accent: normalized });
    setColorDraft(normalized);
    setColorError(false);
  };

  return (
    <div className="theme-studio">
      <header className="theme-studio__header">
        <div className="theme-studio__identity"><div><h1>凛的主题工作室</h1><p>找到最适合你的创作氛围。</p></div></div>
        <Button variant="outline" className="theme-reset" onClick={() => { resetSettings(); setFeedback("已恢复默认外观"); }}><RotateCcw size={14} />恢复默认</Button>
      </header>
      <div className="theme-studio__layout">
        <div className="theme-studio__settings">
          <div className="theme-atmosphere theme-atmosphere--kinetic"><div className="theme-atmosphere-copy"><span className="pearl-eyebrow">CHROMATIC LOOM</span><h2>让色彩，<br />重新组合。</h2><p>切换主题，看材质重新成形。</p></div><ChromaticLoom preset={settings.preset} accent={settings.accent} reducedMotion={motionOff} /></div>
          <section className="theme-settings-section" aria-labelledby="theme-preset-heading">
            <div className="theme-section-heading"><h2 id="theme-preset-heading">主题</h2><span>选择工作台的基础配色</span></div>
            <div className="theme-preset-grid">
              {presets.map((preset) => (
                <button type="button" key={preset.id} data-preset={preset.id} className={`theme-preset ${settings.preset === preset.id ? "is-selected" : ""}`} aria-pressed={settings.preset === preset.id} onClick={() => updateSettings({ preset: preset.id })}>
                  <PresetPreview preset={preset} accent={settings.accent} />
                  <span className="theme-preset__description"><strong>{preset.name.split(" / ").pop()}</strong><span className="theme-preset__check" aria-hidden="true">{settings.preset === preset.id && <Check size={12} />}</span></span>
                </button>
              ))}
            </div>
            <div className="theme-accent-section">
              <div className="theme-setting-row__label"><h3>强调色</h3><p>用于按钮、选中状态和重点信息。</p></div>
              <div className="theme-accent-editor">
                <div className="theme-accent-swatches">
                  {accentSwatches.map((color) => (
                    <button type="button" key={color} className="theme-accent-swatch" style={{ background: color }} aria-label={`使用强调色 ${color}`} aria-pressed={settings.accent === color} onClick={() => updateSettings({ accent: color })}>{settings.accent === color && <Check size={14} />}</button>
                  ))}
                </div>
                <div className="theme-accent-custom">
                  <label className="theme-color-picker"><input type="color" value={settings.accent} aria-label="选择自定义强调色" onChange={(event) => updateSettings({ accent: event.target.value })} /><span style={{ background: settings.accent }} /></label>
                  <Input aria-label="强调色 Hex 色值" aria-describedby="theme-color-help" aria-invalid={colorError} value={colorDraft} maxLength={7} spellCheck={false} onChange={(event) => { setColorDraft(event.target.value); setColorError(false); }} onBlur={commitAccent} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitAccent(); } }} />
                  <Button variant="ghost" size="icon" onClick={commitAccent} aria-label="应用强调色"><Check size={14} /></Button>
                </div>
              </div>
              <p id="theme-color-help" className={`theme-field-help ${colorError ? "is-error" : ""}`} role={colorError ? "alert" : undefined}>{colorError ? "请输入 #RGB 或 #RRGGBB 格式的色值。" : "也可以输入自定义 HEX 色值。"}</p>
            </div>
          </section>
          <section className="theme-settings-section" aria-labelledby="theme-layout-heading">
            <div className="theme-section-heading"><h2 id="theme-layout-heading">布局与样式</h2></div>
            <SettingRow title="信息密度" description="调整控件高度和内容间距。"><Choices name="density" value={settings.density} onChange={(density) => updateSettings({ density })} choices={[{ value: "comfortable", label: "标准" }, { value: "compact", label: "紧凑" }]} /></SettingRow>
            <SettingRow title="圆角" description="设置卡片和控件的边角。"><Choices name="radius" value={settings.radius} onChange={(radius) => updateSettings({ radius })} choices={[{ value: "compact", label: "小" }, { value: "balanced", label: "中" }, { value: "round", label: "大" }]} /></SettingRow>
            <SettingRow title="容器样式" description="设置面板的边框与层次。"><Choices name="cardStyle" value={settings.cardStyle} onChange={(cardStyle) => updateSettings({ cardStyle })} choices={[{ value: "outline", label: "描边" }, { value: "soft", label: "阴影" }, { value: "glass", label: "半透明" }]} /></SettingRow>
          </section>
          <section className="theme-settings-section" aria-labelledby="theme-interaction-heading">
            <div className="theme-section-heading"><h2 id="theme-interaction-heading">交互偏好</h2></div>
            <SettingRow title="动态效果" description={reduced ? "系统已开启减少动态效果。" : "设置页面切换与操作反馈的过渡。"}><Choices name="motion" value={settings.motion} onChange={(motion) => updateSettings({ motion })} choices={[{ value: "off", label: "关闭" }, { value: "gentle", label: "简洁" }, { value: "expressive", label: "完整" }]} /></SettingRow>
            <SettingRow title="凛的陪伴方式" description="调整角色插画与品牌细节的展示程度。"><Choices name="personality" value={settings.personality} onChange={(personality) => updateSettings({ personality })} choices={[{ value: "subtle", label: "简洁" }, { value: "signature", label: "适中" }, { value: "immersive", label: "完整" }]} /></SettingRow>
          </section>
          <p className="theme-settings-note"><Check size={13} />更改会自动保存在当前浏览器。</p>
        </div>
        <aside className="theme-live-preview" aria-labelledby="theme-preview-heading">
          <div className="theme-section-heading"><h2 id="theme-preview-heading">实时预览</h2><span><i className="connection-dot online" /> 即时生效</span></div>
          <div className="theme-preview-window">
            <header><RinAvatar size={24} /><strong>Rin 工作空间</strong><Search size={13} /><SlidersHorizontal size={13} /></header>
            <div className="theme-preview-workspace">
              <nav aria-label="工作台样式示例"><RinIcon kind="projects" size={16} /><RinIcon kind="components" size={16} /><RinIcon kind="tokens" size={16} /></nav>
              <div className="theme-preview-content">
                <div className="theme-preview-welcome"><strong>每一个想法，<br />都值得成形。</strong><span>和凛一起，开始创作。</span><img src="/brand/rin/v4/rin-full-body-640.webp" alt="凛 Rin" /></div>
                <div className="theme-preview-title"><strong>我的项目</strong><Plus size={14} /></div>
                <motion.button type="button" className={`theme-preview-card ${previewSelected ? "is-selected" : ""}`} aria-pressed={previewSelected} onClick={() => setPreviewSelected((value) => !value)} initial={false} animate={{ scale: !motionOff && previewSelected ? 0.985 : 1 }} transition={{ duration: motionOff ? 0 : settings.motion === "gentle" ? 0.15 : 0.3 }}>
                  <span className="theme-preview-card__art"><i /><span><b /><b /><b /></span></span>
                  <span className="theme-preview-card__body"><strong>网站设计</strong><small>3 个页面 · 刚刚编辑</small>{previewSelected && <Check size={13} />}</span>
                </motion.button>
                <div className="theme-preview-list"><span><Component size={12} />组件库<ChevronRight size={12} /></span><span><LayoutGrid size={12} />设计规范<ChevronRight size={12} /></span></div>
                <button type="button" className="theme-preview-primary" onClick={() => { setPreviewSelected((value) => !value); setFeedback("已切换预览选中状态"); }}>{previewSelected ? "已选择项目" : "选择项目"}{previewSelected ? <Check size={12} /> : <Plus size={12} />}</button>
              </div>
            </div>
          </div>
          <div className="theme-preview-summary"><span>{currentPreset.name.split(" / ").pop()}</span><code><i style={{ background: settings.accent }} />{settings.accent.toUpperCase()}</code></div>
          <p className="theme-preview-note">这些设置仅影响工作台外观，项目画布的设计样式由各项目单独设置。</p>
          <span className="theme-studio__feedback" role="status" aria-live="polite">{feedback}</span>
        </aside>
      </div>
    </div>
  );
}

export default ThemeStudio;
