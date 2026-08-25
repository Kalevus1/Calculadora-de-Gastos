import React, { useState, useEffect } from "react";
import { Trash2, DollarSign, Users, Calculator, Plus, X, Download } from "lucide-react";

const MON = "S/.";

type Persona = { id: number; name: string };
type Gasto = { id: number; description: string; amount: number; paidBy: number; split: number[] };
type Deuda = { from: number; to: number; amount: number };
type NuevoGasto = { description: string; amount: string; paidBy: number; split: number[] };
type Estado = { people: Persona[]; nextId: number; expenses: Gasto[]; newExpense: NuevoGasto };

// Reparte 'monto' entre n en CÉNTIMOS enteros que suman exacto (nada se pierde).
function cuotasCent(monto: number, n: number): number[] {
  const cent = Math.round(monto * 100);
  const base = Math.floor(cent / n);
  const resto = cent - base * n;
  return Array.from({ length: n }, (_, k) => base + (k < resto ? 1 : 0));
}

// Liquidación por saldos netos (en céntimos enteros): pocas transferencias, sin fracciones perdidas.
function liquidar(personas: Persona[], gastos: Gasto[]): Deuda[] {
  const saldo: Record<number, number> = {};
  personas.forEach((p) => (saldo[p.id] = 0));
  gastos.forEach((g) => {
    const parts = g.split.filter((p) => p in saldo);
    const n = parts.length;
    if (n === 0) return;
    const cuotas = cuotasCent(g.amount, n);
    if (g.paidBy in saldo) saldo[g.paidBy] += Math.round(g.amount * 100);
    parts.forEach((p, k) => {
      saldo[p] -= cuotas[k];
    });
  });
  const acre = Object.keys(saldo)
    .map((k) => [Number(k), saldo[Number(k)]] as [number, number])
    .filter((x) => x[1] > 0)
    .sort((a, b) => b[1] - a[1]);
  const deu = Object.keys(saldo)
    .map((k) => [Number(k), -saldo[Number(k)]] as [number, number])
    .filter((x) => x[1] > 0)
    .sort((a, b) => b[1] - a[1]);
  const res: Deuda[] = [];
  let i = 0, j = 0;
  while (i < deu.length && j < acre.length) {
    const pago = Math.min(deu[i][1], acre[j][1]);
    if (pago > 0) res.push({ from: deu[i][0], to: acre[j][0], amount: pago / 100 });
    deu[i][1] -= pago;
    acre[j][1] -= pago;
    if (deu[i][1] === 0) i++;
    if (acre[j][1] === 0) j++;
  }
  return res;
}

// ---- persistencia (localStorage) ----
const LS_KEY = "calculadoraGastos.estado";
function cargarEstado(): Estado | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Estado;
    if (d && Array.isArray(d.people) && d.people.length) return d;
  } catch {
    /* estado corrupto → arranca limpio */
  }
  return null;
}
const PERSONAS_INICIALES = (): Persona[] => [1, 2, 3, 4, 5].map((i) => ({ id: i, name: "" }));
const NUEVO_GASTO_INICIAL = (): NuevoGasto => ({ description: "", amount: "", paidBy: 1, split: [1, 2, 3, 4, 5] });

export default function ExpenseSplitter() {
  const guardado = cargarEstado();                      // se ejecuta una vez (lazy init)
  const [people, setPeople] = useState<Persona[]>(() => guardado?.people ?? PERSONAS_INICIALES());
  const [nextId, setNextId] = useState<number>(() => guardado?.nextId ?? 6);
  const [expenses, setExpenses] = useState<Gasto[]>(() => guardado?.expenses ?? []);
  const [newExpense, setNewExpense] = useState<NuevoGasto>(() => guardado?.newExpense ?? NUEVO_GASTO_INICIAL());

  // Guarda la sesión cada vez que cambia el estado.
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ people, nextId, expenses, newExpense }));
    } catch {
      /* almacenamiento no disponible → se ignora */
    }
  }, [people, nextId, expenses, newExpense]);

  const limpiarTodo = () => {
    const hayDatos = expenses.length > 0 || people.some((p) => (p.name || "").trim());
    if (hayDatos && !window.confirm("¿Borrar todos los participantes y gastos y empezar de cero?")) return;
    setPeople(PERSONAS_INICIALES());
    setNextId(6);
    setExpenses([]);
    setNewExpense(NUEVO_GASTO_INICIAL());
  };

  // El nombre visible es el escrito, o "Persona N" por posición (placeholder).
  const display = (i: number) => (people[i].name || "").trim() || `Persona ${i + 1}`;
  const nombreDe = (pid: number) => {
    const i = people.findIndex((p) => p.id === pid);
    return i >= 0 ? display(i) : "?";
  };

  const addPerson = () => {
    if (people.length >= 20) return;
    const nid = nextId;
    setNextId(nid + 1);
    setPeople([...people, { id: nid, name: "" }]);
    setNewExpense((prev) => ({ ...prev, split: [...prev.split, nid] }));
  };

  const removePerson = (id: number) => {
    if (people.length <= 1) return;
    const nuevas = people.filter((p) => p.id !== id);
    const primero = nuevas[0].id;
    setPeople(nuevas);
    setExpenses(
      expenses
        .map((exp) => ({
          ...exp,
          paidBy: exp.paidBy === id ? primero : exp.paidBy,
          split: exp.split.filter((x) => x !== id),
        }))
        .filter((exp) => exp.split.length > 0)
    );
    setNewExpense((prev) => ({
      ...prev,
      paidBy: prev.paidBy === id ? primero : prev.paidBy,
      split: prev.split.filter((x) => x !== id),
    }));
  };

  const updateName = (id: number, name: string) => {
    setPeople(people.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const toggleSplit = (id: number) => {
    setNewExpense((prev) => ({
      ...prev,
      split: prev.split.includes(id) ? prev.split.filter((x) => x !== id) : [...prev.split, id],
    }));
  };
  const selectAll = () => setNewExpense((prev) => ({ ...prev, split: people.map((p) => p.id) }));
  const deselectAll = () => setNewExpense((prev) => ({ ...prev, split: [] }));

  const addExpense = () => {
    const monto = parseFloat(newExpense.amount.replace(",", "."));
    if (!newExpense.description.trim() || !(monto > 0) || newExpense.split.length === 0) return;
    setExpenses([
      ...expenses,
      { id: Date.now(), description: newExpense.description.trim(), amount: monto, paidBy: newExpense.paidBy, split: [...newExpense.split] },
    ]);
    setNewExpense((prev) => ({ ...prev, description: "", amount: "" }));
  };

  const deleteExpense = (id: number) => setExpenses(expenses.filter((exp) => exp.id !== id));

  const debts = liquidar(people, expenses);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const downloadPDF = () => {
    const w = window.open("", "", "height=800,width=800");
    if (!w) return;
    const fecha = new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });
    const gastosHTML = expenses
      .map((exp) => {
        const per = (exp.amount / exp.split.length).toFixed(2);
        return `<div style="margin:0 0 14px;padding:12px;background:#f9fafb;border-left:4px solid #4f46e5;border-radius:8px;">
          <b>${exp.description}</b><br><span style="color:#6b7280">Pagado por: <b>${nombreDe(exp.paidBy)}</b> · Total: <b style="color:#4f46e5">${MON} ${exp.amount.toFixed(2)}</b></span><br>
          <span style="color:#6b7280">Dividido entre ${exp.split.length} (${MON} ${per} c/u): ${exp.split.map(nombreDe).join(", ")}</span></div>`;
      })
      .join("");
    const deudasHTML = debts.length === 0
      ? '<p style="text-align:center;color:#6b7280">¡Todo está equilibrado! 🎉</p>'
      : debts.map((d) => `<div style="margin:0 0 10px;padding:12px;background:#d1fae5;border-left:4px solid #10b981;border-radius:8px;"><b>${nombreDe(d.from)}</b> → <b>${nombreDe(d.to)}</b> <b style="float:right;color:#059669">${MON} ${d.amount.toFixed(2)}</b></div>`).join("");
    w.document.write(`<html><head><title>Resumen de Gastos</title></head>
      <body style="font-family:Segoe UI,Arial;padding:40px;color:#1f2937">
      <h1 style="color:#4f46e5">📊 Resumen de Gastos Compartidos</h1>
      <p style="color:#6b7280">Generado el: ${fecha}</p>
      <h2>💰 Gastos (${expenses.length})</h2>${gastosHTML || "<p>Sin gastos</p>"}
      <div style="background:#eef2ff;padding:12px;border-radius:8px;text-align:center;margin:16px 0">Total: <b style="color:#4f46e5;font-size:22px">${MON} ${totalExpenses.toFixed(2)}</b></div>
      <h2>🧮 ¿Quién debe a quién?</h2>${deudasHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  const puedeAgregar =
    !!newExpense.description.trim() &&
    parseFloat(newExpense.amount.replace(",", ".")) > 0 &&
    newExpense.split.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Calculadora de Gastos</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={limpiarTodo}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-500 border border-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg transition-colors font-semibold">
                <Trash2 className="w-5 h-5" />
                <span className="hidden md:inline">Limpiar todo</span>
              </button>
              {expenses.length > 0 && (
                <button onClick={downloadPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-semibold">
                  <Download className="w-5 h-5" />
                  <span className="hidden md:inline">Descargar PDF</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl mb-6 border border-indigo-200">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" /> Participantes ({people.length})
              </h3>
              {people.length < 20 && (
                <button onClick={addPerson}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold">
                  <Plus className="w-4 h-4" /> Agregar Persona
                </button>
              )}
            </div>
            <div className="space-y-3">
              {people.map((p, index) => (
                <div key={p.id} className="flex gap-2">
                  <input type="text" value={p.name}
                    placeholder={`Persona ${index + 1}`}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => updateName(p.id, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  {people.length > 1 && (
                    <button onClick={() => removePerson(p.id)}
                      className="px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción del gasto</label>
              <input type="text" placeholder="Ej: Cena en restaurante" value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Monto ({MON})</label>
              <input type="number" placeholder="0.00" step="0.01" value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">¿Quién pagó?</label>
            <select value={newExpense.paidBy}
              onChange={(e) => setNewExpense({ ...newExpense, paidBy: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
              {people.map((p, i) => (
                <option key={p.id} value={p.id}>{display(i)}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users className="w-4 h-4" /> ¿Para quiénes es el gasto?
              </label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors">Todos</button>
                <button onClick={deselectAll} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">Ninguno</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {people.map((p, i) => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors">
                  <input type="checkbox" checked={newExpense.split.includes(p.id)}
                    onChange={() => toggleSplit(p.id)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-gray-700 truncate">{display(i)}</span>
                </label>
              ))}
            </div>
          </div>

          <button onClick={addExpense} disabled={!puedeAgregar}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
            Agregar Gasto
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-indigo-600" /> Gastos Registrados
            </h2>
            {expenses.length === 0 ? (
              <p className="text-gray-500 text-center py-6 bg-indigo-50 rounded-lg">No hay gastos registrados aún</p>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div key={expense.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">{expense.description}</h3>
                        <p className="text-sm text-gray-600">Pagado por: <span className="font-medium">{nombreDe(expense.paidBy)}</span></p>
                      </div>
                      <button onClick={() => deleteExpense(expense.id)} className="text-red-500 hover:text-red-700 ml-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs text-gray-500">
                        Dividido entre: {expense.split.length}
                        <span className="ml-1 text-gray-400">({MON} {(expense.amount / expense.split.length).toFixed(2)} c/u)</span>
                      </p>
                      <p className="text-lg font-bold text-indigo-600">{MON} {expense.amount.toFixed(2)}</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Desglose:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {expense.split.map((pid) => (
                          <div key={pid} className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
                            <span className="text-gray-700">{nombreDe(pid)}:</span>
                            <span className="ml-1 font-semibold text-indigo-600">{MON} {(expense.amount / expense.split.length).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t-2 border-indigo-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-800">Total:</span>
                    <span className="text-2xl font-bold text-indigo-600">{MON} {totalExpenses.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-green-600" /> ¿Quién debe a quién?
            </h2>
            {debts.length === 0 ? (
              <p className="text-gray-500 text-center py-6 bg-indigo-50 rounded-lg">
                {expenses.length === 0 ? "Agrega gastos para ver las deudas" : "¡Todo está equilibrado! 🎉"}
              </p>
            ) : (
              <div className="space-y-4">
                {debts.map((debt, index) => (
                  <div key={index} className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-l-4 border-green-500">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-gray-700">
                        <span className="font-bold text-gray-900">{nombreDe(debt.from)}</span>
                        <span className="mx-2 text-gray-500">→</span>
                        <span className="font-bold text-gray-900">{nombreDe(debt.to)}</span>
                      </p>
                      <p className="text-2xl font-bold text-green-600">{MON} {debt.amount.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
