const $ = (s) => document.querySelector(s)
const $$ = (s) => Array.from(document.querySelectorAll(s))

const tabs = $$('.tab')
const sections = {
  personal: $('#tab-personal'),
  business: $('#tab-business'),
  calculators: $('#tab-calculators')
}

function showTab(key) {
  Object.values(sections).forEach(el => el.classList.add('hidden'))
  tabs.forEach(t => t.classList.remove('tab-active'))
  sections[key].classList.remove('hidden')
  const btn = tabs.find(t => t.dataset.tab === key)
  if (btn) btn.classList.add('tab-active')
}

tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)))
showTab('personal')

let pfBudgetChart
let pfDebtChart
const pfEl = {
  income: $('#pf-income'),
  fixed: $('#pf-fixed'),
  variable: $('#pf-variable'),
  debt: $('#pf-debt'),
  rate: $('#pf-rate'),
  minpay: $('#pf-minpay'),
  savepct: $('#pf-savepct'),
  calc: $('#pf-calc'),
  reset: $('#pf-reset'),
  budgetCanvas: $('#pf-budget-chart'),
  debtCanvas: $('#pf-debt-chart'),
  summary: $('#pf-summary'),
  timeline: $('#pf-timeline'),
  habits: $('#pf-habits')
}

function n(v) {
  const x = Number(v)
  return isFinite(x) ? x : 0
}

function fmt(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pfCalculate() {
  const income = n(pfEl.income.value)
  const fixed = n(pfEl.fixed.value)
  const variable = n(pfEl.variable.value)
  const debt = n(pfEl.debt.value)
  const rate = n(pfEl.rate.value)
  const minpay = n(pfEl.minpay.value)
  const savepct = Math.min(100, Math.max(0, n(pfEl.savepct.value)))

  const available = income - fixed - variable
  const targetSavings = Math.max(0, income * (savepct / 100))
  const savings = Math.min(Math.max(0, available), targetSavings)
  const remainingForDebt = Math.max(0, available - savings)
  const monthlyPayment = Math.max(minpay, remainingForDebt)

  const needs = Math.max(0, fixed + variable)
  const debtPay = Math.min(monthlyPayment, Math.max(0, available - savings) + minpay)
  const discretionary = Math.max(0, available - savings - monthlyPayment)

  const labels = ['Needs', 'Debt', 'Savings', 'Discretionary']
  const data = [needs, debtPay, savings, discretionary]
  const bg = ['#0ea5e930', '#10b98130', '#1e293b30', '#94a3b830']
  const border = ['#0ea5e9', '#10b981', '#1e293b', '#94a3b8']

  if (pfBudgetChart) pfBudgetChart.destroy()
  pfBudgetChart = new Chart(pfEl.budgetCanvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: bg, borderColor: border, borderWidth: 1 }] },
    options: { plugins: { legend: { position: 'bottom' } } }
  })

  pfEl.summary.innerHTML = [
    ['Monthly income', income],
    ['Available after expenses', available],
    ['Recommended savings', savings],
    ['Recommended debt payment', monthlyPayment]
  ].map(([k, v]) => `<div class="flex justify-between"><span class="text-slate-500">${k}</span><span class="font-medium">${fmt(v)}</span></div>`).join('')

  const mRate = rate > 0 ? rate / 12 / 100 : 0
  let balance = debt
  let months = 0
  const maxMonths = 600
  const points = []
  if (monthlyPayment <= balance * mRate && balance > 0) {
    points.push({ x: 0, y: balance })
  } else {
    while (balance > 0 && months < maxMonths) {
      points.push({ x: months, y: Math.max(0, balance) })
      const interest = balance * mRate
      const principal = monthlyPayment - interest
      if (principal <= 0) break
      balance = Math.max(0, balance - principal)
      months++
    }
    points.push({ x: months, y: Math.max(0, balance) })
  }

  if (pfDebtChart) pfDebtChart.destroy()
  pfDebtChart = new Chart(pfEl.debtCanvas, {
    type: 'line',
    data: {
      labels: points.map(p => `M${p.x}`),
      datasets: [{ data: points.map(p => p.y), borderColor: '#0ea5e9', fill: false, tension: 0.2 }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { ticks: { callback: v => '$' + v.toLocaleString() } } }
    }
  })

  let timelineText = ''
  if (debt === 0) {
    timelineText = 'No debt entered'
  } else if (monthlyPayment <= debt * mRate && mRate > 0) {
    timelineText = 'Payment below interest. Increase payment to reduce balance.'
  } else {
    timelineText = months === 0 ? 'Debt paid immediately' : `Estimated payoff time: ${months} months`
  }
  pfEl.timeline.textContent = timelineText

  const habits = []
  if (available < targetSavings) habits.push('Reduce variable expenses to hit savings target')
  if (savepct < 10) habits.push('Aim for at least 10% savings when feasible')
  if (months > 36) habits.push('Accelerate debt payments to shorten payoff timeline')
  if (discretionary > income * 0.15) habits.push('Channel part of discretionary funds to savings or debt')
  if (habits.length === 0) habits.push('Keep consistent payments and automate savings transfers')
  pfEl.habits.innerHTML = habits.map(h => `<li>${h}</li>`).join('')
}

pfEl.calc.addEventListener('click', pfCalculate)
pfEl.reset.addEventListener('click', () => {
  Object.values(pfEl).forEach(el => {
    if (el && el.tagName === 'INPUT') el.value = ''
  })
  pfEl.summary.innerHTML = ''
  pfEl.timeline.textContent = ''
  pfEl.habits.innerHTML = ''
  if (pfBudgetChart) pfBudgetChart.destroy()
  if (pfDebtChart) pfDebtChart.destroy()
})

const inv = {
  cogs: $('#inv-cogs'),
  avg: $('#inv-avg'),
  out: $('#inv-out'),
  calc: $('#inv-calc')
}
inv.calc.addEventListener('click', () => {
  const ratio = n(inv.cogs.value) && n(inv.avg.value) ? n(inv.cogs.value) / n(inv.avg.value) : 0
  let msg = ''
  if (ratio < 4) msg = 'Low turnover'
  else if (ratio <= 8) msg = 'Healthy turnover'
  else msg = 'High turnover'
  inv.out.textContent = `Turnover: ${ratio.toFixed(2)} • ${msg}`
})

const ba = {
  liab: $('#ba-liab'),
  asset: $('#ba-asset'),
  out: $('#ba-out'),
  calc: $('#ba-calc')
}
ba.calc.addEventListener('click', () => {
  const r = n(ba.asset.value) ? n(ba.liab.value) / n(ba.asset.value) : 0
  let risk = ''
  if (r > 0.6) risk = 'High risk'
  else if (r >= 0.4) risk = 'Moderate risk'
  else risk = 'Low risk'
  ba.out.textContent = `Debt ratio: ${r.toFixed(2)} • ${risk}`
})

const cf = {
  rev: $('#cf-rev'),
  exp: $('#cf-exp'),
  out: $('#cf-out'),
  calc: $('#cf-calc')
}
cf.calc.addEventListener('click', () => {
  const net = n(cf.rev.value) - n(cf.exp.value)
  let health = ''
  if (net > 0) health = 'Positive cash flow'
  else if (net === 0) health = 'Break-even'
  else health = 'Negative cash flow'
  cf.out.textContent = `Net: ${fmt(net)} • ${health}`
})

const si = {
  p: $('#si-principal'),
  r: $('#si-rate'),
  t: $('#si-time'),
  out: $('#si-out'),
  calc: $('#si-calc')
}
si.calc.addEventListener('click', () => {
  const P = n(si.p.value)
  const r = n(si.r.value) / 100
  const t = n(si.t.value)
  const I = P * r * t
  const A = P + I
  si.out.textContent = `Interest: ${fmt(I)} • Final: ${fmt(A)}`
})

let ciChart
const ci = {
  p: $('#ci-principal'),
  r: $('#ci-rate'),
  f: $('#ci-freq'),
  t: $('#ci-time'),
  out: $('#ci-out'),
  calc: $('#ci-calc'),
  canvas: $('#ci-chart')
}
ci.calc.addEventListener('click', () => {
  const P = n(ci.p.value)
  const r = n(ci.r.value) / 100
  const f = n(ci.f.value)
  const t = n(ci.t.value)
  const A = P * Math.pow(1 + r / f, f * t)
  ci.out.textContent = `Future value: ${fmt(A)}`
  const labels = []
  const series = []
  const steps = Math.max(1, Math.round(t))
  for (let year = 0; year <= steps; year++) {
    const val = P * Math.pow(1 + r / f, f * year)
    labels.push(`Y${year}`)
    series.push(val)
  }
  if (ciChart) ciChart.destroy()
  ciChart = new Chart(ci.canvas, {
    type: 'line',
    data: { labels, datasets: [{ data: series, borderColor: '#10b981', tension: 0.2 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => '$' + v.toLocaleString() } } } }
  })
})

