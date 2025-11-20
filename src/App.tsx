import React, { useState } from "react";
import {
  Trash2,
  DollarSign,
  Users,
  Calculator,
  Plus,
  X,
  Settings,
  Download,
} from "lucide-react";

export default function ExpenseSplitter() {
  const [showSettings, setShowSettings] = useState(true);
  const [people, setPeople] = useState([
    "Persona 1",
    "Persona 2",
    "Persona 3",
    "Persona 4",
    "Persona 5",
  ]);
  const [nextPersonNumber, setNextPersonNumber] = useState(6);
  const [expenses, setExpenses] = useState([]);
  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: "",
    paidBy: "Persona 1",
    splitBetween: [
      "Persona 1",
      "Persona 2",
      "Persona 3",
      "Persona 4",
      "Persona 5",
    ],
  });

  const addPerson = () => {
    if (people.length < 20) {
      const newPerson = `Persona ${nextPersonNumber}`;
      setPeople([...people, newPerson]);
      setNextPersonNumber(nextPersonNumber + 1);
    }
  };

  const removePerson = (index) => {
    if (people.length > 1) {
      const personToRemove = people[index];
      const newPeople = people.filter((_, i) => i !== index);
      setPeople(newPeople);

      // Actualizar gastos existentes
      setExpenses(
        expenses
          .map((exp) => ({
            ...exp,
            paidBy: exp.paidBy === personToRemove ? newPeople[0] : exp.paidBy,
            splitBetween: exp.splitBetween.filter((p) => p !== personToRemove),
          }))
          .filter((exp) => exp.splitBetween.length > 0)
      );

      // Actualizar nuevo gasto
      setNewExpense((prev) => ({
        ...prev,
        paidBy: prev.paidBy === personToRemove ? newPeople[0] : prev.paidBy,
        splitBetween: prev.splitBetween.filter((p) => p !== personToRemove),
      }));
    }
  };

  const updatePersonName = (index, newName) => {
    const oldName = people[index];
    const newPeople = [...people];
    newPeople[index] = newName;
    setPeople(newPeople);

    // Actualizar gastos existentes
    setExpenses(
      expenses.map((exp) => ({
        ...exp,
        paidBy: exp.paidBy === oldName ? newName : exp.paidBy,
        splitBetween: exp.splitBetween.map((p) =>
          p === oldName ? newName : p
        ),
      }))
    );

    // Actualizar nuevo gasto
    setNewExpense((prev) => ({
      ...prev,
      paidBy: prev.paidBy === oldName ? newName : prev.paidBy,
      splitBetween: prev.splitBetween.map((p) => (p === oldName ? newName : p)),
    }));
  };

  const handleSplitToggle = (person) => {
    setNewExpense((prev) => ({
      ...prev,
      splitBetween: prev.splitBetween.includes(person)
        ? prev.splitBetween.filter((p) => p !== person)
        : [...prev.splitBetween, person],
    }));
  };

  const selectAllPeople = () => {
    setNewExpense((prev) => ({ ...prev, splitBetween: [...people] }));
  };

  const deselectAllPeople = () => {
    setNewExpense((prev) => ({ ...prev, splitBetween: [] }));
  };

  const addExpense = () => {
    if (
      newExpense.description &&
      newExpense.amount &&
      newExpense.paidBy &&
      newExpense.splitBetween.length > 0
    ) {
      setExpenses([
        ...expenses,
        {
          ...newExpense,
          amount: parseFloat(newExpense.amount),
          id: Date.now(),
        },
      ]);
      setNewExpense({
        description: "",
        amount: "",
        paidBy: newExpense.paidBy,
        splitBetween: newExpense.splitBetween, // Mantener la selección anterior
      });
    }
  };

  const deleteExpense = (id) => {
    setExpenses(expenses.filter((exp) => exp.id !== id));
  };

  const calculateDebts = () => {
    const debts = [];

    // Para cada gasto, calcular las deudas directas
    expenses.forEach((expense) => {
      const perPersonAmount =
        Math.round((expense.amount / expense.splitBetween.length) * 100) / 100;

      expense.splitBetween.forEach((person) => {
        // Si la persona no es quien pagó, debe dinero
        if (person !== expense.paidBy) {
          debts.push({
            from: person,
            to: expense.paidBy,
            amount: perPersonAmount,
            expenseDescription: expense.description,
          });
        }
      });
    });

    // Consolidar deudas entre las mismas personas
    const consolidatedDebts = {};

    debts.forEach((debt) => {
      const key = `${debt.from}→${debt.to}`;
      if (!consolidatedDebts[key]) {
        consolidatedDebts[key] = {
          from: debt.from,
          to: debt.to,
          amount: 0,
        };
      }
      consolidatedDebts[key].amount =
        Math.round((consolidatedDebts[key].amount + debt.amount) * 100) / 100;
    });

    // Calcular deudas netas (restar deudas bidireccionales)
    const netDebts = [];
    const processed = new Set();

    Object.values(consolidatedDebts).forEach((debt) => {
      const reverseKey = `${debt.to}→${debt.from}`;
      const forwardKey = `${debt.from}→${debt.to}`;

      if (processed.has(forwardKey) || processed.has(reverseKey)) {
        return;
      }

      const reverseDebt = consolidatedDebts[reverseKey];

      if (reverseDebt) {
        // Hay deuda bidireccional, calcular la diferencia
        const netAmount =
          Math.round((debt.amount - reverseDebt.amount) * 100) / 100;

        if (Math.abs(netAmount) > 0.01) {
          netDebts.push({
            from: netAmount > 0 ? debt.from : debt.to,
            to: netAmount > 0 ? debt.to : debt.from,
            amount: Math.abs(netAmount),
          });
        }

        processed.add(forwardKey);
        processed.add(reverseKey);
      } else {
        // Solo hay deuda en una dirección
        if (debt.amount > 0.01) {
          netDebts.push(debt);
        }
        processed.add(forwardKey);
      }
    });

    // Ordenar por persona que debe
    return netDebts.sort((a, b) => {
      if (a.from !== b.from) {
        return a.from.localeCompare(b.from);
      }
      return a.to.localeCompare(b.to);
    });
  };

  const debts = calculateDebts();
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const downloadPDF = () => {
    const printWindow = window.open("", "", "height=800,width=800");

    const currentDate = new Date().toLocaleDateString("es-PE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let expensesHTML = "";
    expenses.forEach((expense) => {
      const perPerson = (expense.amount / expense.splitBetween.length).toFixed(
        2
      );
      expensesHTML += `
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border-left: 4px solid #4f46e5; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px;">${
            expense.description
          }</h3>
          <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Pagado por: <strong>${
            expense.paidBy
          }</strong></p>
          <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">
            Monto total: <strong style="color: #4f46e5;">S/. ${expense.amount.toFixed(
              2
            )}</strong>
          </p>
          <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">
            Dividido entre ${expense.splitBetween.length} persona${
        expense.splitBetween.length !== 1 ? "s" : ""
      } 
            (S/. ${perPerson} c/u)
          </p>
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 5px 0; color: #374151; font-size: 13px; font-weight: 600;">Desglose:</p>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px;">
              ${expense.splitBetween
                .map(
                  (person) => `
                <div style="background: white; padding: 6px 10px; border-radius: 4px; border: 1px solid #e5e7eb; font-size: 12px;">
                  ${person}: <strong style="color: #4f46e5;">S/. ${perPerson}</strong>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        </div>
      `;
    });

    let debtsHTML = "";
    if (debts.length === 0) {
      debtsHTML =
        '<p style="text-align: center; color: #6b7280; padding: 40px 0;">¡Todo está equilibrado! 🎉</p>';
    } else {
      debts.forEach((debt) => {
        debtsHTML += `
          <div style="margin-bottom: 15px; padding: 15px; background: linear-gradient(to right, #d1fae5, #a7f3d0); border-left: 4px solid #10b981; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <p style="margin: 0; color: #374151; font-size: 15px;">
                <strong>${debt.from}</strong> 
                <span style="color: #6b7280; margin: 0 8px;">→</span> 
                <strong>${debt.to}</strong>
              </p>
              <p style="margin: 0; font-size: 24px; font-weight: bold; color: #059669;">
                S/. ${debt.amount.toFixed(2)}
              </p>
            </div>
          </div>
        `;
      });
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Resumen de Gastos Compartidos</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
              padding: 40px;
              background: white;
              color: #1f2937;
            }
            h1 { 
              color: #4f46e5; 
              margin-bottom: 10px;
              font-size: 28px;
            }
            h2 { 
              color: #1f2937; 
              margin: 30px 0 15px 0;
              font-size: 22px;
              border-bottom: 2px solid #4f46e5;
              padding-bottom: 8px;
            }
            .header {
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 3px solid #e5e7eb;
            }
            .date {
              color: #6b7280;
              font-size: 14px;
              margin-top: 5px;
            }
            .total-box {
              background: #eef2ff;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: center;
            }
            .total-box p {
              font-size: 18px;
              color: #1f2937;
            }
            .total-box strong {
              font-size: 28px;
              color: #4f46e5;
            }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📊 Resumen de Gastos Compartidos</h1>
            <p class="date">Generado el: ${currentDate}</p>
          </div>
          
          <h2>💰 Gastos Registrados (${expenses.length})</h2>
          ${
            expenses.length === 0
              ? '<p style="text-align: center; color: #6b7280; padding: 40px 0;">No hay gastos registrados</p>'
              : expensesHTML
          }
          
          <div class="total-box">
            <p>Total de gastos: <strong>S/. ${totalExpenses.toFixed(
              2
            )}</strong></p>
          </div>
          
          <h2>🧮 ¿Quién debe a quién?</h2>
          ${debtsHTML}
          
          <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
            <p>Calculadora de Gastos Compartidos</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                Calculadora de Gastos
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors font-semibold"
              >
                <Settings className="w-5 h-5" />
                <span>{showSettings ? "Ocultar" : "Configurar"} Nombres</span>
              </button>
              {expenses.length > 0 && (
                <button
                  onClick={downloadPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-semibold"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden md:inline">Descargar PDF</span>
                </button>
              )}
            </div>
          </div>

          {showSettings && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl mb-6 border border-indigo-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Configurar Participantes ({people.length})
              </h3>
              <div className="space-y-3">
                {people.map((person, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={person}
                      onChange={(e) => updatePersonName(index, e.target.value)}
                      placeholder={`Nombre de persona ${index + 1}`}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    {people.length > 1 && (
                      <button
                        onClick={() => removePerson(index)}
                        className="px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {people.length < 20 && (
                <button
                  onClick={addPerson}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Agregar Persona
                </button>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Descripción del gasto
              </label>
              <input
                type="text"
                placeholder="Ej: Cena en restaurante"
                value={newExpense.description}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, description: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Monto (S/.)
              </label>
              <input
                type="number"
                placeholder="0.00"
                step="0.01"
                value={newExpense.amount}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, amount: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ¿Quién pagó?
            </label>
            <select
              value={newExpense.paidBy}
              onChange={(e) =>
                setNewExpense({ ...newExpense, paidBy: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {people.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users className="w-4 h-4" />
                ¿Para quiénes es el gasto?
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAllPeople}
                  className="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                >
                  Todos
                </button>
                <button
                  onClick={deselectAllPeople}
                  className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Ninguno
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {people.map((person) => (
                <label
                  key={person}
                  className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={newExpense.splitBetween.includes(person)}
                    onChange={() => handleSplitToggle(person)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {person}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={addExpense}
            disabled={
              !newExpense.description ||
              !newExpense.amount ||
              !newExpense.paidBy ||
              newExpense.splitBetween.length === 0
            }
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Agregar Gasto
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-indigo-600" />
              Gastos Registrados
            </h2>

            {expenses.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No hay gastos registrados aún
              </p>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="bg-gray-50 p-4 rounded-lg border border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">
                          {expense.description}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Pagado por:{" "}
                          <span className="font-medium">{expense.paidBy}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => deleteExpense(expense.id)}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs text-gray-500">
                        Dividido entre: {expense.splitBetween.length} persona
                        {expense.splitBetween.length !== 1 ? "s" : ""}
                        <span className="ml-1 text-gray-400">
                          (S/.{" "}
                          {(
                            expense.amount / expense.splitBetween.length
                          ).toFixed(2)}{" "}
                          c/u)
                        </span>
                      </p>
                      <p className="text-lg font-bold text-indigo-600">
                        S/. {expense.amount.toFixed(2)}
                      </p>
                    </div>

                    {/* Desglose por persona */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 mb-2">
                        Desglose:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {expense.splitBetween.map((person) => (
                          <div
                            key={person}
                            className="text-xs bg-white px-2 py-1 rounded border border-gray-200"
                          >
                            <span className="text-gray-700">{person}:</span>
                            <span className="ml-1 font-semibold text-indigo-600">
                              S/.{" "}
                              {(
                                expense.amount / expense.splitBetween.length
                              ).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t-2 border-indigo-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-800">
                      Total:
                    </span>
                    <span className="text-2xl font-bold text-indigo-600">
                      S/. {totalExpenses.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-green-600" />
              ¿Quién debe a quién?
            </h2>

            {debts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {expenses.length === 0
                  ? "Agrega gastos para ver las deudas"
                  : "¡Todo está equilibrado! 🎉"}
              </p>
            ) : (
              <div className="space-y-4">
                {debts.map((debt, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-l-4 border-green-500"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700">
                          <span className="font-bold text-gray-900 truncate">
                            {debt.from}
                          </span>
                          <span className="mx-2 text-gray-500">→</span>
                          <span className="font-bold text-gray-900 truncate">
                            {debt.to}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          S/. {debt.amount.toFixed(2)}
                        </p>
                      </div>
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
