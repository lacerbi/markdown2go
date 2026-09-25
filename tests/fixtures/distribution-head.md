# The idea: a distribution head

LLM Processes \[1\] and amortized inference models \[3\].

```mermaid
flowchart LR
  P[Prompt: text + data + query] --> L[Frozen LLM<br/>one forward pass]
  L --> H[Hidden states]
  H --> D[Distribution head<br/>small, trained]
  D --> Q[Predicted distribution]
  P --> T[Teacher: digit by digit<br/>slow, offline]
  T --> M[Match the two]
  Q --> M
```

```latex
\mathcal{L}(\phi) = -\sum_{b} p_{\text{teacher}}(b \mid \text{prompt}) \, \log q_{\phi}(b \mid h(\text{prompt}))
```
