# 💰 Calculadora de Gastos Compartidos

Autor: **KALEVI LATVA AIJO ALEGRIA** · Windows · 100 % local

Reparte gastos entre varias personas (viaje, cena, depa compartido…) y calcula
**quién le debe a quién** de la forma más simple. Versión de escritorio de un proyecto
propio que existía en **HTML** y **TypeScript/React**.

## ⬇️ Descargar (sin instalar Python)

En **[Releases](../../releases)**: `CalculadoraDeGastos_carpeta.zip` → descomprime y ejecuta
**`CalculadoraDeGastos.exe`**.
*(Es un `.exe` sin firmar: Windows SmartScreen puede pedir "Más info → Ejecutar de todos modos".)*

## 📂 Cuatro versiones (misma lógica mejorada)

| Versión | Archivo | Cómo se usa |
|---------|---------|-------------|
| 🖥️ **Escritorio (.exe)** | `CalculadoraDeGastos.exe` (Release) | Doble clic, sin instalar nada |
| 🐍 **Python** | `calculadora_gastos.py` | `Calculadora.bat` (o `python calculadora_gastos.py`) |
| 🌐 **Web (HTML)** | `web/index.html` | Doble clic → se abre en el navegador. Ideal para **GitHub Pages** |
| ⚛️ **TypeScript/React** | `typescript/` | `npm install` y `npm start` (Create React App) |

Las **tres versiones de código** (Python, HTML, TypeScript) comparten las mismas mejoras.

## ✨ Qué mejoré respecto al original

- 🧮 **Deudas por saldos netos:** en vez del neteo solo por pares, calcula el **saldo de cada
  persona** y genera **pocas transferencias**. Ej.: si "A paga por B" y "B paga por C", muestra
  directamente `C → A` (B queda en cero), en vez de una cadena confusa.
- 🪙 **Reparto exacto en céntimos:** el reparto trabaja en céntimos enteros y da el céntimo
  sobrante a los primeros, así que las cuotas **siempre suman el total** (no se pierde 1 céntimo).
- ✏️ **Nombres tipo placeholder** (listos para escribir, se seleccionan al enfocar) y
  **renumeración automática**: si borras la persona 3, la lista pasa de 1,2,4,5 a 1,2,3,4.
- 💾 **Guarda la sesión automáticamente:** al cerrar y volver a abrir, tus personas y gastos
  siguen ahí (Python con `QSettings`, HTML/TypeScript con `localStorage`). Botón **🧹 Limpiar todo**
  para empezar de cero.
- ✅ **Botón "Agregar gasto" solo se activa con monto > 0**; acepta punto **o** coma como decimal.
- 📄 (Python) **Exporta a PDF de verdad** con `QtPrintSupport`; sin depender de internet.
- 🔧 (TypeScript) Arreglé el **`react-scripts` faltante** y añadí **tipos** (compila en
  `strict`), para que corra local con `npm install && npm start`.

## ▶️ Cómo usar

1. **Participantes:** edita los nombres, agrega o quita personas.
2. Escribe la **descripción** y el **monto**, elige **quién pagó** y marca **para quiénes** es
   el gasto (botones *Todos* / *Ninguno*).
3. **Agregar Gasto**. Verás la lista de gastos con su desglose y el **total**.
4. A la derecha, **¿quién debe a quién?** se recalcula solo.
5. **⬇ Exportar a PDF** para guardar el resumen. La sesión **se guarda sola**; usa
   **🧹 Limpiar todo** para reiniciar.

## ⚙️ Tecnología

- **Python 3.12** + **PySide6** (Qt 6). PDF con `QtPrintSupport` (incluido).
- Reutiliza el entorno `..\.venv_face`; si no, `instalar.bat` crea `.venv`.

## 🔨 Generar el `.exe`

`pip install pyinstaller` y doble clic en **`crear_exe.bat`** → queda en `dist\CalculadoraDeGastos\`.

---

Desarrollado y documentado por **KALEVI LATVA AIJO ALEGRIA**.
