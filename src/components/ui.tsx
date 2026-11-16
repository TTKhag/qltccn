import { ReactNode, useEffect, useState } from 'react';
import { fmt, fmtNum, parseMoney } from '../lib/format';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><button className="btn ghost" onClick={onClose} aria-label="Đóng">✕</button></div>
        {children}
      </div>
    </div>
  );
}
export function Confirm({ title, children, confirmText = 'Xác nhận', danger, onYes, onNo }: { title: string; children: ReactNode; confirmText?: string; danger?: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <Modal title={title} onClose={onNo}>
      <div className="stack">{children}</div>
      <div className="row end"><button className="btn" onClick={onNo}>Hủy</button><button className={'btn ' + (danger ? 'danger' : 'primary')} onClick={onYes}>{confirmText}</button></div>
    </Modal>
  );
}
export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
);
export function MoneyInput({ value, onChange, ...rest }: { value: number; onChange: (n: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [txt, setTxt] = useState(value ? fmtNum(value) : '');
  useEffect(() => { setTxt(value ? fmtNum(value) : ''); }, [value]);
  return <input inputMode="numeric" placeholder="0" {...rest} value={txt} onChange={(e) => { const n = parseMoney(e.target.value); setTxt(n ? fmtNum(n) : ''); onChange(n); }} />;
}
export const Stat = ({ label, value, tone, size, sub }: { label: string; value: number; tone?: string; size?: 'lg' | 'sm'; sub?: string }) => (
  <div className={`stat ${tone ?? ''} ${size ?? ''}`}><div className="stat-label">{label}</div><div className="stat-value num">{fmt(value)}</div>{sub && <div className="stat-sub">{sub}</div>}</div>
);
export const Card = ({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={'card ' + (className ?? '')}>{(title || actions) && <div className="card-head"><h3>{title}</h3><div className="row">{actions}</div></div>}{children}</section>
);
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
