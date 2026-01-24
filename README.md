# 🏎️ F1 Minimal Telemetry

**A single-screen, replay-first, minimalist Formula 1 race intelligence interface.**

This project visualizes race constraints, driver freedom, and decision quality—focusing on clarity and epistemic honesty.

---

## 🚀 Integrated Tech Stack

-   **Frontend:** [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
-   **State Management:** [Zustand](https://github.com/pmndrs/zustand) (for high-frequency race timing)
-   **Visualization:** [Visx](https://airbnb.io/visx/) (D3-powered low-level primitives)
-   **Language:** [TypeScript](https://www.typescriptlang.org/)

---

## 📂 Project Structure

-   `src/store/`: Zustand state management for the global race cursor.
-   `src/components/`: Modular visualization components (e.g., Speedometer).
-   `docs/`: Detailed technical documentation and project roadmap.

---

## 📖 Key Documentation

-   [Technical Documentation](docs/minimalist_f_1_race_intelligence_interface_technical_documentation%20(1).md)
-   [Architecture Overview](docs/minimalist_f_1_race_intelligence_interface_technical_documentation%20(1).md#4-high-level-architecture)
-   [React + Visx Integration Guide](docs/minimalist_f_1_race_intelligence_interface_technical_documentation%20(1).md#11-implementation-details-react--visx-integration)

---

## 🛠️ Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Start Development Server:**
    ```bash
    npm run dev
    ```
3.  **Build for Production:**
    ```bash
    npm run build
    ```

---

## 🤝 Philosophy

We prioritize **clarity, determinism, and epistemic honesty**. The UI is built to be a strategist's notebook, not a broadcast spectacle.
