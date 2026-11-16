import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Card, Empty } from '../components/ui';
import { fmt } from '../lib/format';
import { download, txToCsv } from '../lib/csv';

export default function Reports() {
  const { data } = useStore();
  const years = useMemo(() => [...new Set(data.transactions.map((t) => t.date.slice(0, 4)))].sort().reverse(), [data.transactions]);
  const [year, setYear] = useState('');
  const y = year || years[0] || '';
  const tx = data.transactions.filter((t) => t.date.startsWith(y));
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    const r = tx.filter((t) => t.date.slice(5, 7) === m);
    const sum = (f: (t: typeof tx[0]) => boolean) => r.filter(f).reduce((s, t) => s + t.amount, 0);
    const inc = sum((t) => t.type === 'income');
    const outB = sum((t) => t.type === 'expense' && t.source === 'balance');
    const outD = sum((t) => t.type === 'expense' && t.source !== 'balance');
    const rep = sum((t) => t.type === 'repay');
    return { m: i + 1, inc, outB, outD, rep, net: inc - outB - rep, n: r.length };
  }), [tx]);
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tx) if (t.type === 'expense') m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [tx]);
  const totalExp = cats.reduce((s, c) => s + c[1], 0);
  const tot = months.reduce((a, r) => ({ inc: a.inc + r.inc, outB: a.outB + r.outB, outD: a.outD + r.outD, rep: a.rep + r.rep, net: a.net + r.net }), { inc: 0, outB: 0, outD: 0, rep: 0, net: 0 });
  if (!years.length) return <Card title="Báo cáo thống kê"><Empty>Chưa có giao dịch để thống kê.</Empty></Card>;
  return (
    <div className="stack-lg">
      <Card title={`Báo cáo năm ${y}`} actions={<>
        <select value={y} onChange={(e) => setYear(e.target.value)} aria-label="Năm">{years.map((v) => <option key={v}>{v}</option>)}</select>
        <button className="btn" onClick={() => download(`bao-cao-${y}.csv`, txToCsv([...tx].sort((a, b) => a.date.localeCompare(b.date))), 'text/csv;charset=utf-8')}>Xuất CSV (mở bằng Excel)</button>
      </>}>
        <div className="table-wrap"><table>
          <thead><tr><th>Tháng</th><th className="r">Thu</th><th className="r">Chi từ số dư</th><th className="r">Chi từ nợ</th><th className="r">Trả nợ</th><th className="r">Thu − chi dư − trả nợ</th></tr></thead>
          <tbody>{months.filter((r) => r.n).map((r) => <tr key={r.m}><td>Tháng {r.m}</td><td className="r num c-income">{fmt(r.inc)}</td><td className="r num c-expense">{fmt(r.outB)}</td><td className="r num c-debt">{fmt(r.outD)}</td><td className="r num">{fmt(r.rep)}</td><td className="r num">{fmt(r.net)}</td></tr>)}</tbody>
          <tfoot><tr><th>Cả năm</th><th className="r num">{fmt(tot.inc)}</th><th className="r num">{fmt(tot.outB)}</th><th className="r num">{fmt(tot.outD)}</th><th className="r num">{fmt(tot.rep)}</th><th className="r num">{fmt(tot.net)}</th></tr></tfoot>
        </table></div>
      </Card>
      <Card title="Chi tiêu theo danh mục (mọi nguồn)">
        {cats.length === 0 ? <Empty>Năm này chưa có khoản chi.</Empty> : <div className="bars">{cats.map(([c, v]) => (
          <div key={c} className="bar-row"><span>{c}</span><div className="bar"><i style={{ width: `${(v / totalExp) * 100}%` }} /></div><span className="num">{fmt(v)} <small className="muted">{Math.round((v / totalExp) * 100)}%</small></span></div>
        ))}</div>}
      </Card>
    </div>
  );
}
