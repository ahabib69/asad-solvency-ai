import { Check, Crown } from 'lucide-react';
import Modal from './Modal.jsx';
import { useApp } from '../../context/AppContext.jsx';

const PLANS = [
  { id: 'free', name: 'Free', price: '$0', features: ['Problem Solver', 'Live AI (browser voice)', 'Make Yourself Useful', 'Local history'] },
  { id: 'pro', name: 'Premium', price: '$12/mo', highlight: true, features: ['Everything in Free', 'Neural Live AI voices', 'Priority, smarter models', '4K Creative Studio + upscaling', 'Unlimited history & export'] },
];

export default function PremiumModal() {
  const { premiumOpen, setPremiumOpen, toast } = useApp();
  return (
    <Modal open={premiumOpen} onClose={() => setPremiumOpen(false)} title="Go Premium" width={720}>
      <p className="muted" style={{ marginTop: 0 }}>Unlock unlimited features &amp; more power.</p>
      <div className="plans">
        {PLANS.map((p) => (
          <div key={p.id} className={`plan glass ${p.highlight ? 'plan-hi' : ''}`}>
            {p.highlight && <Crown className="plan-crown" size={22} />}
            <h4>{p.name}</h4>
            <div className="plan-price">{p.price}</div>
            <ul>{p.features.map((f) => <li key={f}><Check size={15} /> {f}</li>)}</ul>
            <button
              className={p.highlight ? 'btn btn-primary w-full' : 'btn btn-ghost w-full'}
              onClick={() => {
                if (p.highlight) toast('Billing is not connected yet. Add your Stripe checkout link — see README › "Premium & billing".', 'info', 6500);
                setPremiumOpen(false);
              }}
            >
              {p.highlight ? 'Upgrade Now' : 'Current plan'}
            </button>
          </div>
        ))}
      </div>
      <p className="tiny muted">Payments are integration-ready: connect Stripe (or any provider) as described in the README. No payment is taken in this build.</p>
    </Modal>
  );
}
