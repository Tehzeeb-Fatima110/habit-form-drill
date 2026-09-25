# 🎯 Habit Form - AI Prompt Workflow Drill

Welcome to my AI Prompt Workflow capstone project! This repository demonstrates the profound impact of **Prompt Engineering** when generating code with AI tools (like Cursor or GitHub Copilot). 

By comparing two different approaches, this project highlights how precise instructions lead to production-ready, accessible, and bug-free code compared to vague requests.

## 📂 Repository Structure & Deliverables

- **`main` branch**: Contains the base Next.js setup, documentation (`README.md`, `WORKFLOW.md`), and project constraints (`.cursorrules`).
- **`feature/habit-form-v1` branch**: Contains the code generated using a **Vague Prompt**. (Lacks validation, proper state management, and accessibility).
- **`feature/habit-form-v2` branch**: Contains the code generated using a **Precise, Engineered Prompt**. (Includes strict enum validation, `aria-live` accessibility, and controlled React states).

## 📄 Key Documents

- [`WORKFLOW.md`](./WORKFLOW.md): A detailed comparison of the code diffs, edge cases handled, and AI mistakes caught during the drill.
- [`.cursorrules`](./.cursorrules): 3 concrete, testable project rules established after analyzing the failures of Round 1.

## 🚀 How to Run Locally

If you want to test the form locally on your machine, follow these steps:

1. Clone the repository:
   ```bash
   git clone [https://github.com/Tehzeeb-Fatima110/habit-form-drill.git](https://github.com/Tehzeeb-Fatima110/habit-form-drill.git)
   cd habit-form-drill