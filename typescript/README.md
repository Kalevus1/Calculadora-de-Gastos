# Calculadora de Gastos — versión TypeScript / React

Versión web de la Calculadora de Gastos Compartidos hecha con **React + TypeScript**
(Create React App). Comparte la misma lógica mejorada que las versiones Python y HTML:
deudas por **saldos netos**, nombres tipo **placeholder** con renumeración automática, y
exportación a PDF.

## ▶️ Cómo ejecutar

Necesitas **Node.js** (incluye `npm`). En esta carpeta:

```bash
npm install     # instala las dependencias (crea node_modules/)
npm start       # abre la app en http://localhost:3000
```

Para generar la versión de producción (carpeta `build/`):

```bash
npm run build
```

## 🗂️ Estructura

```
typescript/
├── package.json        # dependencias y scripts (react, react-dom, react-scripts…)
├── tsconfig.json       # configuración de TypeScript (strict)
├── public/
│   └── index.html      # HTML base (carga Tailwind por CDN)
└── src/
    ├── index.tsx       # punto de entrada (monta <App/>)
    └── App.tsx         # todo el componente y la lógica
```

## 🔧 Arreglos respecto al original

- Se **añadió `react-scripts`** a `package.json` (faltaba, por eso `npm start` fallaba fuera
  del sandbox).
- Se **tiparon** los datos (`Persona`, `Gasto`, `Deuda`) y las funciones → compila con
  `strict: true` sin `any` implícitos.
- Lógica de deudas cambiada a **liquidación por saldos netos** (pocas transferencias) y
  **reparto exacto en céntimos** (las cuotas suman siempre el total).
- **Persistencia con `localStorage`** (la sesión se guarda sola) + botón **Limpiar todo**.
- El botón "Agregar gasto" solo se activa con **monto > 0**.

## ⚠️ Notas

- Los **estilos** (Tailwind) y los **iconos** (lucide-react) funcionan mejor con conexión a
  internet la primera vez (Tailwind entra por CDN en `public/index.html`).
- Si prefieres algo 100 % offline y sin instalar nada, usa la versión **HTML** (`../web/index.html`)
  o el **.exe** (Python).

---

Autor: **KALEVI LATVA AIJO ALEGRIA**
