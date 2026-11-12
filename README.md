# EDITORS.PortBuddy — Port & Terminal Buddy

**Wiki:** [Documentation/README.md](Documentation/README.md) — principles, architecture, delivery.

Port & Terminal Inspector: configure discrete port electrical parameters, signal formats (Mic, Line, AES3, MADI, SDI, HDMI, USB), nominal levels (+4dBu, -10dBV), electrical impedance (600Ω, 110Ω, 75Ω), and phantom power flags.

| | |
|---|---|
| **Opens** | the OS shell (Design → Hardware & Devices), or `index.html` standalone |
| **Build** | none — plain web files; `npm test` |
| **Ships** | baked into WEB.Frontend-Assets (`up-stack.sh WEB.Frontend-Assets`), served at `:8080/Softapps/EDITORS/EDITORS.PortBuddy/` |
