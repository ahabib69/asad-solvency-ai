import { KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ConfigNotice({ title = 'Connect your AI key to start', children, compact }) {
  return (
    <div className={`config-notice ${compact ? 'compact' : ''}`}>
      <KeyRound size={compact ? 16 : 20} />
      <div>
        <strong>{title}</strong>
        <div className="muted">
          {children || <>Add <code>OPENAI_API_KEY</code> to the <code>.env</code> file in the project root and restart the server. </>}
          <Link to="/settings#integrations">See integration status →</Link>
        </div>
      </div>
    </div>
  );
}
