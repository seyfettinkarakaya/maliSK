// Çapa geri testi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { backtest } from '../src/model/backtest.mjs';

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `beklenen ${b}, bulunan ${a}`);
const months = (n) => Array.from({ length: n }, (_, i) => `20${21 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-28`);

test('sabit büyüme: yıllık getiri, düşüş yok', () => {
  const dates = months(25);
  const r = backtest({ gold: 50, tl_fixed: 50 }, { dates, series: { gold: dates.map((_, i) => 1.02 ** i), tl_fixed: dates.map((_, i) => 1.01 ** i) } });
  assert.equal(r.ok, true);
  assert.equal(r.months, 24);
  near(r.annual_return_pct, (1.015 ** 12 - 1) * 100, 1e-9);
  near(r.max_drawdown_pct, 0, 1e-12);
  near(r.worst_12m_pct, (1.015 ** 12 - 1) * 100, 1e-9);
});

test('düşüş ve eksik sınıf', () => {
  const dates = months(14);
  const gold = dates.map((_, i) => (i < 6 ? 1 : 0.8));
  const r = backtest({ gold: 100, silver: 20 }, { dates, series: { gold } });
  assert.deepEqual(r.missing, ['silver']);
  near(r.max_drawdown_pct, -20, 1e-9);
  near(r.worst_12m_pct, -20, 1e-9);
  assert.equal(backtest({ gold: 100 }, { dates: months(5), series: { gold: [1, 1, 1, 1, 1] } }).ok, false);
});
