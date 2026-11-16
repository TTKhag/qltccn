import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Card, Confirm, Empty } from '../components/ui';
import { TxForm } from '../components/TxForm';
import { fmt } from '../lib/format';
import { fmtDate } from '../lib/dates';
import { DEBT_LABEL, SOURCE_LABEL, Tx, TYPE_LABEL, TxType } from '../lib/types';
import * as ops from '../lib/ops';
import { download, txToCsv } from '../lib/csv';

export default function Transactions() {
  const { data, state, today, run } = useStore();
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<Tx | null>(null);
  const [del, setDel] = useState<Tx | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState<'' | TxType>('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<'date-desc' | 'date-asc' | 'amt-desc' | 'amt-asc'>('date-desc');

  const years = useMemo(() => [...new Set(data.transactions.map((t) => t.date.slice(0, 4)))].sort().reverse(), [data.transactions]);
  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    const r = data.transactions.filter((t) =>
      (!type || t.type === type) && (!year || t.date.startsWith(year)) && (!month || t.date.slice(5, 7) === month) &&
      (!from || t.date >= from) && (!to || t.date <= to) &&
      (!k || `${t.content} ${t.category} ${t.note ?? ''}`.toLowerCase().includes(k)));
    const cmp = { 'date-desc': (a: Tx, b: Tx) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt, 'date-asc': (a: Tx, b: Tx) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt, 'amt-desc': (a: Tx, b: Tx) => b.amount - a.amount, 'amt-asc': (a: Tx, b: Tx) => a.amount - b.amount }[sort];
    return [...r].sort(cmp);
  }, [data.transactions, q, type, year, month, from, to, sort]);
  const sum = (t: TxType) => rows.filter((r) => r.type === t).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="stack-lg">
      <Card title="Biến động thu chi" actions={<>
        <button className="btn" disabled={!rows.length} onClick={() => download('giao-dich.csv', txToCsv([...rows].sort((a, b) => a.date.localeCompare(b.date))), 'text/csv;charset=utf-8')}>Xuất CSV</button>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Thêm giao dịch</button>
      </>}>
        <div className="filters">
          <input placeholder="Tìm nội dung, danh mục…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm kiếm" />
          <select value={type} onChange={(e) => setType(e.target.value as '' | TxType)} aria-label="Loại"><option value="">Tất cả loại</option><option value="income">Thu</option><option value="expense">Chi</option><option value="repay">Trả nợ</option></select>
          <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Năm"><option value="">Mọi năm</option>{years.map((y) => <option key={y}>{y}</option>)}</select>
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Tháng"><option value="">Mọi tháng</option>{Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => <option key={m} value={m}>Tháng {+m}</option>)}</select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Từ ngày" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Đến ngày" />
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sắp xếp"><option value="date-desc">Mới nhất</option><option value="date-asc">Cũ nhất</option><option value="amt-desc">Số tiền giảm dần</option><option value="amt-asc">Số tiền tăng dần</option></select>
        </div>
        <div className="sumline"><span className="c-income num">Thu {fmt(sum('income'))}</span><span className="c-expense num">Chi {fmt(sum('expense'))}</span><span className="c-debt num">Trả nợ {fmt(sum('repay'))}</span><span className="muted">{rows.length} giao dịch</span></div>
        {rows.length === 0 ? <Empty>{data.transactions.length ? 'Không có giao dịch khớp bộ lọc.' : 'Chưa có giao dịch. Nhấn “Thêm giao dịch” để bắt đầu.'}</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Ngày</th><th>Loại</th><th>Nội dung</th><th>Danh mục</th><th>Nguồn / nợ</th><th className="r">Số tiền</th><th /></tr></thead>
            <tbody>{rows.map((t) => {
              const al = state.allocations[t.id];
              return (
                <tr key={t.id}>
                  <td className="nowrap">{fmtDate(t.date)}</td>
                  <td><span className={'tag ' + t.type}>{TYPE_LABEL[t.type]}</span>{t.type !== 'repay' && <small className="muted"> {t.kind === 'regular' ? 'định kỳ' : 'phát sinh'}</small>}</td>
                  <td>{t.content}{t.note && <small className="muted block">{t.note}</small>}</td>
                  <td>{t.category}</td>
                  <td>{t.type === 'expense' ? SOURCE_LABEL[t.source!] : t.type === 'repay' ? <>{DEBT_LABEL[t.debt!]}{al && <small className="muted block">lãi {fmt(al.interest)} · gốc {fmt(al.principal)}</small>}</> : '—'}</td>
                  <td className={'r num c-' + (t.type === 'income' ? 'income' : t.type === 'expense' ? (t.source === 'balance' ? 'expense' : 'debt') : 'debt')}>{t.type === 'income' ? '+' : '−'}{fmt(t.amount)}</td>
                  <td className="nowrap"><button className="btn ghost" onClick={() => setEdit(t)}>Sửa</button><button className="btn ghost" onClick={() => setDel(t)}>Xóa</button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Card>
      {adding && <TxForm title="Thêm giao dịch" data={data} defaultDate={today} submitText="Lưu giao dịch" onClose={() => setAdding(false)} onSubmit={(f) => run((d) => ops.addTx(d, f), 'Đã thêm giao dịch.')} />}
      {edit && <TxForm title="Sửa giao dịch" initial={edit} data={data} defaultDate={today} submitText="Lưu thay đổi" onClose={() => setEdit(null)} onSubmit={(f) => run((d) => ops.updateTx(d, edit.id, f), 'Đã cập nhật giao dịch.')} />}
      {del && <Confirm title="Xóa giao dịch?" danger confirmText="Xóa" onNo={() => setDel(null)} onYes={() => { run((d) => ops.deleteTx(d, del.id), 'Đã xóa giao dịch và tính lại số liệu.'); setDel(null); }}>
        <p>{fmtDate(del.date)} · {del.content} · {fmt(del.amount)}</p><p className="muted">Số dư và nợ sẽ được tính lại từ đầu. Nếu việc xóa làm số dư hoặc nợ bị âm, thao tác sẽ bị từ chối.</p>
      </Confirm>}
    </div>
  );
}
