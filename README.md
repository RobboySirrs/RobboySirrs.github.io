# Rabattjakten 🏷️

En snabb, lightweight webbapplikation och Progressive Web App (PWA) för att enkelt söka, filtrera och sortera rabattkoder och erbjudanden från olika källor.

![PWA Ready](https://img.shields.io/badge/PWA-Ready-success?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## ✨ Funktioner

* **Smart Relevanssortering:** Avancerad poängalgoritm som prioriterar varumärkesmatchningar och exakta ord framför delvisa sökträffar (undviker falska träffar via `.includes()`).
* **PWA-stöd:** Kan installeras direkt på hem-skärmen på iOS och Android för en nativ appkänsla utan adressfält.
* **Autofokus & Snabbfiltrering:** Sökfältet är redo direkt vid laddning med debounced sökning för optimal prestanda.
* **Varumärkesmappning:** Automatisk sortering vid första sidladdning baserat på prioriterade `BRAND_KEYWORDS`.
* **Zero Dependencies:** Byggd med ren, snabb vaniljs-JavaScript, HTML5 och CSS.

---

## 🛠️ Installation & Användning

Eftersom projektet är helt klientbaserat krävs ingen byggprocess eller tunga npm-paket.

1. **Klona repot:**
   ```bash
   git clone [https://github.com/DITT-ANVÄNDARNAMN/rabattjakten.git](https://github.com/DITT-ANVÄNDARNAMN/rabattjakten.git)
   cd rabattjakten
