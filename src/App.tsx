import { useEffect, useState } from 'react';
import { useStore } from './store';
import Dashboard from './pages/Dashboard';
import Debts from './pages/Debts';
import Transactions from './pages/Transactions';
import Balance from './pages/Balance';
import Forecast from './pages/Forecast';
import Reports from './pages/Reports';
import Backup from './pages/Backup';
import Settings from './pages/Settings';

const NAV = [
  ['dashboard', 'Tổng quan'],
  ['debts', 'Quản lý nợ'],
  ['transactions', 'Thu chi'],
  ['balance', 'Số dư'],
  ['forecast', 'Dự kiến'],
  ['reports', 'Báo cáo'],
  ['backup', 'Sao lưu'],
  ['settings', 'Cài đặt'],
] as const;

const read = () => (location.hash.replace(/^#\/?/, '') || 'dashboard');

export default function App() {
  const [page, setPage] = useState(read());
  const { toasts } = useStore();
  useEffect(() => {
    const h = () => { setPage(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const go = (p: string) => { location.hash = '/' + p; };
  const cur = NAV.find((n) => n[0] === page) ?? NAV[0];
  const body = {
    dashboard: <Dashboard go={go} />, debts: <Debts />, transactions: <Transactions />, balance: <Balance />,
    forecast: <Forecast />, reports: <Reports />, backup: <Backup />, settings: <Settings />,
  }[cur[0]];
  return (
    <div className="app">
      <nav className="side" aria-label="Điều hướng">
        <div className="brand"><span>₫</span> Tài chính cá nhân</div>
        {NAV.map(([k, l]) => <a key={k} href={'#/' + k} className={cur[0] === k ? 'on' : ''} aria-current={cur[0] === k ? 'page' : undefined}>{l}</a>)}
      </nav>
      <main className="main">
        <h1>{cur[1]}</h1>
        {body}
      </main>
      <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className={'toast ' + t.kind}>{t.msg}</div>)}</div>
    </div>
  );
}
