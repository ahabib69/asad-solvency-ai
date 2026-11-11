import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Brain, Microscope, CheckCircle2, GitBranch, AlertTriangle, Rocket, HelpCircle, Sparkles, Target } from 'lucide-react';

const SECTION_STYLES = [
  { re: /understand/i, icon: Brain, tone: 'blue' },
  { re: /actually happening|what.?s happening|root/i, icon: Microscope, tone: 'violet' },
  { re: /recommend/i, icon: CheckCircle2, tone: 'green', badge: 'Best path' },
  { re: /alternative/i, icon: GitBranch, tone: 'cyan' },
  { re: /risk/i, icon: AlertTriangle, tone: 'amber' },
  { re: /next move|next step/i, icon: Rocket, tone: 'pink', highlight: true },
  { re: /question/i, icon: HelpCircle, tone: 'blue' },
  { re: /pick one/i, icon: Target, tone: 'pink', highlight: true },
];

const mdComponents = {
  a: ({ node, ...p }) => <a {...p} target="_blank" rel="noreferrer noopener" />,
  table: ({ node, ...p }) => <div className="md-table"><table {...p} /></div>,
};

const Md = ({ children }) => <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{children}</ReactMarkdown>;

function splitSections(text) {
  const lines = text.split('\n');
  const intro = [];
  const sections = [];
  let cur = null;
  let inCode = false;
  for (const line of lines) {
    if (line.trim().startsWith('```')) inCode = !inCode;
    const m = !inCode && line.match(/^#{2,3}\s+(.*)$/);
    if (m) { cur = { title: m[1].replace(/\*\*/g, '').trim(), body: [] }; sections.push(cur); }
    else if (cur) cur.body.push(line);
    else intro.push(line);
  }
  return { intro: intro.join('\n').trim(), sections };
}

function StructuredMarkdown({ content, streaming }) {
  const { intro, sections } = splitSections(content || '');
  return (
    <div className={`structured ${streaming ? 'streaming' : ''}`}>
      {intro && <div className="md"><Md>{intro}</Md></div>}
      {sections.map((s, i) => {
        const st = SECTION_STYLES.find((x) => x.re.test(s.title)) || { icon: Sparkles, tone: 'violet' };
        const Icon = st.icon;
        return (
          <section key={i} className={`sec sec-${st.tone} ${st.highlight ? 'sec-hi' : ''}`}>
            <header>
              <span className="sec-ico"><Icon size={17} /></span>
              <h4>{s.title}</h4>
              {st.badge && <span className="sec-badge">{st.badge}</span>}
            </header>
            <div className="md"><Md>{s.body.join('\n').trim()}</Md></div>
          </section>
        );
      })}
      {streaming && <span className="caret" />}
    </div>
  );
}

export default memo(StructuredMarkdown);
