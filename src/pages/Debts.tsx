import { useState } from 'react';
import { useStore } from '../store';
import { Card, Empty, Field, MoneyInput, Modal, Stat } from '../components/ui';
import { fmt } from '../lib/format';
import { fmtDate } from '../lib/dates';
import { DEBT_LABEL, DebtConfig, DebtKey } from '../lib/types';
import { dailyRate } from '../lib/engine';
import * as ops from '../lib/ops';

function DebtPanel({ k }: { k: DebtKey }) {
  const { data, state, run } = useStore();
  const s = state.debts[k];
  const [cfg, setCfg] = useState<DebtConfig>(data.debts[k]);
  const [adj, setAdj] = useState(false);
  const [target, setTarget] = useState(s.actual);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState(false);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(data.debts[k]);
  const repays = data.transactions.filter((t) => t.type === 'repay' && t.debt === k).sort((a, b) => b.date.localeCompare(a.date));
  const adjs = data.debtAdjustments.filter((a) => a.debt === k).sort((a, b) => b.createdAt - a.createdAt);
  const hist = data.history.filter((h) => h.debt === k && h.kind === 'config').sort((a, b) => b.at - a.at);
  return (
    <Card title={DEBT_LABEL[k]} actions={<button className="btn" onClick={() => { setTarget(s.actual); setReason(''); setAdj(true); }}>Sửa thực nợ</button>}>
      <div className="grid-stats sm">
        <Stat label="Nợ gốc" value={s.principal} tone="debt" sub="Tự động từ các khoản chi bằng nguồn nợ" />
        <Stat label="Lãi còn phải trả" value={s.interestDue} tone="expense" />
        <Stat label="Thực nợ" value={s.actual} tone="debt" />
      </div>
      <h4>Lãi suất và thời gian tính lãi</h4>
      <div className="grid4">
        <Field label="Lãi suất (%)"><input type="number" min="0" step="0.01" value={cfg.rate} onChange={(e) => setCfg({ ...cfg, rate: Number(e.target.value) })} /></Field>
        <Field label="Tính theo"><select value={cfg.unit} onChange={(e) => setCfg({ ...cfg, unit: e.target.value as 'month' | 'year' })}><option value="year">Năm</option><option value="month">Tháng</option></select></Field>
        <Field label="Từ ngày"><input type="date" value={cfg.start} onChange={(e) => setCfg({ ...cfg, start: e.target.value })} /></Field>
        <Field label="Đến ngày"><input type="date" value={cfg.end} onChange={(e) => setCfg({ ...cfg, end: e.target.value })} /></Field>
      </div>
      <div className="row"><button className="btn primary" disabled={!dirty} onClick={() => run((d) => ops.setDebtConfig(d, k, cfg), 'Đã lưu lãi suất và ghi lịch sử.')}>Lưu cấu hình lãi</button><span className="muted">Để trống ngày = không giới hạn. Mỗi lần đổi đều được ghi lịch sử.</span></div>

      <div className="row between top">
        <h4>Chi tiết cách tính lãi</h4>
        <button className="btn ghost" onClick={() => setDetail(!detail)}>{detail ? 'Ẩn' : 'Hiện'}</button>
      </div>
      {detail && (
        <div className="stack">
          <p className="muted">Lãi đơn theo ngày thực tế = dư nợ gốc × lãi suất ngày × số ngày; lãi suất ngày = {data.debts[k].unit === 'year' ? 'lãi năm ÷ 365' : 'lãi tháng × 12 ÷ 365'} ({(dailyRate(data.debts[k]) * 100).toFixed(5)}%/ngày). Làm tròn đến 1 ₫ cho từng đoạn. Ngày phát sinh khoản nợ không tính lãi.</p>
          {s.segments.length === 0 ? <Empty>Chưa phát sinh lãi (lãi suất bằng 0, nằm ngoài khoảng thời gian tính lãi hoặc chưa có nợ).</Empty> : (
            <div className="table-wrap"><table><thead><tr><th>Từ</th><th>Đến</th><th className="r">Dư nợ gốc</th><th className="r">Số ngày</th><th className="r">Lãi</th></tr></thead>
              <tbody>{s.segments.map((g, i) => <tr key={i}><td>{fmtDate(g.from)}</td><td>{fmtDate(g.to)}</td><td className="r num">{fmt(g.principal)}</td><td className="r">{g.days}</td><td className="r num">{fmt(g.interest)}</td></tr>)}</tbody></table></div>
          )}
          <div className="kv"><span>Lãi phát sinh</span><b className="num">{fmt(s.accrued)}</b><span>Điều chỉnh thủ công</span><b className="num">{fmt(s.adjusted)}</b><span>Lãi đã trả</span><b className="num">−{fmt(s.paidInterest)}</b><span>Lãi còn phải trả</span><b className="num">{fmt(s.interestDue)}</b></div>
        </div>
      )}

      <h4>Lịch sử trả nợ (phân bổ lãi trước, gốc sau)</h4>
      {repays.length === 0 ? <Empty>Chưa có lần trả nợ nào.</Empty> : (
        <div className="table-wrap"><table><thead><tr><th>Ngày</th><th>Nội dung</th><th className="r">Số tiền</th><th className="r">Vào lãi</th><th className="r">Vào gốc</th></tr></thead>
          <tbody>{repays.map((t) => { const a = state.allocations[t.id]; return <tr key={t.id}><td>{fmtDate(t.date)}</td><td>{t.content}</td><td className="r num">{fmt(t.amount)}</td><td className="r num">{a ? fmt(a.interest) : '—'}</td><td className="r num">{a ? fmt(a.principal) : '—'}</td></tr>; })}</tbody></table></div>
      )}
      {(adjs.length > 0 || hist.length > 0) && <>
        <h4>Lịch sử điều chỉnh và thay đổi cấu hình</h4>
        <ul className="log">
          {adjs.map((a) => <li key={a.id}><b>{fmtDate(a.date)}</b> Điều chỉnh lãi {a.delta > 0 ? '+' : ''}{fmt(a.delta)} → thực nợ {fmt(a.targetActual)} · {a.reason}</li>)}
          {hist.map((h) => <li key={h.id}><b>{new Date(h.at).toLocaleString('vi-VN')}</b> {h.description}</li>)}
        </ul>
      </>}
      {adj && (
        <Modal title={`Sửa thực nợ — ${DEBT_LABEL[k]}`} onClose={() => setAdj(false)}>
          <p className="muted">Nợ gốc không đổi. Phần chênh lệch được ghi nhận là điều chỉnh lãi. Thực nợ không được thấp hơn nợ gốc ({fmt(s.principal)}).</p>
          <Field label="Thực nợ mới (₫)"><MoneyInput value={target} onChange={setTarget} autoFocus /></Field>
          <Field label="Lý do (bắt buộc)"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="row end"><button className="btn" onClick={() => setAdj(false)}>Hủy</button><button className="btn primary" onClick={() => { if (run((d) => ops.setActualDebt(d, k, target, reason), 'Đã điều chỉnh thực nợ.')) setAdj(false); }}>Lưu điều chỉnh</button></div>
        </Modal>
      )}
    </Card>
  );
}

export default function Debts() {
  const { state } = useStore();
  return (
    <div className="stack-lg">
      <Card title="Tổng nợ">
        <div className="grid-stats sm">
          <Stat label="Tổng nợ gốc" value={state.totalPrincipal} tone="debt" />
          <Stat label="Tổng lãi" value={state.totalInterest} tone="expense" />
          <Stat label="Tổng thực nợ" value={state.totalActual} tone="debt" />
        </div>
        <p className="muted">Tổng lãi = tổng thực nợ − tổng nợ gốc.</p>
      </Card>
      <DebtPanel k="credit" />
      <DebtPanel k="cash" />
    </div>
  );
}
