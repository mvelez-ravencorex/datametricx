# DataMetricX — Current State

**Fecha:** 2026-04-02

## Estado: Foundation / MVP — Reestructuración de agentes

### Completado
- [x] Multi-tenant Firebase backend
- [x] Semantic layer (entities/datasets JSON en GCS)
- [x] Integraciones: Meta Ads, Shopify, Google Ads
- [x] Dashboard builder con VizBuilder
- [x] RBAC (6 roles, permission sets, RLS)
- [x] Core dashboards (templates)
- [x] SysOwner mode
- [x] 19 docs de arquitectura en docs/
- [x] Knowledge consolidado en ravencorex-brain
- [x] JIRA proyecto DMX creado con 6 épicas
- [x] Nuevo equipo de 5 agentes configurado (PM + Frontend + Backend + Cloud Architect + Reviewer)

### Pendiente

#### CRÍTICO (DMX-1)
- [ ] PoP Backend — Period-over-Period via CTEs en BigQuery
- [ ] Symmetric Aggregation — Evitar duplicación en JOINs 1:N
- [ ] Aggregate Awareness — Routing a tablas pre-agregadas

#### ALTO (DMX-2)
- [ ] Cross-filtering entre visualizaciones
- [ ] Drill-down en valores

#### MEDIO (DMX-3)
- [ ] Integración TikTok Ads
- [ ] Integración MercadoLibre
- [ ] Integración Tiendanube
- [ ] Integración Amazon

### Blockers conocidos
- Error 401 en Development: Cloud Run IAM pending (necesita `roles/run.invoker` para martin.velez@ravencorex.com)
- Requiere request al agente Terraform: `ravencorex-terraform/.agent/comms/datametricx/TO-GCP-NNN.md`

### Conexiones
- Firebase: datametricx-prod ✅
- BigQuery: datametricx-prod.reporting ✅
- JIRA: DMX ✅ (configurar .env)
