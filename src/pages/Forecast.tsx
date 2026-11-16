import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Card, Confirm, Empty, Field, Stat } from '../components/ui';
import { TxForm } from '../components/TxForm';
import { fmt } from '../lib/format';
import { addDays, fmtDate } from '../lib/dates';
import { compute } from '../lib/engine';
import { DEBT_LABEL, Plan, SOURCE_LABEL, TYPE_LABEL } from '../lib/types';
import * as ops from '../lib/ops';

const STATUS = { pending: 'Chờ', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy' };

export default function Forecast() {
  const { data, state, today, run } = useStore();
  const [date, setDate] = useState(addDays(today, 30));
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<Plan | null>(null);
  const [conf, setConf] = useState<{ p: Plan; date: string } | null>(null);
  const [del, setDel] = useState<Plan | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const pending = useMemo(() => data.plans.filter((p) => p.status === 'pending'), [data.plans]);
  const fc = useMemo(() => compute(data, date, pending), [data, date, pending]);
  const net = state.balance - state.totalActual;
  const fcNet = fc.balance - fc.totalActual;
  const list = [...data.plans].filter((p) => filter === 'all' || p.status === 'pending').sort((a, b) => a.date.localeCompare(b.date));
  const cmp = (cur: number, f: number) => `Hiện tại ${fmt(cur)} (${f - cur >= 0 ? '+' : '−'}${fmt(Math.abs(f - cur))})`;

  return (
    <div className="stack-lg">
      <div className="notice">Khoản dự kiến chỉ để mô phỏng, không ảnh hưởng số dư và nợ thực tế cho đến khi bạn bấm “Xác nhận”.</div>
      <Card title="Tình hình tại ngày chọn" actions={<Field label="Xem đến ngày"><input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>}>
        {date < today && <div className="warn">Ngày chọn đã qua: số liệu chỉ gồm các giao dịch đến ngày đó.</div>}
        <div className="grid-stats sm">
          <Stat label="Dư dự kiến" value={fc.balance} tone="balance" sub={cmp(state.balance, fc.balance)} />
          <Stat label="Nợ gốc dự kiến" value={fc.totalPrincipal} tone="debt" sub={cmp(state.totalPrincipal, fc.totalPrincipal)} />
          <Stat label="Lãi dự kiến" value={fc.totalInterest} tone="expense" sub={cmp(state.totalInterest, fc.totalInterest)} />
          <Stat label="Tổng thực nợ dự kiến" value={fc.totalActual} tone="debt" sub={cmp(state.totalActual, fc.totalActual)} />
        </div>
        <div className="grid-stats sm">
          <Stat label="Nợ tín dụng/ngân hàng dự kiến" value={fc.debts.credit.actual} size="sm" sub={`Gốc ${fmt(fc.debts.credit.principal)}`} />
          <Stat label="Nợ tiền mặt dự kiến" value={fc.debts.cash.actual} size="sm" sub={`Gốc ${fmt(fc.debts.cash.principal)}`} />
          <Stat label="Tài sản ròng dự kiến" value={fcNet} size="sm" sub={cmp(net, fcNet)} />
        </div>
        {fc.errors.length > 0 && <div className="warn"><b>Cảnh báo mô phỏng:</b><ul>{fc.errors.slice(0, 4).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      </Card>
      <Card title="Thu / chi dự kiến" actions={<>
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'pending' | 'all')} aria-label="Lọc"><option value="pending">Đang chờ</option><option value="all">Tất cả</option></select>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Thêm dự kiến</button>
      </>}>
        {list.length === 0 ? <Empty>Chưa có khoản dự kiến. Thêm khoản thu, chi hoặc trả nợ ở các ngày tương lai để xem dư và nợ thay đổi thế nào.</Empty> : (
          <div className="table-wrap"><table><thead><tr><th>Ngày</th><th>Loại</th><th>Nội dung</th><th>Nguồn / nợ</th><th className="r">Số tiền</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>{list.map((p) => (
              <tr key={p.id} className={p.status !== 'pending' ? 'dim' : ''}>
                <td className="nowrap">{fmtDate(p.date)}</td><td><span className={'tag ' + p.type}>{TYPE_LABEL[p.type]}</span></td><td>{p.content}<small className="muted block">{p.category}</small></td>
                <td>{p.type === 'expense' ? SOURCE_LABEL[p.source!] : p.type === 'repay' ? DEBT_LABEL[p.debt!] : '—'}</td>
                <td className="r num">{fmt(p.amount)}</td><td>{STATUS[p.status]}</td>
                <td className="nowrap">{p.status === 'pending' ? <>
                  <button className="btn ghost" onClick={() => setConf({ p, date: p.date <= today ? p.date : today })}>Xác nhận</button>
                  <button className="btn ghost" onClick={() => setEdit(p)}>Sửa</button>
                  <button className="btn ghost" onClick={() => run((d) => ops.setPlanStatus(d, p.id, 'cancelled'), 'Đã hủy khoản dự kiến.')}>Hủy</button>
                </> : null}<button className="btn ghost" onClick={() => setDel(p)}>Xóa</button></td>
              </tr>))}</tbody></table></div>
        )}
      </Card>
      {adding && <TxForm title="Thêm khoản dự kiến" data={data} defaultDate={addDays(today, 1)} submitText="Lưu dự kiến" onClose={() => setAdding(false)} onSubmit={(f) => run((d) => ops.addPlan(d, f), 'Đã thêm khoản dự kiến.')} />}
      {edit && <TxForm title="Sửa khoản dự kiến" initial={edit} data={data} defaultDate={today} submitText="Lưu thay đổi" onClose={() => setEdit(null)} onSubmit={(f) => run((d) => ops.updatePlan(d, edit.id, f), 'Đã cập nhật khoản dự kiến.')} />}
      {conf && <Confirm title="Xác nhận thành giao dịch thực tế" onNo={() => setConf(null)} onYes={() => { if (run((d) => ops.confirmPlan(d, conf.p.id, conf.date), 'Đã chuyển thành giao dịch thực tế.')) setConf(null); }}>
        <p>{conf.p.content} · {fmt(conf.p.amount)}</p>
        <Field label="Ngày phát sinh thực tế" hint="Phải là hôm nay hoặc trước đó. Khoản này chỉ được ghi nhận một lần."><input type="date" max={today} value={conf.date} onChange={(e) => setConf({ ...conf, date: e.target.value })} /></Field>
      </Confirm>}
      {del && <Confirm title="Xóa khoản dự kiến?" danger confirmText="Xóa" onNo={() => setDel(null)} onYes={() => { run((d) => ops.deletePlan(d, del.id), 'Đã xóa khoản dự kiến.'); setDel(null); }}>
        <p>{del.content} · {fmt(del.amount)}</p>{del.status === 'confirmed' && <p className="muted">Giao dịch thực tế đã tạo từ khoản này vẫn được giữ nguyên.</p>}
      </Confirm>}
    </div>
  );
}
