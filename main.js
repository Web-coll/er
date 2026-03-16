const $ = (s) => document.querySelector(s)
const $$ = (s) => Array.from(document.querySelectorAll(s))

const tabs = $$('.tab')
const sections = {
  personal: $('#tab-personal'),
  business: $('#tab-business'),
  calculators: $('#tab-calculators')
}

// Theme and currency controls
const htmlEl = document.documentElement
const themeToggle = $('#theme-toggle')
const themeKnob = $('#theme-knob')
const currencySel = $('#currency')

function applyTheme(theme) {
  if (theme === 'dark') {
    htmlEl.classList.add('dark')
    if (themeToggle) themeToggle.checked = true
    if (themeKnob) themeKnob.style.transform = 'translateX(1rem)'
  } else {
    htmlEl.classList.remove('dark')
    if (themeToggle) themeToggle.checked = false
    if (themeKnob) themeKnob.style.transform = 'translateX(0)'
  }
}
applyTheme(localStorage.getItem('theme') || 'light')
if (themeToggle) {
  themeToggle.addEventListener('change', () => {
    const mode = themeToggle.checked ? 'dark' : 'light'
    localStorage.setItem('theme', mode)
    applyTheme(mode)
  })
}
if (currencySel) {
  const saved = localStorage.getItem('currency') || 'USD'
  currencySel.value = saved
  currencySel.addEventListener('change', () => {
    localStorage.setItem('currency', currencySel.value)
    // Re-render any existing outputs to reflect new currency
    if (!sections.personal.classList.contains('hidden')) try { pfCalculate(true) } catch {}
    if (!sections.business.classList.contains('hidden')) {
      try { inv.update && inv.update() } catch {}
      try { ba.update && ba.update() } catch {}
      try { cf.update && cf.update() } catch {}
    }
    if (!sections.calculators.classList.contains('hidden')) {
      try { si.update && si.update() } catch {}
      try { ci.update && ci.update() } catch {}
    }
  })
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
  hasdebt: $('#pf-hasdebt'),
  debtRows: $('#pf-debt-rows'),
  debtRows2: $('#pf-debt-rows-2'),
  calc: $('#pf-calc'),
  reset: $('#pf-reset'),
  budgetCanvas: $('#pf-budget-chart'),
  debtCanvas: $('#pf-debt-chart'),
  summary: $('#pf-summary'),
  timeline: $('#pf-timeline'),
  habits: $('#pf-habits'),
  debtSection: $('#pf-debt-section')
}

function n(v) {
  const x = Number(v)
  return isFinite(x) ? x : 0
}

function fmt(n) {
  const code = (currencySel && currencySel.value) || 'USD'
  return n.toLocaleString(undefined, { style: 'currency', currency: code, maximumFractionDigits: 0 })
}

function pfCalculate(skipFocus) {
  const income = n(pfEl.income.value)
  const fixed = n(pfEl.fixed.value)
  const variable = n(pfEl.variable.value)
  const hasDebt = !!(pfEl.hasdebt && pfEl.hasdebt.checked)
  const debt = hasDebt ? n(pfEl.debt.value) : 0
  const rate = hasDebt ? n(pfEl.rate.value) : 0
  const minpay = hasDebt ? n(pfEl.minpay.value) : 0
  const savepct = Math.min(100, Math.max(0, n(pfEl.savepct.value)))

  const available = income - fixed - variable
  const targetSavings = Math.max(0, income * (savepct / 100))
  const savings = Math.min(Math.max(0, available), targetSavings)
  const remainingForDebt = hasDebt ? Math.max(0, available - savings) : 0
  const monthlyPayment = hasDebt ? Math.max(minpay, remainingForDebt) : 0

  const needs = Math.max(0, fixed + variable)
  const debtPay = hasDebt ? Math.min(monthlyPayment, Math.max(0, available - savings) + minpay) : 0
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

  const rows = [
    ['Monthly income', income],
    ['Available after expenses', available],
    ['Recommended savings', savings]
  ]
  if (hasDebt) rows.push(['Recommended debt payment', monthlyPayment])
  pfEl.summary.innerHTML = rows.map(([k, v]) => `<div class="flex justify-between"><span class="subtext">${k}</span><span class="font-medium">${fmt(v)}</span></div>`).join('')

  let months = 0
  if (hasDebt) {
    const mRate = rate > 0 ? rate / 12 / 100 : 0
    let balance = debt
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
        scales: { y: { ticks: { callback: v => fmt(v).replace(/[^\\d.,-]/g,'') ? fmt(v) : '$' + v.toLocaleString() } } }
      }
    })
    pfEl.debtSection.style.display = ''

    let timelineText = ''
    if (debt === 0) {
      timelineText = 'No debt entered'
    } else if (monthlyPayment <= (debt * (rate > 0 ? rate / 12 / 100 : 0)) && rate > 0) {
      timelineText = 'Payment below interest. Increase payment to reduce balance.'
    } else {
      timelineText = months === 0 ? 'Debt paid immediately' : `Estimated payoff time: ${months} months`
    }
    pfEl.timeline.textContent = timelineText
  } else {
    if (pfDebtChart) pfDebtChart.destroy()
    pfEl.debtSection.style.display = 'none'
    pfEl.timeline.textContent = 'Debt not selected'
  }

  const habits = []
  if (available < targetSavings) habits.push('Reduce variable expenses to hit savings target')
  if (savepct < 10) habits.push('Aim for at least 10% savings when feasible')
  if (hasDebt && months > 36) habits.push('Accelerate debt payments to shorten payoff timeline')
  if (discretionary > income * 0.15) habits.push('Channel part of discretionary funds to savings or debt')
  if (habits.length === 0) habits.push('Keep consistent payments and automate savings transfers')
  pfEl.habits.innerHTML = habits.map(h => `<li>${h}</li>`).join('')
}

pfEl.calc.addEventListener('click', pfCalculate)
pfEl.reset.addEventListener('click', () => {
  Object.values(pfEl).forEach(el => {
    if (el && el.tagName === 'INPUT') el.value = ''
  })
  if (pfEl.hasdebt) pfEl.hasdebt.checked = false
  if (pfEl.debtRows) pfEl.debtRows.classList.add('hidden')
  if (pfEl.debtRows2) pfEl.debtRows2.classList.add('hidden')
  pfEl.summary.innerHTML = ''
  pfEl.timeline.textContent = ''
  pfEl.habits.innerHTML = ''
  if (pfBudgetChart) pfBudgetChart.destroy()
  if (pfDebtChart) pfDebtChart.destroy()
})
if (pfEl.hasdebt) {
  const toggleDebtUI = () => {
    const on = pfEl.hasdebt.checked
    pfEl.debtRows.classList.toggle('hidden', !on)
    pfEl.debtRows2.classList.toggle('hidden', !on)
    pfCalculate(true)
  }
  pfEl.hasdebt.addEventListener('change', toggleDebtUI)
}

const inv = {
  cogs: $('#inv-cogs'),
  avg: $('#inv-avg'),
  out: $('#inv-out'),
  calc: $('#inv-calc'),
  reset: $('#inv-reset')
}
inv.calc.addEventListener('click', () => {
  const ratio = n(inv.cogs.value) && n(inv.avg.value) ? n(inv.cogs.value) / n(inv.avg.value) : 0
  let msg = ''
  if (ratio < 4) msg = 'Low turnover'
  else if (ratio <= 8) msg = 'Healthy turnover'
  else msg = 'High turnover'
  inv.out.textContent = `Turnover: ${ratio.toFixed(2)} • ${msg}`
})
inv.reset.addEventListener('click', () => {
  inv.cogs.value = ''
  inv.avg.value = ''
  inv.out.textContent = ''
})
inv.update = () => {
  if (inv.out.textContent) inv.calc.click()
}

const ba = {
  liab: $('#ba-liab'),
  asset: $('#ba-asset'),
  out: $('#ba-out'),
  calc: $('#ba-calc'),
  reset: $('#ba-reset')
}
ba.calc.addEventListener('click', () => {
  const r = n(ba.asset.value) ? n(ba.liab.value) / n(ba.asset.value) : 0
  let risk = ''
  if (r > 0.6) risk = 'High risk'
  else if (r >= 0.4) risk = 'Moderate risk'
  else risk = 'Low risk'
  ba.out.textContent = `Debt ratio: ${r.toFixed(2)} • ${risk}`
})
ba.reset.addEventListener('click', () => {
  ba.liab.value = ''
  ba.asset.value = ''
  ba.out.textContent = ''
})
ba.update = () => {
  if (ba.out.textContent) ba.calc.click()
}

const cf = {
  rev: $('#cf-rev'),
  exp: $('#cf-exp'),
  out: $('#cf-out'),
  calc: $('#cf-calc'),
  reset: $('#cf-reset')
}
cf.calc.addEventListener('click', () => {
  const net = n(cf.rev.value) - n(cf.exp.value)
  let health = ''
  if (net > 0) health = 'Positive cash flow'
  else if (net === 0) health = 'Break-even'
  else health = 'Negative cash flow'
  cf.out.textContent = `Net: ${fmt(net)} • ${health}`
})
cf.reset.addEventListener('click', () => {
  cf.rev.value = ''
  cf.exp.value = ''
  cf.out.textContent = ''
})
cf.update = () => {
  if (cf.out.textContent) cf.calc.click()
}

const si = {
  p: $('#si-principal'),
  r: $('#si-rate'),
  t: $('#si-time'),
  out: $('#si-out'),
  calc: $('#si-calc'),
  reset: $('#si-reset')
}
si.calc.addEventListener('click', () => {
  const P = n(si.p.value)
  const r = n(si.r.value) / 100
  const t = n(si.t.value)
  const I = P * r * t
  const A = P + I
  si.out.textContent = `Interest: ${fmt(I)} • Final: ${fmt(A)}`
})
si.reset.addEventListener('click', () => {
  si.p.value = ''
  si.r.value = ''
  si.t.value = ''
  si.out.textContent = ''
})
si.update = () => {
  if (si.out.textContent) si.calc.click()
}

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
    options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => fmt(v) } } } }
  })
})
ci.update = () => {
  if (ci.out.textContent) ci.calc.click()
}
