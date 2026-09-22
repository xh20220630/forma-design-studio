import { useState } from "react";
import { ArrowLeft, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NodeView } from "../SceneRenderer";
import type { DesignNode, Project } from "../../types";

export default function PrototypePreview({
  project,
  pageId,
  onClose,
}: {
  project: Project;
  pageId: string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(
    project.pages.find((page) => page.prototypeStart)?.id ?? pageId,
  );
  const [history, setHistory] = useState<string[]>([]);
  const [overlay, setOverlay] = useState<string>();
  const [transition, setTransition] = useState({
    name: "instant",
    duration: 0,
  });
  const page =
    project.pages.find((item) => item.id === current) ?? project.pages[0];
  const overlayPage = project.pages.find((item) => item.id === overlay);
  const scale = Math.min(
    1,
    (window.innerWidth - 120) / page.width,
    (window.innerHeight - 160) / page.height,
  );
  const act = (node: DesignNode) => {
    const action = node.prototype;
    if (!action) return;
    setTransition({
      name: action.animation ?? "instant",
      duration: action.duration ?? 300,
    });
    if (action.action === "back") {
      if (overlay) setOverlay(undefined);
      else if (history.length) {
        setCurrent(history[history.length - 1]);
        setHistory((items) => items.slice(0, -1));
      }
    } else if (action.action === "url") {
      if (/^https?:\/\//i.test(action.target ?? ""))
        window.open(action.target, "_blank", "noopener,noreferrer");
    } else if (project.pages.some((item) => item.id === action.target)) {
      if (action.action === "overlay") setOverlay(action.target);
      else {
        setHistory((items) => [...items, current]);
        setCurrent(action.target!);
        setOverlay(undefined);
      }
    }
  };
  const scene = (id: string) => {
    const target = project.pages.find((item) => item.id === id)!;
    return (
      <div
        className="ed-preview-artboard"
        style={{
          width: target.width,
          height: target.height,
          background: target.background ?? project.tokens.background,
        }}
      >
        {target.nodes.map((node) => (
          <NodeView
            key={node.id}
            node={node}
            project={project}
            nodes={target.nodes}
            onClick={act}
          />
        ))}
      </div>
    );
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="ed-preview-dialog" showCloseButton={false}>
        <header>
          <Button
            variant="ghost"
            size="icon"
            aria-label="返回原型上一页"
            disabled={!history.length && !overlay}
            onClick={() => act({ prototype: { action: "back" } } as DesignNode)}
          >
            <ArrowLeft size={17} />
          </Button>
          <DialogTitle>
            <Play size={14} />
            <span className="ed-preview-project-name">{project.name}</span>
            <span className="ed-preview-title-divider">/</span>
            <span className="ed-preview-page-name">{page.name}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            预览项目的页面交互，按 Esc 返回编辑器。
          </DialogDescription>
          <Button
            variant="ghost"
            onClick={() => {
              setCurrent(
                project.pages.find((p) => p.prototypeStart)?.id ?? pageId,
              );
              setHistory([]);
              setOverlay(undefined);
            }}
          >
            重新开始
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="关闭预览"
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </header>
        <main>
          <div
            className="ed-preview-scaled"
            style={{ width: page.width * scale, height: page.height * scale }}
          >
            <div
              key={page.id}
              className={`ed-preview-transition ${transition.name}`}
              style={{
                transform: `scale(${scale})`,
                animationDuration: `${transition.duration}ms`,
              }}
            >
              {scene(page.id)}
            </div>
          </div>
          {overlayPage && (
            <div
              className="ed-preview-overlay"
              onClick={() => setOverlay(undefined)}
            >
              <div
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: overlayPage.width * scale,
                  height: overlayPage.height * scale,
                }}
              >
                <div
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                  }}
                >
                  {scene(overlayPage.id)}
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  className="ed-overlay-close"
                  title="关闭浮层"
                  onClick={() => setOverlay(undefined)}
                >
                  <X size={16} />
                </Button>
              </div>
            </div>
          )}
        </main>
        <footer>点击有交互的图层体验原型 · Esc 退出</footer>
      </DialogContent>
    </Dialog>
  );
}
