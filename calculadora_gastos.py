import sys
import json

from PySide6.QtCore import Qt, QTimer, QSettings, QRegularExpression
from PySide6.QtGui import QRegularExpressionValidator, QTextDocument
from PySide6.QtPrintSupport import QPrinter
from PySide6.QtWidgets import (
    QApplication, QWidget, QLabel, QPushButton, QLineEdit, QComboBox, QCheckBox,
    QHBoxLayout, QVBoxLayout, QGridLayout, QFrame, QScrollArea, QFileDialog,
    QMessageBox,
)

MON = "S/."          # símbolo de moneda


def cuotas_cent(monto, n):
    """Reparte 'monto' entre n personas en CÉNTIMOS enteros que suman exacto.
    El céntimo sobrante se da 1 a 1 a los primeros → nada se pierde."""
    cent = round(monto * 100)
    base = cent // n
    resto = cent - base * n            # 0..n-1 céntimos que sobran
    return [base + (1 if k < resto else 0) for k in range(n)]


def liquidar(ids, gastos):
    """Transferencias (de_id, a_id, monto) por saldos netos, en pocas operaciones.
    Trabaja en céntimos enteros para que no se pierdan fracciones."""
    saldo = {i: 0 for i in ids}        # en céntimos enteros
    for g in gastos:
        parts = [p for p in g["split"] if p in saldo]
        n = len(parts)
        if n == 0:
            continue
        cuotas = cuotas_cent(g["amount"], n)
        if g["paidBy"] in saldo:
            saldo[g["paidBy"]] += round(g["amount"] * 100)
        for p, c in zip(parts, cuotas):
            saldo[p] -= c
    acreedores = sorted(([i, s] for i, s in saldo.items() if s > 0), key=lambda x: -x[1])
    deudores = sorted(([i, -s] for i, s in saldo.items() if s < 0), key=lambda x: -x[1])
    res = []
    i = j = 0
    while i < len(deudores) and j < len(acreedores):
        pago = min(deudores[i][1], acreedores[j][1])
        if pago > 0:
            res.append((deudores[i][0], acreedores[j][0], pago / 100))
        deudores[i][1] -= pago
        acreedores[j][1] -= pago
        if deudores[i][1] == 0:
            i += 1
        if acreedores[j][1] == 0:
            j += 1
    return res


class CampoNombre(QLineEdit):
    """Al enfocarlo, selecciona todo → listo para escribir sin borrar."""
    def focusInEvent(self, e):
        super().focusInEvent(e)
        QTimer.singleShot(0, self.selectAll)


class Calculadora(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Calculadora de Gastos Compartidos")
        self.resize(1040, 780)
        self.setStyleSheet(ESTILO)

        self.settings = QSettings("KaleviApps", "CalculadoraGastos")

        # persona = {"id": int, "name": str}   (name vacío → placeholder "Persona N")
        self.personas = [{"id": i, "name": ""} for i in range(1, 6)]
        self.sig_pid = 6
        self.gastos = []
        self.sig_gid = 1
        self.split = [p["id"] for p in self.personas]     # ids seleccionados

        self._cargar()          # recupera la última sesión si existe
        self._ui()
        self._refrescar()

    # ---------------- persistencia ----------------
    def _cargar(self):
        try:
            data = self.settings.value("estado")
            if not data:
                return
            d = json.loads(data)
            self.personas = d["personas"]
            self.gastos = d["gastos"]
            self.split = d["split"]
            self.sig_pid = d["sig_pid"]
            self.sig_gid = d["sig_gid"]
            if not self.personas:                 # nunca dejar la lista vacía
                self.personas = [{"id": 1, "name": ""}]
                self.sig_pid = 2
        except Exception:
            pass                                  # estado corrupto → arranca limpio

    def _guardar(self):
        d = {"personas": self.personas, "gastos": self.gastos, "split": self.split,
             "sig_pid": self.sig_pid, "sig_gid": self.sig_gid}
        self.settings.setValue("estado", json.dumps(d))

    def closeEvent(self, e):
        self._guardar()
        super().closeEvent(e)

    # ---------------- nombres ----------------
    def _display(self, i):
        p = self.personas[i]
        return p["name"].strip() or f"Persona {i + 1}"

    def _nombre_de(self, pid):
        for i, p in enumerate(self.personas):
            if p["id"] == pid:
                return self._display(i)
        return "?"

    # ---------------- interfaz ----------------
    def _ui(self):
        cont = QWidget()
        raiz = QVBoxLayout(cont)
        raiz.setContentsMargins(22, 20, 22, 22)
        raiz.setSpacing(16)

        cab = QHBoxLayout()
        t = QLabel("💰  Calculadora de Gastos"); t.setObjectName("h1")
        self.btn_limpiar = QPushButton("🧹  Limpiar todo"); self.btn_limpiar.setObjectName("ghost")
        self.btn_limpiar.clicked.connect(self._limpiar_todo)
        self.btn_pdf = QPushButton("⬇  Exportar a PDF"); self.btn_pdf.setObjectName("success")
        self.btn_pdf.clicked.connect(self._exportar_pdf)
        cab.addWidget(t); cab.addStretch()
        cab.addWidget(self.btn_limpiar); cab.addWidget(self.btn_pdf)
        raiz.addLayout(cab)

        card = QFrame(); card.setObjectName("card")
        cl = QVBoxLayout(card); cl.setContentsMargins(20, 20, 20, 20); cl.setSpacing(14)
        raiz.addWidget(card)

        fila_part = QHBoxLayout()
        self.lbl_part = QLabel("Participantes"); self.lbl_part.setObjectName("h3")
        btn_add_p = QPushButton("＋  Agregar persona"); btn_add_p.setObjectName("addp")
        btn_add_p.clicked.connect(self._agregar_persona)
        fila_part.addWidget(self.lbl_part); fila_part.addStretch(); fila_part.addWidget(btn_add_p)
        cl.addLayout(fila_part)
        self.cont_personas = QVBoxLayout(); self.cont_personas.setSpacing(6)
        cl.addLayout(self.cont_personas)

        cl.addWidget(self._linea())

        fila = QGridLayout(); fila.setHorizontalSpacing(14); fila.setVerticalSpacing(6)
        fila.addWidget(self._lbl("Descripción del gasto"), 0, 0)
        fila.addWidget(self._lbl("Monto (" + MON + ")"), 0, 1)
        self.in_desc = QLineEdit(); self.in_desc.setPlaceholderText("Ej: Cena en restaurante")
        self.in_desc.textChanged.connect(self._actualizar_boton)
        self.in_monto = QLineEdit(); self.in_monto.setPlaceholderText("0.00")
        # acepta punto O coma como separador decimal (sin depender del locale del sistema)
        val = QRegularExpressionValidator(QRegularExpression(r"^\d{0,9}([.,]\d{0,2})?$"))
        self.in_monto.setValidator(val)
        self.in_monto.textChanged.connect(self._actualizar_boton)
        fila.addWidget(self.in_desc, 1, 0); fila.addWidget(self.in_monto, 1, 1)
        cl.addLayout(fila)

        cl.addWidget(self._lbl("¿Quién pagó?"))
        self.cbo_pago = QComboBox()
        cl.addWidget(self.cbo_pago)

        fh = QHBoxLayout()
        fh.addWidget(self._lbl("¿Para quiénes es el gasto?")); fh.addStretch()
        b_all = QPushButton("Todos"); b_all.setObjectName("chip"); b_all.clicked.connect(self._todos)
        b_none = QPushButton("Ninguno"); b_none.setObjectName("chip"); b_none.clicked.connect(self._ninguno)
        fh.addWidget(b_all); fh.addWidget(b_none)
        cl.addLayout(fh)
        self.cont_split = QGridLayout(); self.cont_split.setSpacing(6)
        cl.addLayout(self.cont_split)

        self.btn_add = QPushButton("Agregar Gasto"); self.btn_add.setObjectName("primary")
        self.btn_add.clicked.connect(self._agregar_gasto)
        cl.addWidget(self.btn_add)

        cols = QHBoxLayout(); cols.setSpacing(16)
        raiz.addLayout(cols)

        cg = QFrame(); cg.setObjectName("card")
        lg = QVBoxLayout(cg); lg.setContentsMargins(18, 18, 18, 18)
        h2g = QLabel("Gastos Registrados"); h2g.setObjectName("h2"); lg.addWidget(h2g)
        self.cont_gastos = QVBoxLayout(); self.cont_gastos.setSpacing(10); lg.addLayout(self.cont_gastos)
        lg.addStretch()
        self.lbl_total = QLabel(""); self.lbl_total.setObjectName("total"); lg.addWidget(self.lbl_total)
        cols.addWidget(cg, 1)

        cd = QFrame(); cd.setObjectName("card")
        ld = QVBoxLayout(cd); ld.setContentsMargins(18, 18, 18, 18)
        h2d = QLabel("¿Quién debe a quién?"); h2d.setObjectName("h2"); ld.addWidget(h2d)
        self.cont_deudas = QVBoxLayout(); self.cont_deudas.setSpacing(10); ld.addLayout(self.cont_deudas)
        ld.addStretch()
        cols.addWidget(cd, 1)

        scroll = QScrollArea(); scroll.setWidgetResizable(True); scroll.setWidget(cont)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        lay = QVBoxLayout(self); lay.setContentsMargins(0, 0, 0, 0); lay.addWidget(scroll)

    def _lbl(self, t):
        l = QLabel(t); l.setObjectName("label"); return l

    def _linea(self):
        f = QFrame(); f.setFrameShape(QFrame.Shape.HLine); f.setObjectName("hr"); return f

    @staticmethod
    def _vaciar(layout):
        while layout.count():
            it = layout.takeAt(0)
            if it.widget():
                it.widget().deleteLater()
            elif it.layout():
                Calculadora._vaciar(it.layout())

    # ---------------- render ----------------
    def _refrescar(self):
        self._render_personas()
        self._render_pago()
        self._render_split()
        self._render_gastos()
        self._render_deudas()
        self._actualizar_boton()

    def _render_personas(self):
        self._vaciar(self.cont_personas)
        self.lbl_part.setText(f"Participantes ({len(self.personas)})")
        for i, p in enumerate(self.personas):
            row = QHBoxLayout(); row.setSpacing(6)
            ed = CampoNombre()
            ed.setText(p["name"])
            ed.setPlaceholderText(f"Persona {i + 1}")     # listo para escribir
            ed.editingFinished.connect(lambda e=ed, pid=p["id"]: self._renombrar(pid, e.text()))
            row.addWidget(ed)
            if len(self.personas) > 1:
                x = QPushButton("✕"); x.setObjectName("del"); x.setFixedWidth(38)
                x.clicked.connect(lambda _=False, pid=p["id"]: self._quitar_persona(pid))
                row.addWidget(x)
            self.cont_personas.addLayout(row)

    def _render_pago(self):
        actual = self.cbo_pago.currentData()
        self.cbo_pago.blockSignals(True)
        self.cbo_pago.clear()
        for i, p in enumerate(self.personas):
            self.cbo_pago.addItem(self._display(i), p["id"])
        idx = self.cbo_pago.findData(actual)
        self.cbo_pago.setCurrentIndex(idx if idx >= 0 else 0)
        self.cbo_pago.blockSignals(False)

    def _render_split(self):
        self._vaciar(self.cont_split)
        for i, p in enumerate(self.personas):
            c = QCheckBox(self._display(i))
            c.setChecked(p["id"] in self.split)
            c.toggled.connect(lambda on, pid=p["id"]: self._toggle_split(pid, on))
            self.cont_split.addWidget(c, i // 3, i % 3)

    def _render_gastos(self):
        self._vaciar(self.cont_gastos)
        if not self.gastos:
            vacio = QLabel("No hay gastos registrados aún"); vacio.setObjectName("empty")
            vacio.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.cont_gastos.addWidget(vacio)
            self.lbl_total.setText(""); self.btn_pdf.setVisible(False)
            return
        self.btn_pdf.setVisible(True)
        total = 0.0
        for g in self.gastos:
            total += g["amount"]
            cuota = g["amount"] / len(g["split"])
            nombres = ", ".join(self._nombre_de(x) for x in g["split"])
            item = QFrame(); item.setObjectName("gasto")
            gl = QVBoxLayout(item); gl.setContentsMargins(12, 10, 12, 10); gl.setSpacing(3)
            top = QHBoxLayout()
            info = QVBoxLayout(); info.setSpacing(1)
            de = QLabel(g["desc"]); de.setObjectName("gdesc")
            pb = QLabel("Pagado por: " + self._nombre_de(g["paidBy"])); pb.setObjectName("gsub")
            info.addWidget(de); info.addWidget(pb)
            top.addLayout(info); top.addStretch()
            monto = QLabel(f"{MON} {g['amount']:.2f}"); monto.setObjectName("gmonto"); top.addWidget(monto)
            x = QPushButton("🗑"); x.setObjectName("del"); x.setFixedWidth(34)
            x.clicked.connect(lambda _=False, gid=g["id"]: self._quitar_gasto(gid))
            top.addWidget(x)
            gl.addLayout(top)
            sub = QLabel(f"Dividido entre {len(g['split'])} · {MON} {cuota:.2f} c/u  ({nombres})")
            sub.setObjectName("gsub"); sub.setWordWrap(True)
            gl.addWidget(sub)
            self.cont_gastos.addWidget(item)
        self.lbl_total.setText(f"Total:  {MON} {total:.2f}")

    def _render_deudas(self):
        self._vaciar(self.cont_deudas)
        ids = [p["id"] for p in self.personas]
        deudas = liquidar(ids, self.gastos)
        if not deudas:
            msg = "Agrega gastos para ver las deudas" if not self.gastos else "¡Todo está equilibrado! 🎉"
            e = QLabel(msg); e.setObjectName("empty"); e.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.cont_deudas.addWidget(e)
            return
        for de, a, m in deudas:
            item = QFrame(); item.setObjectName("deuda")
            dl = QHBoxLayout(item); dl.setContentsMargins(12, 10, 12, 10)
            p = QLabel(f"<b>{self._nombre_de(de)}</b>  →  <b>{self._nombre_de(a)}</b>")
            p.setObjectName("dtexto")
            dl.addWidget(p); dl.addStretch()
            mo = QLabel(f"{MON} {m:.2f}"); mo.setObjectName("dmonto"); dl.addWidget(mo)
            self.cont_deudas.addWidget(item)

    # ---------------- acciones personas ----------------
    def _agregar_persona(self):
        if len(self.personas) >= 20:
            return
        nid = self.sig_pid; self.sig_pid += 1
        self.personas.append({"id": nid, "name": ""})
        self.split.append(nid)
        self._refrescar()
        self._guardar()

    def _quitar_persona(self, pid):
        if len(self.personas) <= 1:
            return
        self.personas = [p for p in self.personas if p["id"] != pid]
        self.split = [x for x in self.split if x != pid]
        primero = self.personas[0]["id"]
        nuevos = []
        for g in self.gastos:
            g["split"] = [x for x in g["split"] if x != pid]
            if g["paidBy"] == pid:
                g["paidBy"] = primero
            if g["split"]:
                nuevos.append(g)
        self.gastos = nuevos
        self._refrescar()          # los placeholders se renumeran solos (1,2,3,4…)
        self._guardar()

    def _renombrar(self, pid, texto):
        for p in self.personas:
            if p["id"] == pid:
                if p["name"] == texto:
                    return
                p["name"] = texto
                break
        # actualización ligera: NO reconstruimos las filas de nombres (evita robar el foco)
        self._render_pago(); self._render_split(); self._render_gastos(); self._render_deudas()
        self._guardar()

    def _limpiar_todo(self):
        if self.gastos or any(p["name"].strip() for p in self.personas):
            r = QMessageBox.question(self, "Limpiar todo",
                                     "¿Borrar todos los participantes y gastos y empezar de cero?")
            if r != QMessageBox.StandardButton.Yes:
                return
        self.personas = [{"id": i, "name": ""} for i in range(1, 6)]
        self.sig_pid = 6
        self.gastos = []
        self.sig_gid = 1
        self.split = [p["id"] for p in self.personas]
        self._refrescar()
        self._guardar()

    # ---------------- acciones gasto ----------------
    def _toggle_split(self, pid, on):
        if on and pid not in self.split:
            self.split.append(pid)
        elif not on and pid in self.split:
            self.split.remove(pid)
        self._actualizar_boton(); self._guardar()

    def _todos(self):
        self.split = [p["id"] for p in self.personas]
        self._render_split(); self._actualizar_boton(); self._guardar()

    def _ninguno(self):
        self.split = []; self._render_split(); self._actualizar_boton(); self._guardar()

    def _actualizar_boton(self):
        try:
            monto_ok = float(self.in_monto.text().strip().replace(",", ".")) > 0
        except ValueError:
            monto_ok = False
        ok = bool(self.in_desc.text().strip()) and monto_ok and len(self.split) > 0
        self.btn_add.setEnabled(ok)

    def _agregar_gasto(self):
        try:
            monto = float(self.in_monto.text().replace(",", "."))
        except ValueError:
            return
        if monto <= 0 or not self.in_desc.text().strip() or not self.split:
            return
        self.gastos.append({
            "desc": self.in_desc.text().strip(),
            "amount": monto,
            "paidBy": self.cbo_pago.currentData(),
            "split": list(self.split),
            "id": self.sig_gid,
        })
        self.sig_gid += 1
        self.in_desc.clear(); self.in_monto.clear()
        self._render_gastos(); self._render_deudas(); self._actualizar_boton()
        self._guardar()

    def _quitar_gasto(self, gid):
        self.gastos = [g for g in self.gastos if g["id"] != gid]
        self._render_gastos(); self._render_deudas()
        self._guardar()

    # ---------------- PDF ----------------
    def _html_resumen(self):
        total = sum(g["amount"] for g in self.gastos)
        filas = ""
        for g in self.gastos:
            cuota = g["amount"] / len(g["split"])
            nombres = ", ".join(self._nombre_de(x) for x in g["split"])
            filas += (f"<div style='margin:0 0 14px;padding:12px;background:#f9fafb;"
                      f"border-left:4px solid #4f46e5;border-radius:8px;'>"
                      f"<b style='font-size:15px'>{g['desc']}</b><br>"
                      f"<span style='color:#6b7280'>Pagado por: <b>{self._nombre_de(g['paidBy'])}</b> · "
                      f"Total: <b style='color:#4f46e5'>{MON} {g['amount']:.2f}</b></span><br>"
                      f"<span style='color:#6b7280'>Dividido entre {len(g['split'])} "
                      f"({MON} {cuota:.2f} c/u): {nombres}</span></div>")
        ids = [p["id"] for p in self.personas]
        deu = liquidar(ids, self.gastos)
        if not deu:
            deudas = "<p style='text-align:center;color:#6b7280'>¡Todo está equilibrado! 🎉</p>"
        else:
            deudas = ""
            for de, a, m in deu:
                deudas += (f"<div style='margin:0 0 10px;padding:12px;background:#d1fae5;"
                           f"border-left:4px solid #10b981;border-radius:8px;'>"
                           f"<b>{self._nombre_de(de)}</b> → <b>{self._nombre_de(a)}</b> "
                           f"<b style='float:right;color:#059669'>{MON} {m:.2f}</b></div>")
        return (f"<html><body style='font-family:Segoe UI,Arial;color:#1f2937'>"
                f"<h1 style='color:#4f46e5'>Resumen de Gastos Compartidos</h1>"
                f"<h2>Gastos ({len(self.gastos)})</h2>{filas or '<p>Sin gastos</p>'}"
                f"<div style='background:#eef2ff;padding:12px;border-radius:8px;text-align:center'>"
                f"Total de gastos: <b style='color:#4f46e5;font-size:20px'>{MON} {total:.2f}</b></div>"
                f"<h2>¿Quién debe a quién?</h2>{deudas}</body></html>")

    def _exportar_pdf(self):
        if not self.gastos:
            return
        ruta, _ = QFileDialog.getSaveFileName(self, "Guardar resumen en PDF",
                                              "resumen_gastos.pdf", "PDF (*.pdf)")
        if not ruta:
            return
        doc = QTextDocument(); doc.setHtml(self._html_resumen())
        pr = QPrinter(QPrinter.PrinterMode.HighResolution)
        pr.setOutputFormat(QPrinter.OutputFormat.PdfFormat)
        pr.setOutputFileName(ruta)
        doc.print_(pr)
        QMessageBox.information(self, "PDF guardado", f"Resumen guardado en:\n{ruta}")


ESTILO = """
* { font-family: 'Segoe UI'; }
QWidget { background: #eef2ff; color: #1f2937; font-size: 13px; }
QLabel { background: transparent; }
QScrollArea { background: transparent; border: none; }
QLabel#h1 { font-size: 22px; font-weight: 800; color: #1f2937; }
QLabel#h2 { font-size: 17px; font-weight: 800; color: #1f2937; }
QLabel#h3 { font-size: 15px; font-weight: 800; color: #1f2937; }
QLabel#label { font-weight: 700; color: #374151; }
QLabel#empty { color: #6b7280; padding: 22px; background: #f3f4ff; border-radius: 10px; }
QLabel#total { font-size: 17px; font-weight: 800; color: #4f46e5; padding-top: 8px; }
#card { background: white; border-radius: 14px; }
#gasto { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; }
QLabel#gdesc { font-weight: 700; color: #1f2937; }
QLabel#gsub { color: #6b7280; font-size: 12px; }
QLabel#gmonto { font-size: 15px; font-weight: 800; color: #4f46e5; }
#deuda { background: #d1fae5; border-left: 4px solid #10b981; border-radius: 8px; }
QLabel#dtexto { color: #374151; font-size: 14px; }
QLabel#dmonto { font-size: 18px; font-weight: 800; color: #059669; }
QFrame#hr { border: none; border-top: 1px solid #e5e7eb; }
QLineEdit, QComboBox { background: white; border: 1px solid #d1d5db; border-radius: 8px; padding: 7px 10px; }
QLineEdit:focus, QComboBox:focus { border: 1px solid #4f46e5; }
QComboBox::drop-down { border: none; width: 20px; }
QComboBox QAbstractItemView { background: white; selection-background-color: #e0e7ff; selection-color: #1f2937; }
QCheckBox { background: #f9fafb; border: 1px solid #eef2ff; border-radius: 8px; padding: 6px 10px; color: #374151; font-weight: 600; }
QCheckBox:hover { background: #eef2ff; }
QPushButton#primary { background: #4f46e5; color: white; border: none; border-radius: 8px; padding: 10px 16px; font-weight: 700; }
QPushButton#primary:hover { background: #4338ca; }
QPushButton#primary:disabled { background: #c7cbe6; }
QPushButton#success { background: #059669; color: white; border: none; border-radius: 8px; padding: 9px 16px; font-weight: 700; }
QPushButton#success:hover { background: #047857; }
QPushButton#ghost { background: white; color: #6b7280; border: 1px solid #d1d5db; border-radius: 8px; padding: 9px 14px; font-weight: 700; }
QPushButton#ghost:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
QPushButton#addp { background: #4f46e5; color: white; border: none; border-radius: 8px; padding: 6px 12px; font-weight: 700; }
QPushButton#addp:hover { background: #4338ca; }
QPushButton#chip { background: #e0e7ff; color: #4f46e5; border: none; border-radius: 6px; padding: 5px 12px; font-weight: 700; }
QPushButton#chip:hover { background: #c7d2fe; }
QPushButton#del { background: #fee2e2; color: #dc2626; border: none; border-radius: 8px; padding: 6px; font-weight: 800; }
QPushButton#del:hover { background: #fecaca; }
"""


def main():
    app = QApplication(sys.argv)
    app.setStyleSheet(ESTILO)
    v = Calculadora()
    v.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
