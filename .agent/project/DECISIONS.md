# DataMetricX — Decisions

## D001: Equipo de 5 agentes especializados

**Fecha:** 2026-04-02
**Decision:** PM + Frontend Agent + Backend Agent + Cloud Architect + Reviewer.
**Razon:** Frontend (React/VizBuilder) y Backend (Cloud Functions/semantic layer/BigQuery) son dominios distintos que requieren especialización separada.

## D002: Frontend y Backend como agentes separados

**Fecha:** 2026-04-02
**Decision:** No mezclar en un solo "dev agent".
**Razon:** El frontend es React/UI/componentes. El backend es semantic layer compiler + BigQuery SQL generation + 7 integraciones de APIs externas. Mezclarlos genera confusión y respuestas de menor calidad.

## D003: Cloud Architect diseña pero no ejecuta

**Fecha:** 2026-04-02
**Decision:** Toda infra ejecutada via agente Terraform.
**Razon:** Protocolo de la compañía. El Cloud Architect del proyecto conoce las necesidades pero los cambios los aplica el agente de infra central.

## D004: Knowledge centralizado en brain

**Fecha:** 2026-04-02
**Decision:** Los 19 docs de datametricx/docs/ se consolidaron en ravencorex-brain/knowledge/domains/dev/datametricx.md.
**Razon:** Knowledge centralizado disponible para todos los agentes de la compañía. Los docs originales permanecen en el repo como referencia detallada.
