import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store';
import { Card, Empty, Stat } from '../components/ui';
import { fmt, fmtNum } from '../lib/format';
import { addDays, monthOf } from '../lib/dates';
import { compute } from '../lib/engine';

export const COLORS = { income: '#0f9d74', expense: '#d9473f', debt: '#d98a00', balance: '#2f5bd6', ink: '#16212b' };
const tick = { fontSize: 12, fill: '#5b6773' };
const axisM = (v: number) => (Math.abs(v) >= 1e6 ? String(Math.round(v / 1e5) / 10).replace('.', ',') + 'tr' : fmtNum(v));

export default function Dashboard({ go }: { go: (p: string) => void }) {
  const { data, state, today } = useStore();
  const ym = monthOf(today);
  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; Thu: number; Chi: number }>();
    for (const t of data.transactions) {
      if (t.type === 'repay') continue;
      const k = monthOf(t.date);
      const r = m.get(k) ?? { month: k.slice(5) + '/' + k.slice(0, 4), Thu: 0, Chi: 0 };
      if (t.type === 'income') r.Thu += t.amount; else r.Chi += t.amount;
      m.set(k, r);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map((x) => x[1]);
  }, [data.transactions]);
  const thisMonth = data.transactions.filter((t) => monthOf(t.date) === ym);
  const mIn = thisMonth.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const mOut = thisMonth.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net = state.balance - state.totalActual;

  const horizon = addDays(today, 30);
  const pending = data.plans.filter((p) => p.status === 'pending');
  const fc = useMemo(() => compute(data, horizon, pending), [data, horizon, pending]);
  const fcNet = fc.balance - fc.totalActual;

  const debtPie = [
    { name: 'Gốc tín dụng/ngân hàng', value: state.debts.credit.principal, c: COLORS.debt },
    { name: 'Gốc tiền mặt', value: state.debts.cash.principal, c: '#f0b429' },
    { name: 'Lãi còn phải trả', value: state.totalInterest, c: COLORS.expense },
  ].filter((x) => x.value > 0);
  const ratio = [{ name: 'Thu', value: mIn, c: COLORS.income }, { name: 'Chi', value: mOut, c: COLORS.expense }].filter((x) => x.value > 0);
  const series = state.series.map((p) => ({ date: p.date.slice(8) + '/' + p.date.slice(5, 7), Dư: p.balance }));
  const tip = { formatter: (v: number) => fmt(v) } as const;

  const empty = data.transactions.length === 0;
  return (
    <div className="stack-lg">
      {empty && (
        <div className="notice">
          Chưa có dữ liệu. Bắt đầu bằng cách <button className="link" onClick={() => go('balance')}>nhập dư ban đầu</button> rồi <button className="link" onClick={() => go('transactions')}>thêm giao dịch đầu tiên</button>.
        </div>
      )}
      <div className="hero">
        <div>
          <div className="stat-label">Tài sản ròng hiện tại</div>
          <div className={'hero-value num ' + (net < 0 ? 'neg' : '')}>{fmt(net)}</div>
          <div className="muted">Số dư {fmt(state.balance)} − thực nợ {fmt(state.totalActual)}. Khoản vay không được tính là tài sản.</div>
        </div>
        <div className="hero-side">
          <div className="stat-label">Tài sản ròng dự kiến sau 30 ngày</div>
          <div className="num hero-small">{fmt(fcNet)}</div>
          <button className="link" onClick={() => go('forecast')}>Xem chi tiết dự kiến</button>
        </div>
      </div>
      <div className="grid-stats">
        <Stat label="Số dư hiện tại" value={state.balance} tone="balance" />
        <Stat label="Tổng nợ gốc" value={state.totalPrincipal} tone="debt" />
        <Stat label="Tổng lãi" value={state.totalInterest} tone="debt" />
        <Stat label="Tổng thực nợ" value={state.totalActual} tone="debt" />
        <Stat label="Thu trong tháng" value={mIn} tone="income" />
        <Stat label="Chi trong tháng" value={mOut} tone="expense" />
        <Stat label="Đã trả nợ (tổng)" value={state.totalRepaid} />
        <Stat label="Tổng nguồn lực (dư + nợ)" value={state.balance + state.totalActual} sub="Không phải tài sản ròng" />
      </div>
      <div className="grid-2">
        <Card title="Thu và chi theo tháng">
          {monthly.length === 0 ? <Empty>Chưa có giao dịch thu/chi.</Empty> : (
            <ResponsiveContainer width="100%" height={260}><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" stroke="#e3e8ec" /><XAxis dataKey="month" tick={tick} /><YAxis tick={tick} tickFormatter={axisM} width={48} /><Tooltip {...tip} /><Legend /><Bar dataKey="Thu" fill={COLORS.income} radius={[3, 3, 0, 0]} /><Bar dataKey="Chi" fill={COLORS.expense} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
          )}
        </Card>
        <Card title="Biến động số dư">
          {series.length === 0 ? <Empty>Chưa có biến động số dư.</Empty> : (
            <ResponsiveContainer width="100%" height={260}><LineChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#e3e8ec" /><XAxis dataKey="date" tick={tick} /><YAxis tick={tick} tickFormatter={axisM} width={48} /><Tooltip {...tip} /><Line type="stepAfter" dataKey="Dư" stroke={COLORS.balance} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
          )}
        </Card>
        <Card title="Cơ cấu các khoản nợ">
          {debtPie.length === 0 ? <Empty>Hiện không có nợ.</Empty> : (
            <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={debtPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{debtPie.map((d) => <Cell key={d.name} fill={d.c} />)}</Pie><Tooltip {...tip} /><Legend /></PieChart></ResponsiveContainer>
          )}
        </Card>
        <Card title="Tỷ lệ thu/chi trong tháng">
          {ratio.length === 0 ? <Empty>Tháng này chưa có thu/chi.</Empty> : (
            <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={ratio} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{ratio.map((d) => <Cell key={d.name} fill={d.c} />)}</Pie><Tooltip {...tip} /><Legend /></PieChart></ResponsiveContainer>
          )}
        </Card>
      </div>
      <Card title="Tình hình dự kiến (30 ngày tới)">
        <div className="grid-stats sm">
          <Stat label="Dư dự kiến" value={fc.balance} size="sm" sub={`Hiện tại ${fmt(state.balance)}`} />
          <Stat label="Thực nợ dự kiến" value={fc.totalActual} size="sm" sub={`Hiện tại ${fmt(state.totalActual)}`} />
          <Stat label="Tài sản ròng dự kiến" value={fcNet} size="sm" />
        </div>
        {fc.errors.length > 0 && <div className="warn">Cảnh báo: {fc.errors[0]}</div>}
      </Card>
    </div>
  );
}
