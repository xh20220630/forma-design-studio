import AgentChatPanel, { type AgentChatPanelProps } from '../../agent/components/AgentChatPanel';
import '../styles/brand-design.css';

type Props = Omit<AgentChatPanelProps, 'mode' | 'layout' | 'hidden' | 'onClose'>;

export default function BrandDesignStudio(props: Props) {
  return (
    <section className="brand-chat-studio">
      <AgentChatPanel {...props} mode="brand" layout="workspace" onClose={() => {}} />
    </section>
  );
}
